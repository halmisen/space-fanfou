/* eslint camelcase: off */

export const ARCHIVE_TIMEZONE = 'Asia/Shanghai'

function toISOString(value) {
  const date = value ? new Date(value) : null

  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : ''
}

function compareStatusesNewestFirst(a, b) {
  const aTime = Date.parse(a?._archive?.createdAtISO || a?.created_at || '') || 0
  const bTime = Date.parse(b?._archive?.createdAtISO || b?.created_at || '') || 0

  if (aTime !== bTime) return bTime - aTime
  return String(b.id).localeCompare(String(a.id))
}

export function normalizeStatus(status, {
  account,
  archiveSource,
  archivedAt = new Date().toISOString(),
} = {}) {
  if (!status?.id) return null

  return {
    ...status,
    _archive: {
      accountId: account?.id || '',
      archiveSource: archiveSource || '',
      archivedAt,
      createdAtISO: toISOString(status.created_at),
    },
  }
}

export function mergeStatusLists(existingStatuses, rawStatuses, options) {
  const normalizedStatuses = (rawStatuses || [])
    .map(status => normalizeStatus(status, options))
    .filter(Boolean)

  return mergeStatusRecords(existingStatuses, normalizedStatuses)
}

export function mergeStatusRecords(existingStatuses, incomingStatuses) {
  const recordsById = new Map()

  for (const status of existingStatuses || []) {
    if (status?.id) recordsById.set(String(status.id), status)
  }

  let importedCount = 0
  for (const status of incomingStatuses || []) {
    if (!status?.id) continue
    const id = String(status.id)
    if (!recordsById.has(id)) importedCount += 1
    recordsById.set(id, status)
  }

  return {
    importedCount,
    statuses: [ ...recordsById.values() ].sort(compareStatusesNewestFirst),
  }
}

export function getStatusMonth(status, timeZone = ARCHIVE_TIMEZONE) {
  const date = new Date(status?._archive?.createdAtISO || status?.created_at || '')
  if (Number.isNaN(date.getTime())) return null

  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date)
  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value

  return year && month ? `${year}-${month}` : null
}

export function groupStatusesByMonth(statuses, timeZone = ARCHIVE_TIMEZONE) {
  const groups = {}

  for (const status of statuses || []) {
    const month = getStatusMonth(status, timeZone)
    if (!month) {
      throw new Error(`Status ${status?.id || 'unknown'} has an invalid creation time`)
    }

    if (!groups[month]) groups[month] = []
    groups[month].push(status)
  }

  return Object.keys(groups)
    .sort()
    .reduce((sortedGroups, month) => {
      sortedGroups[month] = groups[month].sort(compareStatusesNewestFirst)
      return sortedGroups
    }, {})
}
