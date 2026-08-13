/* eslint camelcase: off */

import {
  applyBackfillPage,
  applyIncrementalPage,
  finishBackfill,
  markRunStopped,
  resumeOrStartSync,
} from './checkpoint'
import { normalizeStatus } from './statusRecords'

const PAGE_SIZE = 60
const REQUEST_INTERVAL_MS = 500

// 全量回填是 390 页级的长任务，一次抖动就截断整轮的代价太高。
// 重试只针对「重试一次就可能好」的错误，授权失效和脏数据重试多少次都一样。
const MAX_ATTEMPTS = 5
const RETRY_BASE_DELAY_MS = 1000

// Service Worker 空闲回收会让在途请求被 reject（见 content/environment/messaging.js
// 的 onDisconnect），但端口紧接着就会自动重连——这是最典型的「重试就能好」。
const RETRYABLE_MESSAGE_PATTERN = /Port disconnected|Port not initialized|Failed to fetch|NetworkError|network|请求超时/i

// 写盘侧只重试「文件被临时占用」这一类。Windows 上杀毒软件扫描刚写出的文件会短暂锁住它。
// 权限被撤（NotAllowedError）和磁盘满（QuotaExceededError）重试多少次都一样，必须立刻停下来告诉用户。
const RETRYABLE_ERROR_NAMES = new Set([ 'NoModificationAllowedError', 'InvalidStateError' ])

const defaultSleep = milliseconds => new Promise(resolve => {
  setTimeout(resolve, milliseconds)
})

function isRetryable(error) {
  if (RETRYABLE_ERROR_NAMES.has(error?.name)) return true

  const status = error?.status

  if (status === 429) return true
  if (status >= 500 && status < 600) return true
  // 明确的 4xx 是授权或参数问题，重试没有意义。
  if (status) return false

  return RETRYABLE_MESSAGE_PATTERN.test(error?.message || '')
}

function streamLabel(resource) {
  return resource === 'statuses' ? 'Timeline' : 'Archive'
}

async function withRetry(operation, { sleep, onRetry, stage }) {
  let attempt = 0

  while (true) {
    try {
      return await operation()
    } catch (error) {
      attempt += 1
      if (attempt >= MAX_ATTEMPTS || !isRetryable(error)) throw error

      const delay = RETRY_BASE_DELAY_MS * (2 ** (attempt - 1))
      onRetry({ stage, attempt, maxAttempts: MAX_ATTEMPTS, delay, error })
      await sleep(delay)
    }
  }
}

// 停止原因必须落盘，否则用户重开面板无法区分暂停、报错和标签页被回收。
// 记录本身失败不能掩盖真正的错误，所以这里吞掉自己的异常。
async function recordStop(store, meta, { reason, message, now }) {
  const stoppedMeta = markRunStopped(meta, { reason, message, now })
  if (stoppedMeta === meta) return meta

  try {
    await store.writeMeta(stoppedMeta)
    return stoppedMeta
  } catch (_) {
    return meta
  }
}

export async function syncStatusStream({
  account,
  fetchPage,
  store,
  resource = 'statuses',
  archiveSource = 'ownTimeline',
  sleep = defaultSleep,
  clock = () => new Date(),
  shouldPause = () => false,
  onProgress = () => undefined,
  onRetry = () => undefined,
  onCommitted = () => undefined,
}) {
  const initialMeta = await store.readMeta()
  let meta = resumeOrStartSync(initialMeta, account, clock().toISOString(), resource)

  if (meta !== initialMeta) {
    await store.writeMeta(meta)
  }

  let nextMaxId = meta.activeRun?.nextMaxId || null

  try {
    while (true) {
      if (shouldPause()) {
        meta = await recordStop(store, meta, { reason: 'paused', now: clock().toISOString() })
        return { status: 'paused', meta }
      }

      const query = { count: PAGE_SIZE }
      if (nextMaxId) query.max_id = nextMaxId

      const page = await withRetry(() => fetchPage(query), { sleep, onRetry, stage: 'fetch' })
      if (!Array.isArray(page)) throw new TypeError(`${streamLabel(resource)} page must be an array`)

      if (page.length === 0) {
        meta = finishBackfill(meta, clock().toISOString(), resource)
        await store.writeMeta(meta)
        onProgress({ status: 'completed', meta })
        return { status: 'completed', meta }
      }

      const isIncremental = meta.activeRun?.mode === 'incremental'
      const stopAnchorId = meta.activeRun?.stopAnchorId
      const anchorIndex = isIncremental
        ? page.findIndex(status => String(status.id) === String(stopAnchorId))
        : -1
      const statusesToCommit = anchorIndex >= 0 ? page.slice(0, anchorIndex) : page
      if (statusesToCommit.some(status => !status?.id)) {
        throw new TypeError(`${streamLabel(resource)} status is missing an id`)
      }
      const pageLastId = page[page.length - 1]?.id
      if (!pageLastId) {
        throw new Error(`${streamLabel(resource)} pagination did not advance`)
      }
      // `max_id` normally is exclusive. At the first-ever message, however, the
      // API can echo that one saved cursor instead of returning an empty page.
      // That page contains no uncommitted data and is a terminal marker, not a
      // page that should be written again. A longer unchanged page is still a
      // genuine pagination fault and must remain visible to the user.
      if (String(pageLastId) === String(nextMaxId || '')) {
        if (page.length === 1) {
          meta = finishBackfill(meta, clock().toISOString(), resource)
          await store.writeMeta(meta)
          onProgress({ status: 'completed', meta })
          return { status: 'completed', meta }
        }
        throw new Error(`${streamLabel(resource)} pagination did not advance`)
      }

      const archivedAt = clock().toISOString()
      const statuses = statusesToCommit
        .map(status => normalizeStatus(status, {
          account,
          archiveSource,
          archivedAt,
        }))
        .filter(Boolean)

      const incrementalCompleted = isIncremental && anchorIndex >= 0
      const pendingMeta = isIncremental
        ? applyIncrementalPage(
          meta,
          statusesToCommit,
          String(pageLastId),
          archivedAt,
          incrementalCompleted,
          resource,
        )
        : applyBackfillPage(meta, page, String(pageLastId), archivedAt, resource)

      if (statuses.length > 0) {
        meta = await withRetry(
          () => store.commitStatusPage({ resource, statuses, meta: pendingMeta }),
          { sleep, onRetry, stage: 'commit' },
        )
        await onCommitted({ resource, statuses, meta })
      } else {
        meta = pendingMeta
        await store.writeMeta(meta)
      }
      nextMaxId = String(pageLastId)
      onProgress({
        status: 'running',
        committedPages: meta.activeRun?.committedPages || 0,
        count: meta.counts[resource] || 0,
        nextMaxId,
        meta,
      })

      if (incrementalCompleted) return { status: 'completed', meta }
      if (shouldPause()) {
        meta = await recordStop(store, meta, { reason: 'paused', now: clock().toISOString() })
        return { status: 'paused', meta }
      }
      await sleep(REQUEST_INTERVAL_MS)
    }
  } catch (error) {
    await recordStop(store, meta, {
      reason: 'error',
      message: error?.message || String(error),
      now: clock().toISOString(),
    })
    throw error
  }
}

export default function syncOwnTimeline(options) {
  return syncStatusStream(options)
}
