import {
  ARCHIVE_TIMEZONE,
  groupStatusesByMonth,
  mergeStatusRecords,
} from './statusRecords'

const STATUS_MONTH_PATTERN = /^\d{4}-\d{2}$/
const STREAM_RESOURCE_PATTERN = /^[a-z][a-z0-9-]*$/

function assertStatusMonth(month) {
  if (!STATUS_MONTH_PATTERN.test(month)) {
    throw new Error(`Invalid status month: ${month}`)
  }
}

function assertStreamResource(resource) {
  if (!STREAM_RESOURCE_PATTERN.test(resource)) {
    throw new Error(`Invalid archive resource: ${resource}`)
  }
}

async function readJsonFile(directoryHandle, filename, fallback) {
  try {
    const fileHandle = await directoryHandle.getFileHandle(filename)
    const file = await fileHandle.getFile()
    const text = await file.text()
    return text.trim() ? JSON.parse(text) : fallback
  } catch (error) {
    if (error?.name === 'NotFoundError') return fallback
    throw error
  }
}

async function writeJsonFile(directoryHandle, filename, value) {
  const fileHandle = await directoryHandle.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()

  try {
    await writable.write(`${JSON.stringify(value, null, 2)}\n`)
    await writable.close()
  } catch (error) {
    if (typeof writable.abort === 'function') {
      try {
        await writable.abort()
      } catch (_) {}
    }
    throw error
  }
}

function summarizeShard(statuses) {
  return {
    count: statuses.length,
    newestId: statuses[0]?.id || null,
    oldestId: statuses[statuses.length - 1]?.id || null,
  }
}

function splitPath(relativePath) {
  const segments = String(relativePath).split('/').filter(Boolean)
  if (!segments.length) throw new Error(`Invalid archive path: ${relativePath}`)
  if (segments.includes('..')) throw new Error(`Archive path must stay inside the backup directory: ${relativePath}`)

  return {
    directories: segments.slice(0, -1),
    filename: segments[segments.length - 1],
  }
}

