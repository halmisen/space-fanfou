/* eslint camelcase: off */

import { buildYearView, listArchiveYears, topKeywords } from './nostalgiaView'

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
