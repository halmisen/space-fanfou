/* eslint camelcase: off */

import createFanfouClient from './fanfouClient'
import {
  FANFOU_OAUTH_API_REQUEST,
  FANFOU_OAUTH_GET_STATUS,
} from '@constants/action-types'

test('the archive client reuses the authorized account and OAuth API bridge', async () => {
  const messages = []
  const messaging = {
    postMessage(message) {
      messages.push(message)
      if (message.action === FANFOU_OAUTH_GET_STATUS) {
        return Promise.resolve({
          status: { hasTokens: true, userId: 'me', screenName: 'Me' },
        })
      }
      if (message.payload.url.endsWith('/users/show.json')) {
        return Promise.resolve({
          responseJSON: { id: 'me', name: 'Me', screen_name: 'me' },
        })
      }
      return Promise.resolve({
        responseJSON: [ { id: '2' }, { id: '1' } ],
      })
    },
  }
  const client = createFanfouClient(messaging)

  expect(await client.fetchCurrentAccount()).toEqual({
    id: 'me',
    name: 'Me',
    screen_name: 'me',
  })
  expect(await client.fetchOwnTimeline({ count: 60, max_id: '2' }))
    .toEqual([ { id: '2' }, { id: '1' } ])
  expect(await client.fetchMentions({ count: 60, max_id: '2' }))
    .toEqual([ { id: '2' }, { id: '1' } ])
  expect(await client.fetchFavorites({ count: 60, max_id: '2' }))
    .toEqual([ { id: '2' }, { id: '1' } ])
  expect(await client.fetchDirectMessageConversationList({ count: 60, page: 1 }))
    .toEqual([ { id: '2' }, { id: '1' } ])
  expect(await client.fetchDirectMessageConversation('other', { count: 60, page: 1 }))
    .toEqual([ { id: '2' }, { id: '1' } ])
  expect(messages).toEqual([
    {
      action: FANFOU_OAUTH_GET_STATUS,
      payload: {},
    },
    {
      action: FANFOU_OAUTH_API_REQUEST,
      payload: {
        url: 'https://api.fanfou.com/users/show.json',
        method: 'GET',
        query: { id: 'me' },
        responseType: 'json',
      },
    },
    {
      action: FANFOU_OAUTH_API_REQUEST,
      payload: {
        url: 'https://api.fanfou.com/statuses/user_timeline.json',
        method: 'GET',
        query: { count: 60, max_id: '2' },
        responseType: 'json',
      },
    },
    {
      action: FANFOU_OAUTH_API_REQUEST,
      payload: {
        url: 'https://api.fanfou.com/statuses/mentions.json',
        method: 'GET',
        query: { count: 60, max_id: '2' },
        responseType: 'json',
      },
    },
    {
      action: FANFOU_OAUTH_API_REQUEST,
      payload: {
        url: 'https://api.fanfou.com/favorites/id.json',
        method: 'GET',
        query: { count: 60, max_id: '2' },
        responseType: 'json',
      },
    },
    {
      action: FANFOU_OAUTH_API_REQUEST,
      payload: {
        url: 'https://api.fanfou.com/direct_messages/conversation_list.json',
        method: 'GET',
        query: { count: 60, page: 1 },
        responseType: 'json',
      },
    },
    {
      action: FANFOU_OAUTH_API_REQUEST,
      payload: {
        url: 'https://api.fanfou.com/direct_messages/conversation.json',
        method: 'GET',
        query: { id: 'other', count: 60, page: 1 },
        responseType: 'json',
      },
    },
  ])
})
