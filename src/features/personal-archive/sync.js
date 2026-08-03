/* eslint camelcase: off */

import {
  applyBackfillPage,
  applyIncrementalPage,
  finishBackfill,
  resumeOrStartSync,
} from './checkpoint'
import { normalizeStatus } from './statusRecords'

const PAGE_SIZE = 60
const REQUEST_INTERVAL_MS = 500

const defaultSleep = milliseconds => new Promise(resolve => {
  setTimeout(resolve, milliseconds)
})

export default async function syncOwnTimeline({
  account,
  fetchPage,
  store,
  sleep = defaultSleep,
  clock = () => new Date(),
  shouldPause = () => false,
  onProgress = () => undefined,
}) {
  const initialMeta = await store.readMeta()
  let meta = resumeOrStartSync(initialMeta, account, clock().toISOString())

  if (meta !== initialMeta) {
    await store.writeMeta(meta)
  }

  let nextMaxId = meta.activeRun?.nextMaxId || null

  while (true) {
    if (shouldPause()) return { status: 'paused', meta }

    const query = { count: PAGE_SIZE }
    if (nextMaxId) query.max_id = nextMaxId

    const page = await fetchPage(query)
    if (!Array.isArray(page)) throw new TypeError('Timeline page must be an array')

    if (page.length === 0) {
      meta = finishBackfill(meta, clock().toISOString())
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
      throw new TypeError('Timeline status is missing an id')
    }
    const pageLastId = page[page.length - 1]?.id
    if (!pageLastId || String(pageLastId) === String(nextMaxId || '')) {
      throw new Error('Timeline pagination did not advance')
    }

    const archivedAt = clock().toISOString()
    const statuses = statusesToCommit
      .map(status => normalizeStatus(status, {
        account,
        archiveSource: 'ownTimeline',
        archivedAt,
      }))
      .filter(Boolean)

    const incrementalCompleted = isIncremental && anchorIndex >= 0
    const pendingMeta = isIncremental
      ? applyIncrementalPage(meta, statusesToCommit, String(pageLastId), archivedAt, incrementalCompleted)
      : applyBackfillPage(meta, page, String(pageLastId), archivedAt)

    if (statuses.length > 0) {
      meta = await store.commitStatusPage({ statuses, meta: pendingMeta })
    } else {
      meta = pendingMeta
      await store.writeMeta(meta)
    }
    nextMaxId = String(pageLastId)
    onProgress({
      status: 'running',
      committedPages: meta.activeRun?.committedPages || 0,
      count: meta.counts.statuses,
      nextMaxId,
      meta,
    })

    if (incrementalCompleted) return { status: 'completed', meta }
    if (shouldPause()) return { status: 'paused', meta }
    await sleep(REQUEST_INTERVAL_MS)
  }
}
