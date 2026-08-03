/* eslint camelcase: off */

import { mergeStatusLists, groupStatusesByMonth } from './statusRecords'

const account = {
  id: 'me',
  screenName: 'me',
}

function status(overrides) {
  return {
    id: overrides.id,
    created_at: overrides.created_at,
    text: overrides.text || '',
    user: {
      id: 'me',
      screen_name: 'me',
      name: 'Me',
    },
    ...overrides,
  }
}

test('duplicate timeline statuses update in place and stay in natural-month shards', () => {
  const existing = [
    status({
      id: '2',
      created_at: 'Fri Jul 31 12:00:00 +0000 2026',
      text: '旧内容',
    }),
  ]
  const page = [
    status({
      id: '2',
      created_at: 'Fri Jul 31 12:00:00 +0000 2026',
      text: '更新后的内容',
    }),
    status({
      id: '1',
      created_at: 'Tue Jun 30 15:59:00 +0000 2026',
      text: '六月消息',
      raw_extra: { preserved: true },
    }),
  ]

  const merged = mergeStatusLists(existing, page, {
    account,
    archiveSource: 'ownTimeline',
    archivedAt: '2026-07-31T13:00:00.000Z',
  })
  const shards = groupStatusesByMonth(merged.statuses)

  expect(merged.importedCount).toBe(1)
  expect(merged.statuses.map(item => item.id)).toEqual([ '2', '1' ])
  expect(merged.statuses[0].text).toBe('更新后的内容')
  expect(Object.keys(shards)).toEqual([ '2026-06', '2026-07' ])
  expect(shards['2026-06'].map(item => item.id)).toEqual([ '1' ])
  expect(shards['2026-07'].map(item => item.id)).toEqual([ '2' ])
  expect(shards['2026-06'][0].raw_extra).toEqual({ preserved: true })
  expect(shards['2026-07'][0]._archive).toEqual({
    accountId: 'me',
    archiveSource: 'ownTimeline',
    archivedAt: '2026-07-31T13:00:00.000Z',
    createdAtISO: '2026-07-31T12:00:00.000Z',
  })
})
