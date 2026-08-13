/* eslint camelcase: off */

import probeDirectMessages from './directMessageProbe'

test('the read-only probe returns counts without message text or account identifiers', async () => {
  const pages = [
    [ { otherid: 'alice', msg_num: 2 } ],
    [ { id: 'm2', text: 'private text', user: { id: 'alice' } } ],
    [ { id: 'm1', text: 'more private text', user: { id: 'alice' } } ],
    [],
  ]
  const client = {
    fetchDirectMessageConversationList: jest.fn(() => Promise.resolve(pages.shift())),
    fetchDirectMessageConversation: jest.fn(() => Promise.resolve(pages.shift())),
  }

  const receipt = await probeDirectMessages({ client })

  expect(receipt).toEqual({
    status: 'completed',
    conversationList: {
      available: true,
      pagesFetched: 1,
      uniqueConversations: 1,
      reachedEmptyPage: false,
      errorCategory: null,
    },
    sampleConversation: {
      attempted: true,
      pagesFetched: 3,
      uniqueMessages: 2,
      reachedEmptyPage: true,
      expectedMessages: 2,
      matchesExpectedMessages: true,
      errorCategory: null,
    },
  })
  expect(JSON.stringify(receipt)).not.toContain('alice')
  expect(JSON.stringify(receipt)).not.toContain('private text')
  expect(client.fetchDirectMessageConversationList).toHaveBeenCalledWith({ count: 60, page: 1 })
  expect(client.fetchDirectMessageConversation).toHaveBeenNthCalledWith(1, 'alice', { count: 60, page: 1 })
})

test('an unavailable endpoint returns a safe error category without throwing its raw response', async () => {
  const client = {
    fetchDirectMessageConversationList: () => {
      const error = new Error('401 unauthorized account alice')
      error.status = 401
      return Promise.reject(error)
    },
  }

  await expect(probeDirectMessages({ client })).resolves.toEqual({
    status: 'unavailable',
    conversationList: {
      available: false,
      pagesFetched: 0,
      uniqueConversations: 0,
      reachedEmptyPage: false,
      errorCategory: 'unauthorized',
    },
    sampleConversation: null,
  })
})

test('a repeated conversation page stops safely without reporting its ids or text', async () => {
  const client = {
    fetchDirectMessageConversationList: () => Promise.resolve([ { otherid: 'alice', msg_num: 10 } ]),
    fetchDirectMessageConversation: () => Promise.resolve([ { id: 'same', text: 'private text' } ]),
  }

  const receipt = await probeDirectMessages({ client })

  expect(receipt.sampleConversation).toEqual({
    attempted: true,
    pagesFetched: 2,
    uniqueMessages: 1,
    reachedEmptyPage: false,
    expectedMessages: 10,
    matchesExpectedMessages: null,
    errorCategory: 'pagination-did-not-advance',
  })
  expect(JSON.stringify(receipt)).not.toContain('same')
  expect(JSON.stringify(receipt)).not.toContain('private text')
})

test('a conversation error returns its category without exposing the server message', async () => {
  const client = {
    fetchDirectMessageConversationList: () => Promise.resolve([ { otherid: 'alice' } ]),
    fetchDirectMessageConversation: () => Promise.reject(new Error('private text from alice')),
  }

  const receipt = await probeDirectMessages({ client })

  expect(receipt.sampleConversation.errorCategory).toBe('unknown')
  expect(JSON.stringify(receipt)).not.toContain('private text')
  expect(JSON.stringify(receipt)).not.toContain('alice')
})
