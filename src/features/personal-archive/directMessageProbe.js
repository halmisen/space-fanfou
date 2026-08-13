const PAGE_SIZE = 60
const MAX_CONVERSATION_PAGES = 200

function emptyConversationListReceipt() {
  return {
    available: false,
    pagesFetched: 0,
    uniqueConversations: 0,
    reachedEmptyPage: false,
    errorCategory: null,
  }
}

function categorizeError(error) {
  if (error?.status === 401) return 'unauthorized'
  if (error?.status === 403) return 'forbidden'
  if (error?.status === 404) return 'not-found'
  if (error?.status === 429) return 'rate-limited'
  if (error?.status >= 500) return 'server-error'
  if (/network|fetch|timeout/i.test(error?.message || '')) return 'network'
  return 'unknown'
}

function getConversationId(conversation) {
  return conversation?.otherid || conversation?.other_id || conversation?.id || null
}

function getExpectedMessageCount(conversation) {
  const value = Number(conversation?.msg_num)
  return Number.isSafeInteger(value) && value >= 0 ? value : null
}

async function probeConversation(client, conversation) {
  const otherUserId = getConversationId(conversation)
  if (!otherUserId) {
    return {
      attempted: false,
      pagesFetched: 0,
      uniqueMessages: 0,
      reachedEmptyPage: false,
      expectedMessages: null,
      matchesExpectedMessages: null,
      errorCategory: 'missing-conversation-id',
    }
  }

  const messageIds = new Set()
  let pagesFetched = 0

  try {
    for (let page = 1; page <= MAX_CONVERSATION_PAGES; page += 1) {
      const messages = await client.fetchDirectMessageConversation(otherUserId, { count: PAGE_SIZE, page })
      pagesFetched += 1
      if (messages.length === 0) {
        const expectedMessages = getExpectedMessageCount(conversation)
        return {
          attempted: true,
          pagesFetched,
          uniqueMessages: messageIds.size,
          reachedEmptyPage: true,
          expectedMessages,
          matchesExpectedMessages: expectedMessages === null ? null : expectedMessages === messageIds.size,
          errorCategory: null,
        }
      }

      const pageIds = messages.map(message => message?.id).filter(Boolean)
      if (pageIds.length !== messages.length || pageIds.every(id => messageIds.has(String(id)))) {
        return {
          attempted: true,
          pagesFetched,
          uniqueMessages: messageIds.size,
          reachedEmptyPage: false,
          expectedMessages: getExpectedMessageCount(conversation),
          matchesExpectedMessages: null,
          errorCategory: 'pagination-did-not-advance',
        }
      }
      pageIds.forEach(id => messageIds.add(String(id)))
    }
  } catch (error) {
    return {
      attempted: true,
      pagesFetched,
      uniqueMessages: messageIds.size,
      reachedEmptyPage: false,
      expectedMessages: getExpectedMessageCount(conversation),
      matchesExpectedMessages: null,
      errorCategory: categorizeError(error),
    }
  }

  return {
    attempted: true,
    pagesFetched,
    uniqueMessages: messageIds.size,
    reachedEmptyPage: false,
    expectedMessages: getExpectedMessageCount(conversation),
    matchesExpectedMessages: null,
    errorCategory: 'page-limit',
  }
}

/**
 * 这是准入探针，不是私信备份：不写磁盘、不返回会话或消息对象。
 * 只有真实 OAuth 运行收据表明边界可解释后，才允许私信进入正式归档。
 */
export default async function probeDirectMessages({ client }) {
  const conversationList = emptyConversationListReceipt()

  try {
    const conversations = await client.fetchDirectMessageConversationList({ count: PAGE_SIZE, page: 1 })
    conversationList.available = true
    conversationList.pagesFetched = 1
    conversationList.uniqueConversations = new Set(
      conversations.map(getConversationId).filter(Boolean).map(String),
    ).size
    conversationList.reachedEmptyPage = conversations.length === 0

    const receipt = {
      status: 'completed',
      conversationList,
      sampleConversation: null,
    }
    const sample = conversations.find(getConversationId)
    if (sample) receipt.sampleConversation = await probeConversation(client, sample)
    return receipt
  } catch (error) {
    conversationList.errorCategory = categorizeError(error)
    return {
      status: 'unavailable',
      conversationList,
      sampleConversation: null,
    }
  }
}
