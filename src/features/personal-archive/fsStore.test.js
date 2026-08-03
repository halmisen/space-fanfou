/* eslint camelcase: off */

import createFileSystemArchiveStore from './fsStore'
import { normalizeStatus } from './statusRecords'

function createMemoryDirectoryHandle(events, path = '', failures = new Set()) {
  const files = new Map()
  const directories = new Map()

  return {
    kind: 'directory',
    name: path || 'archive',

    getDirectoryHandle(name, { create = false } = {}) {
      if (!directories.has(name)) {
        if (!create) throw Object.assign(new Error('not found'), { name: 'NotFoundError' })
        directories.set(name, createMemoryDirectoryHandle(
          events,
          path ? `${path}/${name}` : name,
          failures,
        ))
      }
      return Promise.resolve(directories.get(name))
    },

    getFileHandle(name, { create = false } = {}) {
      if (!files.has(name)) {
        if (!create) throw Object.assign(new Error('not found'), { name: 'NotFoundError' })
        let content = ''
        files.set(name, {
          kind: 'file',
          name,
          createWritable() {
            let nextContent = ''
            return Promise.resolve({
              write(value) {
                nextContent = String(value)
                return Promise.resolve()
              },
              close() {
                const filePath = path ? `${path}/${name}` : name
                if (failures.has(filePath)) {
                  return Promise.reject(new Error(`injected close failure: ${filePath}`))
                }
                content = nextContent
                events.push(`close:${filePath}`)
                return Promise.resolve()
              },
              abort() {
                return Promise.resolve()
              },
            })
          },
          getFile() {
            return Promise.resolve({
              size: content.length,
              text() {
                return Promise.resolve(content)
              },
            })
          },
        })
      }
      return Promise.resolve(files.get(name))
    },
  }
}

function rawStatus(id, createdAt, text) {
  return {
    id,
    created_at: createdAt,
    text,
    user: { id: 'me', screen_name: 'me', name: 'Me' },
  }
}

test('a committed page closes every affected month shard before advancing meta', async () => {
  const events = []
  const rootHandle = createMemoryDirectoryHandle(events)
  const store = createFileSystemArchiveStore(rootHandle)
  const options = {
    account: { id: 'me' },
    archiveSource: 'ownTimeline',
    archivedAt: '2026-07-31T13:00:00.000Z',
  }
  const statuses = [
    normalizeStatus(rawStatus('2', 'Fri Jul 31 12:00:00 +0000 2026', '七月'), options),
    normalizeStatus(rawStatus('1', 'Tue Jun 30 15:59:00 +0000 2026', '六月'), options),
  ]

  const committedMeta = await store.commitStatusPage({
    statuses,
    meta: {
      schemaVersion: 1,
      archiveTimezone: 'Asia/Shanghai',
      account: { id: 'me', name: 'Me' },
      watermark: {
        statuses: {
          newestId: '2',
          oldestId: '1',
          nextMaxId: '1',
          reachedFirstEver: false,
        },
      },
      shards: { statuses: {} },
      counts: { statuses: 0 },
    },
  })

  expect(events).toEqual([
    'close:statuses/2026-06.json',
    'close:statuses/2026-07.json',
    'close:meta.json',
  ])
  expect((await store.readStatusMonth('2026-06')).map(item => item.id)).toEqual([ '1' ])
  expect((await store.readStatusMonth('2026-07')).map(item => item.id)).toEqual([ '2' ])
  expect(await store.readMeta()).toEqual(committedMeta)
  expect(committedMeta.counts.statuses).toBe(2)
  expect(committedMeta.shards.statuses).toEqual({
    '2026-06': { count: 1, newestId: '1', oldestId: '1' },
    '2026-07': { count: 1, newestId: '2', oldestId: '2' },
  })
})

test('a failed meta close leaves the shard recoverable and retry remains idempotent', async () => {
  const events = []
  const failures = new Set([ 'meta.json' ])
  const rootHandle = createMemoryDirectoryHandle(events, '', failures)
  const store = createFileSystemArchiveStore(rootHandle)
  const statuses = [
    normalizeStatus(rawStatus('1', 'Fri Jul 31 12:00:00 +0000 2026', '一次'), {
      account: { id: 'me' },
      archiveSource: 'ownTimeline',
      archivedAt: '2026-07-31T13:00:00.000Z',
    }),
  ]
  const pendingMeta = {
    schemaVersion: 1,
    archiveTimezone: 'Asia/Shanghai',
    account: { id: 'me', name: 'Me' },
    watermark: {
      statuses: {
        newestId: '1',
        oldestId: '1',
        nextMaxId: '1',
        reachedFirstEver: false,
      },
    },
    shards: { statuses: {} },
    counts: { statuses: 0 },
  }

  await expect(store.commitStatusPage({ statuses, meta: pendingMeta }))
    .rejects.toThrow('injected close failure: meta.json')
  expect((await store.readStatusMonth('2026-07')).map(item => item.id)).toEqual([ '1' ])
  expect(await store.readMeta()).toBeNull()

  failures.clear()
  const committedMeta = await store.commitStatusPage({ statuses, meta: pendingMeta })

  expect(committedMeta.counts.statuses).toBe(1)
  expect(committedMeta.shards.statuses['2026-07'].count).toBe(1)
  expect(events).toEqual([
    'close:statuses/2026-07.json',
    'close:statuses/2026-07.json',
    'close:meta.json',
  ])
})

test('a status with an invalid creation time is rejected instead of silently skipped', async () => {
  const rootHandle = createMemoryDirectoryHandle([])
  const store = createFileSystemArchiveStore(rootHandle)
  const status = normalizeStatus(rawStatus('broken', 'not-a-date', '坏时间'), {
    account: { id: 'me' },
    archiveSource: 'ownTimeline',
    archivedAt: '2026-07-31T13:00:00.000Z',
  })

  await expect(store.commitStatusPage({
    statuses: [ status ],
    meta: {
      archiveTimezone: 'Asia/Shanghai',
      shards: { statuses: {} },
      counts: { statuses: 0 },
    },
  })).rejects.toThrow('Status broken has an invalid creation time')
})
