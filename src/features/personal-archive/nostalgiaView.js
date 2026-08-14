/* eslint camelcase: off */

const STOP_WORDS = new Set([
  '的', '了', '是', '我', '你', '他', '她', '它', '在', '和', '也', '都', '就', '不',
  '有', '这', '那', '一个', '什么', '怎么', '今天', '现在', '还是', '因为', '所以',
])

const UNAVAILABLE_STATUS = /^(?:抱歉[，,]?)?(?:(?:饭友已设置仅展示[^，。！？]{0,30}饭否)(?:[，,](?:此条饭否已不可见|原贴已被删除|(?:该(?:条)?消息)?已删除))?|此条饭否已不可见|原贴已被删除|(?:该(?:条)?消息)?已删除)[。！!]?$/
const AUTO_GENERATED_STATUS = /^上传了新照片[。！!]?$/
export const YEAR_PAGE_SIZE = 20

function textOf(status) {
  return String(status?.text || '')
}

export function isUnavailableStatus(status) {
  return UNAVAILABLE_STATUS.test(textOf(status).trim())
}

function authorText(status) {
  const text = textOf(status)
  const repostText = textOf(status?.repost_status)
  const withoutNestedRepost = repostText && text.endsWith(repostText)
    ? text.slice(0, -repostText.length)
    : text
  const repostMarker = /(?:^|\s)RT(?:\s|$)|转@/i.exec(withoutNestedRepost)

  return (repostMarker
    ? withoutNestedRepost.slice(0, repostMarker.index)
    : withoutNestedRepost).trim()
}

function textWithoutUrlsAndMentions(status) {
  const text = authorText(status)
  if (AUTO_GENERATED_STATUS.test(text)) return ''

  return text
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/(?:www\.)?\b(?:[a-z0-9-]+\.)+(?:com|cn|net|org|me|cc|io|tv)(?:\/\S*)?/gi, ' ')
    .replace(/&(?:quot|amp|lt|gt|#\d+|#x[\da-f]+);/gi, ' ')
    // 年度词汇来自正文；@用户名单独进入「最常提到的饭友」。
    .replace(/@[^\s@#，。！？、:：;；,.!?()（）【】[\]<>《》]+/g, ' ')
}

function mentionedNames(status) {
  const names = new Set()
  const text = authorText(status).replace(/https?:\/\/\S+/g, ' ')
  const pattern = /@([^\s@#，。！？、:：;；,.!?()（）【】[\]<>《》]+)/g
  let match = pattern.exec(text)

  while (match) {
    names.add(match[1])
    match = pattern.exec(text)
  }

  return names
}

function createdAt(status) {
  return status?._archive?.createdAtISO || status?.created_at || ''
}

function newestFirst(a, b) {
  const difference = Date.parse(createdAt(b)) - Date.parse(createdAt(a))
  return difference || String(b.id).localeCompare(String(a.id))
}

export function listArchiveYears(meta) {
  const counts = {}

  for (const [ month, shard ] of Object.entries(meta?.shards?.statuses || {})) {
    const year = month.slice(0, 4)
    if (!/^\d{4}$/.test(year)) continue
    counts[year] = (counts[year] || 0) + (shard?.count || 0)
  }

  return Object.entries(counts)
    .map(([ year, count ]) => ({ year, count }))
    .sort((a, b) => b.year.localeCompare(a.year))
}

export function topKeywords(statuses, limit = 10) {
  const counts = new Map()

  for (const status of statuses || []) {
    if (isUnavailableStatus(status)) continue
    const text = textWithoutUrlsAndMentions(status)
    const words = text.match(/[\u4E00-\u9FFF]{2,}|[a-zA-Z][a-zA-Z0-9-]{1,}/g) || []

    for (const word of words) {
      const normalized = word.toLowerCase()
      if (STOP_WORDS.has(normalized)) continue
      counts.set(normalized, (counts.get(normalized) || 0) + 1)
    }
  }

  return [ ...counts.entries() ]
    .map(([ word, count ]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, limit)
}

export function topMentionedUsers(statuses, limit = 10) {
  const counts = new Map()

  for (const status of statuses || []) {
    if (isUnavailableStatus(status)) continue
    for (const name of mentionedNames(status)) {
      counts.set(name, (counts.get(name) || 0) + 1)
    }
  }

  return [ ...counts.entries() ]
    .map(([ name, count ]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
}

export function buildYearView(year, statuses, {
  timeZone = 'Asia/Shanghai',
  page = 1,
  pageSize = YEAR_PAGE_SIZE,
} = {}) {
  const availableStatuses = (statuses || []).filter(status => !isUnavailableStatus(status))
  const ordered = [ ...availableStatuses ].sort(newestFirst)
  const totalPages = Math.max(1, Math.ceil(ordered.length / pageSize))
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const firstStatus = (currentPage - 1) * pageSize
  const hourCounts = new Array(24).fill(0)

  for (const status of ordered) {
    const date = new Date(createdAt(status))
    if (!Number.isNaN(date.getTime())) {
      const hour = Number(new Intl.DateTimeFormat('en', {
        timeZone,
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(date))
      hourCounts[hour] += 1
    }
  }

  const peakHour = hourCounts.reduce((best, count, hour) => (
    count > hourCounts[best] ? hour : best
  ), 0)

  return {
    year: String(year),
    statuses: ordered.slice(firstStatus, firstStatus + pageSize),
    pagination: {
      page: currentPage,
      pageSize,
      totalPages,
    },
    stats: {
      total: ordered.length,
      excludedUnavailable: (statuses || []).length - ordered.length,
      keywords: topKeywords(ordered),
      mentionedUsers: topMentionedUsers(ordered),
      peakHour: ordered.length ? peakHour : null,
    },
  }
}
