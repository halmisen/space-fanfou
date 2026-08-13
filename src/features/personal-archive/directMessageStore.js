import {
  conversationFileKey,
  getConversationUserId,
  mergeDirectMessages,
} from './directMessageRecords'

const INDEX_PATH = 'direct-messages/index.json'

function emptyIndex() {
  return { schemaVersion: 1, conversations: [] }
}

function indexConversation(index, conversation, otherUserId, messageCount) {
  const key = conversationFileKey(otherUserId)
  const existing = index.conversations.find(item => item.key === key)
  const summary = {
    key,
    otherUserId,
    name: conversation?.name || conversation?.screen_name || existing?.name || '',
    messageCount,
  }

  return {
    ...index,
    conversations: existing
      ? index.conversations.map(item => (item.key === key ? summary : item))
      : [ ...index.conversations, summary ],
  }
}

export default function createDirectMessageStore(store) {
  async function readIndex() {
    const index = await store.readJsonFileAt(INDEX_PATH, emptyIndex())
    return Array.isArray(index?.conversations) ? index : emptyIndex()
  }

  async function commitConversationPage({ account, conversation, rawMessages, meta, archivedAt }) {
    const otherUserId = getConversationUserId(conversation)
    if (!otherUserId) throw new TypeError('私信对话列表缺少 otherid')
    const key = conversationFileKey(otherUserId)
    const path = `direct-messages/${key}.json`
    const existing = await store.readJsonFileAt(path, [])
    const merged = mergeDirectMessages(existing, rawMessages, {
      account,
      conversationId: otherUserId,
      archivedAt,
    })
    await store.writeJsonFileAt(path, merged.statuses)

    const index = indexConversation(await readIndex(), conversation, otherUserId, merged.statuses.length)
    await store.writeJsonFileAt(INDEX_PATH, index)
    const count = index.conversations.reduce((total, item) => total + (item.messageCount || 0), 0)
    const committedMeta = {
      ...meta,
      counts: { ...(meta.counts || {}), directMessages: count },
      directMessages: {
        ...(meta.directMessages || {}),
        conversationCount: index.conversations.length,
      },
    }
    await store.writeMeta(committedMeta)
    return { meta: committedMeta, importedCount: merged.importedCount }
  }

  async function readAllDirectMessages() {
    const index = await readIndex()
    const messages = []
    for (const conversation of index.conversations) {
      messages.push(...await store.readJsonFileAt(`direct-messages/${conversation.key}.json`, []))
    }
    return messages
  }

  return { commitConversationPage, readAllDirectMessages, readIndex }
}
