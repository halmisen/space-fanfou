/* eslint camelcase: off */

import downloadArchiveMedia, {
  listAvailableMedia,
  pickExtension,
} from './mediaDownloader'

function createMemoryStore(existingFiles = []) {
  const files = new Map(existingFiles.map(path => [ path, new ArrayBuffer(1) ]))
  let meta = { archiveTimezone: 'Asia/Shanghai' }

  return {
    files,
    getMeta: () => meta,
    fileExists: path => Promise.resolve(files.has(path)),
    writeBinaryFile: (path, buffer) => {
      files.set(path, buffer)
      return Promise.resolve()
    },
    writeMeta: value => {
      meta = value
      return Promise.resolve()
    },
  }
}

function createResponse(contentType = 'image/jpeg') {
  return {
    ok: true,
    status: 200,
    headers: { get: name => (name.toLowerCase() === 'content-type' ? contentType : null) },
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  }
}

function status(overrides = {}) {
  return {
    id: 'abc',
    created_at: 'Sat Jun 30 15:12:03 +0000 2012',
    text: '正文',
    user: {
      id: 'kiruoto',
      name: '断电模式',
      profile_image_url: 'https://s3.meituan.net/v1/avatar/s0/8p.jpg',
    },
    photo: {
      url: 'http://fanfou.com/photo/kMXL8LtnlEc',
      largeurl: 'https://s3-img.meituan.net/x/eg.jpg@596w_1l.jpg',
    },
    ...overrides,
  }
}

const noSleep = () => Promise.resolve()
const clock = () => new Date('2026-07-31T16:00:00.000Z')

test('content type decides the extension and unknown types fall back to jpg', () => {
  expect(pickExtension('image/png')).toBe('.png')
  expect(pickExtension('image/jpeg; charset=binary')).toBe('.jpg')
  expect(pickExtension(undefined)).toBe('.jpg')
  expect(pickExtension('application/octet-stream')).toBe('.jpg')
})

test('photos and avatars land under their relative paths and meta records the run', async () => {
  const store = createMemoryStore()
  const result = await downloadArchiveMedia({
    statuses: [ status() ],
    store,
    meta: { archiveTimezone: 'Asia/Shanghai' },
    fetchMedia: () => Promise.resolve(createResponse('image/png')),
    sleep: noSleep,
    clock,
  })

  expect([ ...store.files.keys() ]).toEqual([
    'photos/2012-06/abc.png',
    'avatars/kiruoto.png',
  ])
  expect(result.status).toBe('completed')
  expect(result.downloaded).toBe(2)
  expect(store.getMeta().mediaSyncedAt).toBe('2026-07-31T16:00:00.000Z')
})

test('a second run skips every file already on disk', async () => {
  const store = createMemoryStore([ 'photos/2012-06/abc.jpg', 'avatars/kiruoto.jpg' ])
  const fetchMedia = jest.fn(() => Promise.resolve(createResponse()))

  const result = await downloadArchiveMedia({
    statuses: [ status() ],
    store,
    meta: { archiveTimezone: 'Asia/Shanghai' },
    fetchMedia,
    sleep: noSleep,
    clock,
  })

  expect(fetchMedia).not.toHaveBeenCalled()
  expect(result.downloaded).toBe(0)
  expect(result.skippedExisting).toBe(2)
})

test('one failed image does not stop the rest and is recorded in meta', async () => {
  const store = createMemoryStore()
  const fetchMedia = url => (
    url.includes('s3-img')
      ? Promise.resolve({ ok: false, status: 404 })
      : Promise.resolve(createResponse())
  )

  const result = await downloadArchiveMedia({
    statuses: [ status() ],
    store,
    meta: { archiveTimezone: 'Asia/Shanghai' },
    fetchMedia,
    sleep: noSleep,
    clock,
  })

  expect([ ...store.files.keys() ]).toEqual([ 'avatars/kiruoto.jpg' ])
  expect(result.failures).toEqual([ {
    url: 'https://s3-img.meituan.net/x/eg.jpg@596w_1l.jpg',
    path: 'photos/2012-06/abc',
    reason: 'HTTP 404',
    failedAt: '2026-07-31T16:00:00.000Z',
  } ])
  expect(store.getMeta().photoFailures).toHaveLength(1)
})

test('an unlisted host is never fetched and surfaces as a per-host tally', async () => {
  const store = createMemoryStore()
  const fetchMedia = jest.fn(() => Promise.resolve(createResponse()))

  const result = await downloadArchiveMedia({
    statuses: [ status({
      photo: { url: 'http://fanfou.com/photo/x', largeurl: 'https://old.cdn.example/x.jpg' },
    }) ],
    store,
    meta: { archiveTimezone: 'Asia/Shanghai' },
    fetchMedia,
    sleep: noSleep,
    clock,
  })

  expect(fetchMedia).toHaveBeenCalledTimes(1)
  expect(fetchMedia.mock.calls[0][0]).toContain('s3.meituan.net')
  expect(result.skippedByHost).toEqual({ 'old.cdn.example': 1 })
  expect(store.getMeta().mediaSkipped).toEqual({ 'old.cdn.example': 1 })
})

test('pausing stops at an item boundary and reports paused', async () => {
  const store = createMemoryStore()
  let calls = 0
  const result = await downloadArchiveMedia({
    statuses: [ status() ],
    store,
    meta: { archiveTimezone: 'Asia/Shanghai' },
    fetchMedia: () => {
      calls += 1
      return Promise.resolve(createResponse())
    },
    sleep: noSleep,
    clock,
    shouldPause: () => calls >= 1,
  })

  expect(result.status).toBe('paused')
  expect(result.downloaded).toBe(1)
})

test('available media only lists files that really exist on disk', async () => {
  const store = createMemoryStore([ 'avatars/kiruoto.jpg' ])
  const available = await listAvailableMedia([ status() ], store, {
    archiveTimezone: 'Asia/Shanghai',
  })

  expect([ ...available.entries() ]).toEqual([
    [ 'avatars/kiruoto', 'avatars/kiruoto.jpg' ],
  ])
})
