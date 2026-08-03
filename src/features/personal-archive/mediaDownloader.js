import { collectAllMediaTargets } from './mediaUrls'
import { ARCHIVE_TIMEZONE } from './statusRecords'

const REQUEST_INTERVAL_MS = 200

const defaultSleep = milliseconds => new Promise(resolve => {
  setTimeout(resolve, milliseconds)
})

const EXTENSION_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
}

export function pickExtension(contentType) {
  const mime = String(contentType || '').split(';')[0].trim().toLowerCase()
  return EXTENSION_BY_MIME[mime] || '.jpg'
}

/**
 * 把归档里引用到的图片与头像抓到本地，让备份文件夹能脱网浏览。
 *
 * 已存在的文件直接跳过，所以这个过程可以重复运行、可以中断后继续。
 * 单张失败不中断整体，失败与「域名未授权」分别记入 meta，交给面板展示。
 */
export default async function downloadArchiveMedia({
  statuses,
  store,
  meta,
  fetchMedia = (...args) => fetch(...args),
  sleep = defaultSleep,
  clock = () => new Date(),
  shouldPause = () => false,
  onProgress = () => undefined,
}) {
  const timeZone = meta?.archiveTimezone || ARCHIVE_TIMEZONE
  const { targets, skippedByHost } = collectAllMediaTargets(statuses, timeZone)

  const failures = []
  let downloaded = 0
  let skippedExisting = 0
  let index = 0

  for (const item of targets) {
    if (shouldPause()) break
    index += 1

    try {
      // 扩展名取决于响应头，但已下载的文件在磁盘上只可能是这几种之一，先逐个探测。
      const existingPath = await findExistingFile(store, item.relativePathWithoutExtension)
      if (existingPath) {
        skippedExisting += 1
        continue
      }

      const response = await fetchMedia(item.sourceUrl)
      if (!response?.ok) {
        throw new Error(`HTTP ${response?.status || 'error'}`)
      }

      const buffer = await response.arrayBuffer()
      const extension = pickExtension(response.headers?.get?.('content-type'))
      await store.writeBinaryFile(`${item.relativePathWithoutExtension}${extension}`, buffer)
      downloaded += 1

      onProgress({
        status: 'running',
        total: targets.length,
        processed: index,
        downloaded,
        skippedExisting,
        failed: failures.length,
      })

      await sleep(REQUEST_INTERVAL_MS)
    } catch (error) {
      failures.push({
        url: item.sourceUrl,
        path: item.relativePathWithoutExtension,
        reason: error?.message || String(error),
        failedAt: clock().toISOString(),
      })
    }
  }

  const nextMeta = {
    ...meta,
    photoFailures: failures,
    mediaSkipped: skippedByHost,
    mediaSyncedAt: clock().toISOString(),
  }
  await store.writeMeta(nextMeta)

  const result = {
    status: index < targets.length ? 'paused' : 'completed',
    total: targets.length,
    downloaded,
    skippedExisting,
    failures,
    skippedByHost,
    meta: nextMeta,
  }
  onProgress({ ...result, processed: index })

  return result
}

const KNOWN_EXTENSIONS = Object.values(EXTENSION_BY_MIME)

async function findExistingFile(store, relativePathWithoutExtension) {
  for (const extension of KNOWN_EXTENSIONS) {
    const path = `${relativePathWithoutExtension}${extension}`
    if (await store.fileExists(path)) return path
  }
  return null
}

/**
 * 供 buildHtml 使用：列出磁盘上真实存在的媒体文件相对路径。
 * HTML 只对这里出现过的路径生成 `<img>`，其余降级为回饭否原页的链接。
 */
export async function listAvailableMedia(statuses, store, meta) {
  const timeZone = meta?.archiveTimezone || ARCHIVE_TIMEZONE
  const { targets } = collectAllMediaTargets(statuses, timeZone)
  const available = new Map()

  for (const item of targets) {
    const path = await findExistingFile(store, item.relativePathWithoutExtension)
    if (path) available.set(item.relativePathWithoutExtension, path)
  }

  return available
}
