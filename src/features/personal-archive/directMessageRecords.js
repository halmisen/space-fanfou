/* eslint camelcase: off */

import { mergeStatusRecords } from './statusRecords'

export function conversationFileKey(otherUserId) {
  const value = String(otherUserId || '')
  if (!value) throw new TypeError('私信会话缺少对方账号标识')

  // encodeURIComponent 会转义斜杠和非 ASCII；去掉 % 后仍是单个安全文件名。
  return `c-${encodeURIComponent(value).replace(/%/g, '').toLowerCase()}`
}

export function getConversationUserId(conversation) {
  const id = conversation?.otherid || conversation?.other_id
  return id ? String(id) : ''
}

export function normalizeDirectMessage(message, { account, conversationId, archivedAt } = {}) {
  if (!message?.id) return null
  const createdAt = new Date(message.created_at || '')
  if (Number.isNaN(createdAt.getTime())) return null

  return {
    ...message,
    // 离线阅读器使用 user 字段；私信 API 的发送者字段才是消息作者。
    user: message.sender || message.user || message.recipient || {},
    _archive: {
      accountId: account?.id || '',
      archiveSource: 'directMessage',
      archivedAt: archivedAt || new Date().toISOString(),
      createdAtISO: createdAt.toISOString(),
      conversationId: String(conversationId || ''),
    },
  }
}

export function mergeDirectMessages(existingMessages, rawMessages, options) {
  const messages = (rawMessages || [])
    .map(message => normalizeDirectMessage(message, options))
    .filter(message => message && message._archive.createdAtISO !== 'Invalid Date')

  if (messages.length !== (rawMessages || []).length) {
    throw new TypeError('私信缺少消息 ID 或创建时间')
  }

  return mergeStatusRecords(existingMessages, messages)
}
