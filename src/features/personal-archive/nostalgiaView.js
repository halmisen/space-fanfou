/* eslint camelcase: off */

const STOP_WORDS = new Set([
  '的', '了', '是', '我', '你', '他', '她', '它', '在', '和', '也', '都', '就', '不',
  '有', '这', '那', '一个', '什么', '怎么', '今天', '现在', '还是', '因为', '所以',
])

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
    const text = String(status?.text || '').replace(/https?:\/\/\S+/g, ' ')
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

export function buildYearView(year, statuses, timeZone = 'Asia/Shanghai') {
  const ordered = [ ...(statuses || []) ].sort(newestFirst)
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
    statuses: ordered,
    stats: {
      total: ordered.length,
      keywords: topKeywords(ordered),
      peakHour: ordered.length ? peakHour : null,
    },
  }
}
