import {
  ARCHIVE_TIMEZONE,
  groupStatusesByMonth,
  mergeStatusRecords,
} from './statusRecords'

const STATUS_MONTH_PATTERN = /^\d{4}-\d{2}$/

function assertStatusMonth(month) {
  if (!STATUS_MONTH_PATTERN.test(month)) {
    throw new Error(`Invalid status month: ${month}`)
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
  function getStatusesDirectory(create = false) {
    return rootHandle.getDirectoryHandle('statuses', { create })
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

  async function readStatusMonth(month) {
    assertStatusMonth(month)

    try {
      const directoryHandle = await getStatusesDirectory(false)
      return await readJsonFile(directoryHandle, `${month}.json`, [])
    } catch (error) {
      if (error?.name === 'NotFoundError') return []
      throw error
    }
  }

  async function writeStatusMonth(month, statuses) {
    assertStatusMonth(month)
    const directoryHandle = await getStatusesDirectory(true)
    await writeJsonFile(directoryHandle, `${month}.json`, statuses)
  }

  function readMeta() {
    return readJsonFile(rootHandle, 'meta.json', null)
  }

  async function writeMeta(meta) {
    await writeJsonFile(rootHandle, 'meta.json', meta)
  }

  async function commitStatusPage({ statuses, meta }) {
    const timeZone = meta.archiveTimezone || ARCHIVE_TIMEZONE
    const groupedStatuses = groupStatusesByMonth(statuses, timeZone)
    const shardSummaries = {
      ...(meta.shards?.statuses || {}),
    }

    for (const month of Object.keys(groupedStatuses)) {
      const existingStatuses = await readStatusMonth(month)
      const merged = mergeStatusRecords(existingStatuses, groupedStatuses[month])
      await writeStatusMonth(month, merged.statuses)
      shardSummaries[month] = summarizeShard(merged.statuses)
    }

    const committedMeta = {
      ...meta,
      shards: {
        ...(meta.shards || {}),
        statuses: shardSummaries,
      },
      counts: {
        ...(meta.counts || {}),
        statuses: Object.values(shardSummaries)
          .reduce((total, shard) => total + shard.count, 0),
      },
    }
    await writeMeta(committedMeta)
    return committedMeta
  }

  function listStatusShards(meta) {
    return Object.keys(meta?.shards?.statuses || {}).sort()
  }

  // 生成离线 HTML 需要全部历史消息，逐个分片读回。
  async function readAllStatuses(meta) {
    const statuses = []
    for (const month of listStatusShards(meta)) {
      statuses.push(...await readStatusMonth(month))
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
    commitStatusPage,
    listStatusShards,
    readAllStatuses,
    writeTextFile,
    writeBinaryFile,
    fileExists,
  }
}
