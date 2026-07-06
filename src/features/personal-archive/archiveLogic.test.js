/* eslint camelcase: off, prefer-destructuring: off */

import {
  buildExportPayload,
  buildFavoritesMarkdown,
  computePastYearStats,
  computeTopInteractions,
  computeTopKeywords,
  createArchive,
  getPhotoUrlsFromStatuses,
  getStatusList,
  mergeStatuses,
} from './archiveLogic'

const account = {
  id: 'me',
  screenName: 'me',
}

function status(overrides) {
  return {
    id: overrides.id,
    created_at: overrides.created_at || 'Tue Jun 02 12:00:00 +0000 2026',
    text: overrides.text || '',
    user: overrides.user || {
      id: 'me',
      screen_name: 'me',
      name: 'Me',
    },
    ...overrides,
  }
}

test('mergeStatuses normalizes and deduplicates source statuses', () => {
  const first = mergeStatuses(createArchive(account), 'ownTimeline', [
    status({ id: '1', text: '今天去火星散步' }),
    status({ id: '2', text: '太空饭否很好玩' }),
  ], account)
  const second = mergeStatuses(first.archive, 'ownTimeline', [
    status({ id: '1', text: '今天去火星散步 更新' }),
  ], account)

  expect(first.importedCount).toBe(2)
  expect(second.importedCount).toBe(0)
  expect(second.totalCount).toBe(2)
  expect(second.archive.statuses['1'].text).toBe('今天去火星散步 更新')
})

test('computePastYearStats counts yearly status types and months', () => {
  const archive = mergeStatuses(createArchive(account), 'ownTimeline', [
    status({
      id: 'recent-photo',
      created_at: 'Mon May 18 08:00:00 +0000 2026',
      photo: { largeurl: 'https://example.com/photo.jpg' },
    }),
    status({
      id: 'recent-reply',
      created_at: 'Wed Jan 21 08:00:00 +0000 2026',
      in_reply_to_user_id: 'friend',
    }),
    status({
      id: 'old',
      created_at: 'Sat Jan 04 08:00:00 +0000 2020',
    }),
  ], account).archive

  const stats = computePastYearStats(archive, new Date('2026-06-08T00:00:00Z'))

  expect(stats.total).toBe(2)
  expect(stats.photo).toBe(1)
  expect(stats.textOnly).toBe(1)
  expect(stats.replies).toBe(1)
  expect(stats.monthlyCounts).toEqual({
    '2026-01': 1,
    '2026-05': 1,
  })
})

test('computeTopKeywords extracts repeated Chinese and English terms', () => {
  const archive = mergeStatuses(createArchive(account), 'ownTimeline', [
    status({ id: '1', text: '火星 归档 Space Fanfou' }),
    status({ id: '2', text: '火星 收藏 space archive' }),
  ], account).archive

  const keywords = computeTopKeywords(archive, 5).keywords

  expect(keywords.map(item => item.keyword)).toContain('火星')
  expect(keywords.map(item => item.keyword)).toContain('space')
})

test('computeTopInteractions combines replies, mentions, replies-to-me, and favorites', () => {
  let archive = mergeStatuses(createArchive(account), 'ownTimeline', [
    status({
      id: 'reply-by-me',
      in_reply_to_user_id: 'friend',
      in_reply_to_screen_name: 'friend',
    }),
  ], account).archive

  archive = mergeStatuses(archive, 'mentions', [
    status({
      id: 'mention',
      user: { id: 'friend', screen_name: 'friend', name: 'Friend' },
    }),
  ], account).archive
  archive = mergeStatuses(archive, 'replies', [
    status({
      id: 'reply-to-me',
      user: { id: 'friend', screen_name: 'friend', name: 'Friend' },
    }),
  ], account).archive
  archive = mergeStatuses(archive, 'favorites', [
    status({
      id: 'favorite',
      user: { id: 'friend', screen_name: 'friend', name: 'Friend' },
    }),
  ], account).archive

  const [ top ] = computeTopInteractions(archive)

  expect(top.user.id).toBe('friend')
  expect(top.score).toBe(9)
  expect(top.signals).toEqual({
    repliesByMe: 1,
    repostsByMe: 0,
    mentionsMe: 1,
    repliesToMe: 1,
    favoritesByMe: 1,
  })
})

test('buildFavoritesMarkdown and photo export preserve favorite references', () => {
  const archive = mergeStatuses(createArchive(account), 'favorites', [
    status({
      id: 'fav-photo',
      text: '收藏的图片',
      user: { id: 'friend', screen_name: 'friend', name: 'Friend' },
      photo: {
        thumburl: 'https://example.com/thumb.jpg',
        imageurl: 'https://example.com/image.jpg',
        largeurl: 'https://example.com/large.jpg',
      },
    }),
  ], account).archive

  const markdown = buildFavoritesMarkdown(archive, '2026-06-08T00:00:00.000Z')
  const photos = getPhotoUrlsFromStatuses(getStatusList(archive, 'favorites'))
  const payload = buildExportPayload(archive, '2026-06-08T00:00:00.000Z')

  expect(markdown).toContain('Status URL: https://fanfou.com/statuses/fav-photo')
  expect(markdown).toContain('![photo](https://example.com/large.jpg)')
  expect(photos).toEqual([
    {
      statusId: 'fav-photo',
      url: 'https://example.com/large.jpg',
    },
  ])
  expect(payload.archive).toBe(archive)
  expect(payload.executor).toBe('space-fanfou')
})