export default function createFileSystemArchiveStore(rootHandle) {
  function getStreamDirectory(resource, create = false) {
    assertStreamResource(resource)
    return rootHandle.getDirectoryHandle(resource, { create })
  }

  async function resolveDirectory(directories, create) {
    let handle = rootHandle
    for (const name of directories) {
      handle = await handle.getDirectoryHandle(name, { create })
    }
    return handle
  }

  async function writeFileAt(relativePath, contents) {
    const { directories, filename } = splitPath(relativePath)
    const directoryHandle = await resolveDirectory(directories, true)
    const fileHandle = await directoryHandle.getFileHandle(filename, { create: true })
    const writable = await fileHandle.createWritable()

    try {
      await writable.write(contents)
      await writable.close()
    } catch (error) {
      if (typeof writable.abort === 'function') {
        try {
          await writable.abort()
        } catch (_) {}
      }
      throw error
    }
  }

  async function readJsonFileAt(relativePath, fallback) {
    const { directories, filename } = splitPath(relativePath)

    try {
      const directoryHandle = await resolveDirectory(directories, false)
      return await readJsonFile(directoryHandle, filename, fallback)
    } catch (error) {
      if (error?.name === 'NotFoundError') return fallback
      throw error
    }
  }

  async function writeJsonFileAt(relativePath, value) {
    const { directories, filename } = splitPath(relativePath)
    const directoryHandle = await resolveDirectory(directories, true)
    await writeJsonFile(directoryHandle, filename, value)
  }

  async function readStreamMonth(resource, month) {
    assertStatusMonth(month)

    try {
      const directoryHandle = await getStreamDirectory(resource, false)
      return await readJsonFile(directoryHandle, `${month}.json`, [])
    } catch (error) {
      if (error?.name === 'NotFoundError') return []
      throw error
    }
  }

  async function writeStreamMonth(resource, month, statuses) {
    assertStatusMonth(month)
    const directoryHandle = await getStreamDirectory(resource, true)
    await writeJsonFile(directoryHandle, `${month}.json`, statuses)
  }

  function readStatusMonth(month) {
    return readStreamMonth('statuses', month)
  }

  function writeStatusMonth(month, statuses) {
    return writeStreamMonth('statuses', month, statuses)
  }

  function readMentionMonth(month) {
    return readStreamMonth('mentions', month)
  }

  function readFavoriteMonth(month) {
    return readStreamMonth('favorites', month)
  }

  function readMeta() {
    return readJsonFile(rootHandle, 'meta.json', null)
  }

  async function writeMeta(meta) {
    await writeJsonFile(rootHandle, 'meta.json', meta)
  }

  async function commitStatusPage({ resource = 'statuses', statuses, meta }) {
    assertStreamResource(resource)
    const timeZone = meta.archiveTimezone || ARCHIVE_TIMEZONE
    const groupedStatuses = groupStatusesByMonth(statuses, timeZone)
    const shardSummaries = {
      ...(meta.shards?.[resource] || {}),
    }

    for (const month of Object.keys(groupedStatuses)) {
      const existingStatuses = await readStreamMonth(resource, month)
      const merged = mergeStatusRecords(existingStatuses, groupedStatuses[month])
      await writeStreamMonth(resource, month, merged.statuses)
      shardSummaries[month] = summarizeShard(merged.statuses)
    }

    const committedMeta = {
      ...meta,
      shards: {
        ...(meta.shards || {}),
        [resource]: shardSummaries,
      },
      counts: {
        ...(meta.counts || {}),
        [resource]: Object.values(shardSummaries)
          .reduce((total, shard) => total + shard.count, 0),
      },
    }
    await writeMeta(committedMeta)
    return committedMeta
  }

  function listStatusShards(meta) {
    return Object.keys(meta?.shards?.statuses || {}).sort()
  }

  function listMentionShards(meta) {
    return Object.keys(meta?.shards?.mentions || {}).sort()
  }

  function listFavoriteShards(meta) {
    return Object.keys(meta?.shards?.favorites || {}).sort()
  }

  // 生成离线 HTML 需要全部历史消息，逐个分片读回。
  async function readAllStatuses(meta) {
    const statuses = []
    for (const month of listStatusShards(meta)) {
      statuses.push(...await readStatusMonth(month))
    }
    return statuses
  }

  async function readAllMentions(meta) {
    const statuses = []
    for (const month of listMentionShards(meta)) {
      statuses.push(...await readMentionMonth(month))
    }
    return statuses
  }

  async function readAllFavorites(meta) {
    const statuses = []
    for (const month of listFavoriteShards(meta)) {
      statuses.push(...await readFavoriteMonth(month))
    }
    return statuses
  }

  function writeTextFile(relativePath, text) {
    return writeFileAt(relativePath, text)
  }

  function writeBinaryFile(relativePath, arrayBuffer) {
    return writeFileAt(relativePath, arrayBuffer)
  }

  // 下载器靠它跳过已存在的图片，让整个过程可重复运行。
  async function fileExists(relativePath) {
    const { directories, filename } = splitPath(relativePath)

    try {
      const directoryHandle = await resolveDirectory(directories, false)
      await directoryHandle.getFileHandle(filename)
      return true
    } catch (error) {
      if (error?.name === 'NotFoundError') return false
      throw error
    }
  }

  return {
    readMeta,
    writeMeta,
    readStatusMonth,
    writeStatusMonth,
    readMentionMonth,
    readFavoriteMonth,
    commitStatusPage,
    listStatusShards,
    listMentionShards,
    listFavoriteShards,
    readAllStatuses,
    readAllMentions,
    readAllFavorites,
    readJsonFileAt,
    writeJsonFileAt,
    writeTextFile,
    writeBinaryFile,
    fileExists,
  }
}
