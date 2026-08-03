/* eslint camelcase: off */

import syncOwnTimeline from './sync'

function rawStatus(id, createdAt) {
  return {
    id,
    created_at: createdAt,
    text: `status ${id}`,
    user: { id: 'me', screen_name: 'me', name: 'Me' },
  }
}

test('initial backfill commits each page before advancing an exclusive max_id cursor', async () => {
  const events = []
  const pages = [
    [
      rawStatus('3', 'Fri Jul 31 12:00:00 +0000 2026'),
      rawStatus('2', 'Thu Jul 30 12:00:00 +0000 2026'),
    ],
    [
      rawStatus('1', 'Wed Jul 29 12:00:00 +0000 2026'),
    ],
    [],
  ]
  let meta = null
  const store = {
    readMeta: () => Promise.resolve(meta),
    writeMeta(value) {
      meta = value
      events.push(`write-meta:${value.watermark.statuses.reachedFirstEver}`)
      return Promise.resolve()
    },
    commitStatusPage({ statuses, meta: nextMeta }) {
      meta = nextMeta
      events.push(`commit:${statuses.map(item => item.id).join(',')}:${nextMeta.watermark.statuses.nextMaxId}`)
      return Promise.resolve(nextMeta)
    },
  }
  const fetchPage = options => {
    events.push(`fetch:${options.max_id || 'top'}`)
    return Promise.resolve(pages.shift())
  }
  const sleep = milliseconds => {
    events.push(`sleep:${milliseconds}`)
    return Promise.resolve()
  }

  const result = await syncOwnTimeline({
    account: { id: 'me', name: 'Me' },
    fetchPage,
    store,
    sleep,
    clock: () => new Date('2026-07-31T13:00:00.000Z'),
  })

  expect(events).toEqual([
    'write-meta:false',
    'fetch:top',
    'commit:3,2:2',
    'sleep:500',
    'fetch:2',
    'commit:1:1',
    'sleep:500',
    'fetch:1',
    'write-meta:true',
  ])
  expect(result.status).toBe('completed')
  expect(result.meta.activeRun).toBeNull()
  expect(result.meta.watermark.statuses).toEqual({
    newestId: '3',
    oldestId: '1',
    nextMaxId: null,
    reachedFirstEver: true,
  })
})

test('a completed archive stops incremental sync at the previous newest status', async () => {
  const events = []
  let meta = {
    schemaVersion: 1,
    archiveTimezone: 'Asia/Shanghai',
    account: { id: 'me', name: 'Me' },
    lastSyncedAt: '2026-07-30T13:00:00.000Z',
    watermark: {
      statuses: {
        newestId: '3',
        oldestId: '1',
        nextMaxId: null,
        reachedFirstEver: true,
      },
    },
    activeRun: null,
    shards: {
      statuses: {
        '2026-07': { count: 3, newestId: '3', oldestId: '1' },
      },
    },
    counts: { statuses: 3 },
  }
  const store = {
    readMeta: () => Promise.resolve(meta),
    writeMeta(value) {
      meta = value
      events.push(`write-meta:${value.activeRun?.mode || 'finished'}`)
      return Promise.resolve()
    },
    commitStatusPage({ statuses, meta: nextMeta }) {
      meta = nextMeta
      events.push(`commit:${statuses.map(item => item.id).join(',')}`)
      return Promise.resolve(nextMeta)
    },
  }
  const fetchPage = options => {
    events.push(`fetch:${options.max_id || 'top'}`)
    return Promise.resolve([
      rawStatus('5', 'Sun Aug 02 12:00:00 +0000 2026'),
      rawStatus('4', 'Sat Aug 01 12:00:00 +0000 2026'),
      rawStatus('3', 'Fri Jul 31 12:00:00 +0000 2026'),
      rawStatus('2', 'Thu Jul 30 12:00:00 +0000 2026'),
    ])
  }

  const result = await syncOwnTimeline({
    account: { id: 'me', name: 'Me' },
    fetchPage,
    store,
    sleep: () => Promise.resolve(),
    clock: () => new Date('2026-08-02T13:00:00.000Z'),
  })

  expect(events).toEqual([
    'write-meta:incremental',
    'fetch:top',
    'commit:5,4',
  ])
  expect(result.status).toBe('completed')
  expect(result.meta.activeRun).toBeNull()
  expect(result.meta.watermark.statuses).toEqual({
    newestId: '5',
    oldestId: '1',
    nextMaxId: null,
    reachedFirstEver: true,
  })
})

