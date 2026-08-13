/* eslint camelcase: off */

import {
  buildYearView,
  listArchiveYears,
  topKeywords,
  topMentionedUsers,
} from './nostalgiaView'

const statuses = [
  { id: '1', created_at: '2024-01-02T13:00:00.000Z', text: '饭否 真好 饭否' },
  { id: '2', created_at: '2024-12-01T01:00:00.000Z', text: '朋友 真好' },
]

test('sidebar years are derived from status shard metadata only', () => {
  expect(listArchiveYears({ shards: { statuses: {
    '2024-01': { count: 3 },
    '2024-02': { count: 5 },
    '2023-12': { count: 2 },
  } } })).toEqual([
    { year: '2024', count: 8 },
    { year: '2023', count: 2 },
  ])
})

test('year view is newest first and gives bounded annual statistics', () => {
  const view = buildYearView('2024', statuses)

  expect(view.statuses.map(status => status.id)).toEqual([ '2', '1' ])
  expect(view.stats.total).toBe(2)
  expect(view.stats.keywords).toEqual([
    { word: '真好', count: 2 },
    { word: '饭否', count: 2 },
    { word: '朋友', count: 1 },
  ])
  expect(view.stats.peakHour).toBe(9)
})

test('URLs and common particles do not become annual keywords', () => {
  expect(topKeywords([ { text: '我 在 https://example.com 饭否饭否' } ]))
    .toEqual([ { word: '饭否饭否', count: 1 } ])
})

test('mentions have their own ranking and do not become keywords', () => {
  const yearlyStatuses = [
    { id: '1', created_at: '2024-01-02T13:00:00.000Z', text: '@卡饭忍 今天真好，@卡饭忍' },
    { id: '2', created_at: '2024-01-03T13:00:00.000Z', text: '转@右才小呗 一起吃饭' },
  ]

  expect(topKeywords(yearlyStatuses)).toEqual([
    { word: '一起吃饭', count: 1 },
    { word: '今天真好', count: 1 },
  ])
  expect(topMentionedUsers(yearlyStatuses)).toEqual([
    { name: '卡饭忍', count: 1 },
    { name: '右才小呗', count: 1 },
  ])
})

test('deleted-message placeholders do not appear in a year view or its statistics', () => {
  const view = buildYearView('2024', [
    { id: '1', created_at: '2024-01-02T13:00:00.000Z', text: '抱歉，已删除' },
    { id: '2', created_at: '2024-01-03T13:00:00.000Z', text: '还在的消息 @卡饭忍' },
  ])

  expect(view.statuses.map(status => status.id)).toEqual([ '2' ])
  expect(view.stats.total).toBe(1)
  expect(view.stats.excludedDeleted).toBe(1)
  expect(view.stats.keywords).toEqual([ { word: '还在的消息', count: 1 } ])
  expect(view.stats.mentionedUsers).toEqual([ { name: '卡饭忍', count: 1 } ])
})

test('year view paginates statuses while keeping annual statistics whole', () => {
  const yearlyStatuses = Array.from({ length: 21 }, (unused, index) => ({
    id: String(index + 1).padStart(2, '0'),
    text: `第${index + 1}条消息`,
  }))

  const view = buildYearView('2024', yearlyStatuses, { page: 2 })

  expect(view.statuses.map(status => status.id)).toEqual([ '01' ])
  expect(view.pagination).toEqual({ page: 2, pageSize: 20, totalPages: 2 })
  expect(view.stats.total).toBe(21)
})
