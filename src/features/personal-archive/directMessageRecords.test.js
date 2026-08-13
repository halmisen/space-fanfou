/* eslint camelcase: off */

import {
  conversationFileKey,
  getConversationUserId,
  mergeDirectMessages,
} from './directMessageRecords'

test('conversation file keys are deterministic and cannot be path traversal', () => {
  expect(conversationFileKey('../alice')).toBe('c-..2falice')
  expect(conversationFileKey('../alice')).not.toContain('/')
  expect(getConversationUserId({ otherid: 'alice' })).toBe('alice')
  expect(getConversationUserId({ id: 'unsafe-fallback' })).toBe('')
})

test('direct messages merge by ID and keep sender as the offline author', () => {
  const options = {
    account: { id: 'me' },
    conversationId: 'alice',
    archivedAt: '2026-08-13T00:00:00.000Z',
  }
  const result = mergeDirectMessages([], [ {
    id: 'dm-1',
    created_at: 'Wed Aug 12 12:00:00 +0000 2026',
    text: 'private text',
    sender: { id: 'alice', name: 'Alice' },
  } ], options)

  expect(result.importedCount).toBe(1)
  expect(result.statuses[0]).toMatchObject({
    id: 'dm-1',
    user: { id: 'alice', name: 'Alice' },
    _archive: { archiveSource: 'directMessage', conversationId: 'alice' },
  })
  expect(mergeDirectMessages(result.statuses, result.statuses, options).importedCount).toBe(0)
})

test('a malformed direct message fails before it can be silently skipped', () => {
  expect(() => mergeDirectMessages([], [ { id: 'dm-1', created_at: 'not-a-date' } ]))
    .toThrow('私信缺少消息 ID 或创建时间')
})