test('incremental sync keeps the first new id when the stop anchor is on a later page', async () => {
  let meta = {
    schemaVersion: 1,
    archiveTimezone: 'Asia/Shanghai',
    account: { id: 'me', name: 'Me' },
    lastSyncedAt: '2026-07-30T13:00:00.000Z',
    watermark: {
      statuses: {
        newestId: '1',
        oldestId: '0',
        nextMaxId: null,
        reachedFirstEver: true,
      },
    },
    activeRun: null,
    shards: { statuses: {} },
    counts: { statuses: 2 },
  }
  const pages = [
    [
      rawStatus('5', 'Sun Aug 02 12:00:00 +0000 2026'),
      rawStatus('4', 'Sat Aug 01 12:00:00 +0000 2026'),
    ],
    [
      rawStatus('3', 'Fri Jul 31 12:00:00 +0000 2026'),
      rawStatus('2', 'Thu Jul 30 12:00:00 +0000 2026'),
      rawStatus('1', 'Wed Jul 29 12:00:00 +0000 2026'),
    ],
  ]
  const store = {
    readMeta: () => Promise.resolve(meta),
    writeMeta(value) {
      meta = value
      return Promise.resolve()
    },
    commitStatusPage({ meta: nextMeta }) {
      meta = nextMeta
      return Promise.resolve(nextMeta)
    },
  }

  const result = await syncOwnTimeline({
    account: { id: 'me', name: 'Me' },
    fetchPage: () => Promise.resolve(pages.shift()),
    store,
    sleep: () => Promise.resolve(),
    clock: () => new Date('2026-08-02T13:00:00.000Z'),
  })

  expect(result.meta.watermark.statuses.newestId).toBe('5')
})

test('an API failure preserves the last committed cursor for a later retry', async () => {
  let meta = null
  const store = {
    readMeta: () => Promise.resolve(meta),
    writeMeta(value) {
      meta = value
      return Promise.resolve()
    },
    commitStatusPage({ meta: nextMeta }) {
      meta = nextMeta
      return Promise.resolve(nextMeta)
    },
  }

  await expect(syncOwnTimeline({
    account: { id: 'me', name: 'Me' },
    fetchPage: () => Promise.reject(new Error('network interrupted')),
    store,
    sleep: () => Promise.resolve(),
    clock: () => new Date('2026-08-02T13:00:00.000Z'),
  })).rejects.toThrow('network interrupted')

  expect(meta.activeRun).toMatchObject({
    mode: 'backfill',
    nextMaxId: null,
    committedPages: 0,
  })
  expect(meta.watermark.statuses.nextMaxId).toBeNull()
})

test('a malformed API item cannot be skipped while its page cursor advances', async () => {
  let meta = null
  const store = {
    readMeta: () => Promise.resolve(meta),
    writeMeta(value) {
      meta = value
      return Promise.resolve()
    },
    commitStatusPage: () => Promise.reject(new Error('must not commit')),
  }

  await expect(syncOwnTimeline({
    account: { id: 'me', name: 'Me' },
    fetchPage: () => Promise.resolve([
      rawStatus('2', 'Fri Jul 31 12:00:00 +0000 2026'),
      { created_at: 'Thu Jul 30 12:00:00 +0000 2026', text: 'missing id' },
      rawStatus('1', 'Wed Jul 29 12:00:00 +0000 2026'),
    ]),
    store,
    sleep: () => Promise.resolve(),
    clock: () => new Date('2026-08-02T13:00:00.000Z'),
  })).rejects.toThrow('Timeline status is missing an id')

  expect(meta.activeRun.nextMaxId).toBeNull()
  expect(meta.watermark.statuses.nextMaxId).toBeNull()
})

test('a paused run resumes from the last page that was committed to disk', async () => {
  let meta = null
  let committedPages = 0
  const queries = []
  const store = {
    readMeta: () => Promise.resolve(meta),
    writeMeta(value) {
      meta = value
      return Promise.resolve()
    },
    commitStatusPage({ meta: nextMeta }) {
      meta = nextMeta
      committedPages += 1
      return Promise.resolve(nextMeta)
    },
  }

  const paused = await syncOwnTimeline({
    account: { id: 'me', name: 'Me' },
    fetchPage(query) {
      queries.push(query)
      return Promise.resolve([
        rawStatus('3', 'Fri Jul 31 12:00:00 +0000 2026'),
        rawStatus('2', 'Thu Jul 30 12:00:00 +0000 2026'),
      ])
    },
    store,
    sleep: () => Promise.resolve(),
    shouldPause: () => committedPages === 1,
    clock: () => new Date('2026-08-02T13:00:00.000Z'),
  })

  expect(paused.status).toBe('paused')
  expect(meta.activeRun.nextMaxId).toBe('2')

  const resumed = await syncOwnTimeline({
    account: { id: 'me', name: 'Me' },
    fetchPage(query) {
      queries.push(query)
      return Promise.resolve([])
    },
    store,
    sleep: () => Promise.resolve(),
    clock: () => new Date('2026-08-02T13:01:00.000Z'),
  })

  expect(queries).toEqual([
    { count: 60 },
    { count: 60, max_id: '2' },
  ])
  expect(resumed.status).toBe('completed')
})
