/* eslint camelcase: off */

import syncDirectMessages from './directMessageSync'

jest.mock('./directMessageStore', () => jest.fn())

import createDirectMessageStore from './directMessageStore'

function conversation(otherid) {
  return { otherid, name: `name-${otherid}` }
}

function message(id) {
  return { id, created_at: 'Wed Aug 12 12:00:00 +0000 2026', text: `private-${id}` }
}

test('direct-message sync commits each conversation page before its resume point advances', async () => {
  let meta = null
  const events = []
  const client = {
    fetchDirectMessageConversationList: jest.fn()
      .mockResolvedValueOnce([ conversation('a'), conversation('b') ])
      .mockResolvedValueOnce([]),
    fetchDirectMessageConversation: jest.fn()
      .mockResolvedValueOnce([ message('a1') ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([ message('b1') ])
      .mockResolvedValueOnce([]),
  }
  createDirectMessageStore.mockReturnValue({
    commitConversationPage({ meta: pendingMeta, rawMessages }) {
      events.push(`commit:${rawMessages[0].id}:${pendingMeta.activeRun.nextConversationId}:${pendingMeta.activeRun.nextMessagePage}`)
      meta = {
        ...pendingMeta,
        counts: { directMessages: events.length },
        directMessages: { conversationCount: events.length },
      }
      return Promise.resolve({ meta })
    },
  })
  const store = {
    readMeta: () => Promise.resolve(meta),
    writeMeta(value) {
      meta = value
      return Promise.resolve()
    },
  }

  const result = await syncDirectMessages({
    account: { id: 'me' }, client, store, sleep: () => Promise.resolve(),
    clock: () => new Date('2026-08-13T00:00:00.000Z'),
  })

  expect(events).toEqual([ 'commit:a1:a:2', 'commit:b1:b:2' ])
  expect(result.status).toBe('completed')
  expect(result.meta.activeRun).toBeNull()
  expect(result.meta.counts.directMessages).toBe(2)
})

test('a conversation-list error records only its safe error message and resume state', async () => {
  let meta = null
  const failure = new Error('request unavailable')
  createDirectMessageStore.mockReturnValue({})
  const store = {
    readMeta: () => Promise.resolve(meta),
    writeMeta(value) {
      meta = value
      return Promise.resolve()
    },
  }

  await expect(syncDirectMessages({
    account: { id: 'me' },
    client: { fetchDirectMessageConversationList: () => Promise.reject(failure) },
    store,
    clock: () => new Date('2026-08-13T00:00:00.000Z'),
  })).rejects.toThrow('request unavailable')

  expect(meta.activeRun).toMatchObject({
    resource: 'directMessages',
    nextConversationId: null,
    stopReason: 'error',
    lastError: { message: 'request unavailable' },
  })
})
