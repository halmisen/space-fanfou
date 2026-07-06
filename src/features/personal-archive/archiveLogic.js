/* eslint camelcase: off */

const STOP_WORDS = new Set([
  '一个',
  '一些',
  '不是',
  '什么',
  '今天',
  '但是',
  '可以',
  '还是',
  '没有',
  '真的',
  '这个',
  '那个',
  '自己',
  '因为',
  '所以',
  'the',
  'and',
  'for',
  'http',
  'https',
])

export const EMPTY_ARCHIVE = {
  schemaVersion: 1,
  account: null,
  statuses: {},
  favorites: {},
  mentions: {},
  replies: {},
  meta: {
    ownTimeline: null,
    favorites: null,
    mentions: null,
    replies: null,
  },
}

function parseDate(value) {
  const date = value ? new Date(value) : null

  return date && !Number.isNaN(date.getTime()) ? date : null
}

function toISO(value) {
  const date = parseDate(value)

  return date ? date.toISOString() : ''
}

function pickUser(user = {}) {
  return {
    id: user.id || '',
    screen_name: user.screen_name || user.name || '',
    name: user.name || user.screen_name || user.id || '',
    profile_image_url: user.profile_image_url || '',
  }
}

export function normalizeStatus(status, archiveSource, archivedAt = new Date().toISOString()) {
  if (!status || !status.id) return null

  return {
    id: status.id,
    rawid: status.rawid || 0,
    created_at: status.created_at || '',
    createdAtISO: toISO(status.created_at),
    text: status.text || '',
    source: status.source || '',
    favorited: !!status.favorited,
    in_reply_to_status_id: status.in_reply_to_status_id || '',
    in_reply_to_user_id: status.in_reply_to_user_id || '',
    in_reply_to_screen_name: status.in_reply_to_screen_name || '',
    repost_status_id: status.repost_status_id || '',
    repost_user_id: status.repost_user_id || '',
    repost_screen_name: status.repost_screen_name || '',
    user: pickUser(status.user),
    photo: status.photo ? {
      thumburl: status.photo.thumburl || '',
      imageurl: status.photo.imageurl || '',
      largeurl: status.photo.largeurl || '',
    } : null,
    archiveSource,
    archivedAt,
  }
}

export function createArchive(account) {
  return {
    ...EMPTY_ARCHIVE,
    account: account || null,
    statuses: {},
    favorites: {},
    mentions: {},
    replies: {},
    meta: { ...EMPTY_ARCHIVE.meta },
  }
}

export function mergeStatuses(archive, sourceName, rawStatuses, account) {
  const nextArchive = archive?.schemaVersion
    ? { ...archive }
    : createArchive(account)
  const sourceKey = sourceName === 'ownTimeline' ? 'statuses' : sourceName
  const target = { ...(nextArchive[sourceKey] || {}) }
  const now = new Date().toISOString()
  let importedCount = 0
  let skippedCount = 0
  let newestCreatedAt = ''
  let oldestCreatedAt = ''

  for (const rawStatus of rawStatuses || []) {
    const normalized = normalizeStatus(rawStatus, sourceName, now)

    if (!normalized) {
      skippedCount++
      continue
    }

    if (!target[normalized.id]) importedCount++

    target[normalized.id] = {
      ...target[normalized.id],
      ...normalized,
    }

    if (!newestCreatedAt || normalized.createdAtISO > newestCreatedAt) {
      newestCreatedAt = normalized.createdAtISO
    }

    if (!oldestCreatedAt || normalized.createdAtISO < oldestCreatedAt) {
      oldestCreatedAt = normalized.createdAtISO
    }
  }

  nextArchive[sourceKey] = target
  nextArchive.account = account || nextArchive.account || null
  nextArchive.meta = {
    ...(nextArchive.meta || {}),
    [sourceName]: {
      lastSyncAt: now,
      newestCreatedAt,
      oldestCreatedAt,
      count: Object.keys(target).length,
    },
  }

  return {
    archive: nextArchive,
    importedCount,
    skippedCount,
    totalCount: Object.keys(target).length,
  }
}

export function getStatusList(archive, key = 'statuses') {
  return Object.values(archive?.[key] || {})
    .sort((a, b) => (b.createdAtISO || '').localeCompare(a.createdAtISO || ''))
}

function isWithinRange(status, startDate, endDate) {
  const date = parseDate(status.createdAtISO || status.created_at)

  if (!date) return false

  return date >= startDate && date <= endDate
}

function getPastYearRange(now = new Date()) {
  const endDate = new Date(now)
  const startDate = new Date(now)

  startDate.setDate(startDate.getDate() - 365)

  return { startDate, endDate }
}

export function computePastYearStats(archive, now = new Date()) {
  const { startDate, endDate } = getPastYearRange(now)
  const statuses = getStatusList(archive)
    .filter(status => isWithinRange(status, startDate, endDate))
  const monthlyCounts = {}

  for (const status of statuses) {
    const month = (status.createdAtISO || '').slice(0, 7) || 'unknown'

    monthlyCounts[month] = (monthlyCounts[month] || 0) + 1
  }

  return {
    range: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    total: statuses.length,
    textOnly: statuses.filter(status => !status.photo).length,
    photo: statuses.filter(status => !!status.photo).length,
    replies: statuses.filter(status => !!status.in_reply_to_user_id).length,
    reposts: statuses.filter(status => !!status.repost_user_id).length,
    monthlyCounts,
  }
}

function cleanText(text) {
  return String(text || '')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/@\S+/g, ' ')
    .replace(/[^\u3400-\u9FA5a-zA-Z0-9#_\s]/g, ' ')
    .toLowerCase()
}

function extractTokensFromText(text) {
  const cleaned = cleanText(text)
  const tokens = []
  const explicitTokens = cleaned.match(/#[^#\s]{2,}|[a-z0-9_]{2,}/g) || []
  const chineseChunks = cleaned.match(/[\u3400-\u9FA5]{2,}/g) || []

  tokens.push(...explicitTokens.map(token => token.replace(/^#/, '')))

  for (const chunk of chineseChunks) {
    for (let size = 2; size <= 4; size++) {
      for (let index = 0; index <= chunk.length - size; index++) {
        tokens.push(chunk.slice(index, index + size))
      }
    }
  }

  return tokens.filter(token => token.length >= 2 && !STOP_WORDS.has(token))
}

export function computeTopKeywords(archive, { limit = 20, now = new Date(), pastYearOnly = true } = {}) {
  const { startDate, endDate } = getPastYearRange(now)
  const counts = {}
  let sourceCount = 0

  for (const status of getStatusList(archive)) {
    if (pastYearOnly && !isWithinRange(status, startDate, endDate)) continue
    sourceCount++

    for (const token of extractTokensFromText(status.text)) {
      counts[token] = (counts[token] || 0) + 1
    }
  }

  return {
    sourceCount,
    keywords: Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([ keyword, count ]) => ({ keyword, count })),
  }
}

function addInteraction(scores, user, signal, weight) {
  if (!user?.id) return

  if (!scores[user.id]) {
    scores[user.id] = {
      user: pickUser(user),
      score: 0,
      signals: {
        repliesByMe: 0,
        repostsByMe: 0,
        mentionsMe: 0,
        repliesToMe: 0,
        favoritesByMe: 0,
      },
    }
  }

  scores[user.id].score += weight
  scores[user.id].signals[signal] += 1
}

export function computeTopInteractions(archive, limit = 10) {
  const scores = {}

  for (const status of getStatusList(archive)) {
    addInteraction(scores, {
      id: status.in_reply_to_user_id,
      name: status.in_reply_to_screen_name,
      screen_name: status.in_reply_to_screen_name,
    }, 'repliesByMe', 3)
    addInteraction(scores, {
      id: status.repost_user_id,
      name: status.repost_screen_name,
      screen_name: status.repost_screen_name,
    }, 'repostsByMe', 2)
  }

  for (const status of getStatusList(archive, 'mentions')) {
    addInteraction(scores, status.user, 'mentionsMe', 2)
  }

  for (const status of getStatusList(archive, 'replies')) {
    addInteraction(scores, status.user, 'repliesToMe', 3)
  }

  for (const status of getStatusList(archive, 'favorites')) {
    addInteraction(scores, status.user, 'favoritesByMe', 1)
  }

  return Object.values(scores)
    .sort((a, b) => b.score - a.score || a.user.id.localeCompare(b.user.id))
    .slice(0, limit)
}

function formatDateForMarkdown(value) {
  const date = parseDate(value)

  if (!date) return '未知时间'

  return date.toISOString().replace('T', ' ').slice(0, 16)
}

export function getPhotoUrlsFromStatuses(statuses) {
  const urls = []
  const seen = new Set()

  for (const status of statuses || []) {
    const photo = status.photo || {}
    const url = photo.largeurl || photo.imageurl || photo.thumburl

    if (url && !seen.has(url)) {
      seen.add(url)
      urls.push({
        statusId: status.id,
        url,
      })
    }
  }

  return urls
}

export function buildFavoritesMarkdown(archive, generatedAt = new Date().toISOString()) {
  const favorites = getStatusList(archive, 'favorites')
  const account = archive?.account?.screenName || archive?.account?.id || 'unknown'
  const lines = [
    '# Fanfou Favorites Export',
    '',
    `Generated: ${generatedAt}`,
    `Account: @${account}`,
    `Count: ${favorites.length}`,
    '',
  ]
  let currentMonth = ''

  for (const status of favorites) {
    const month = (status.createdAtISO || '').slice(0, 7) || 'unknown'
    const author = status.user?.screen_name || status.user?.name || status.user?.id || 'unknown'

    if (month !== currentMonth) {
      currentMonth = month
      lines.push(`## ${currentMonth}`, '')
    }

    lines.push(`### ${formatDateForMarkdown(status.createdAtISO)} - @${author}`)
    lines.push('')
    lines.push(`Status URL: https://fanfou.com/statuses/${status.id}`)
    lines.push('')
    lines.push(status.text || '')
    lines.push('')

    if (status.photo) {
      const url = status.photo.largeurl || status.photo.imageurl || status.photo.thumburl

      if (url) {
        lines.push(`![photo](${url})`)
        lines.push('')
      }
    }
  }

  return lines.join('\n')
}

export function buildExportPayload(archive) {
  return {
    exportedAt: new Date().toISOString(),
    executor: 'space-fanfou',
    archive: archive || createArchive(),
  }
}
