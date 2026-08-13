import createDirectMessageStore from './directMessageStore'
import { getConversationUserId } from './directMessageRecords'

const PAGE_SIZE = 60
const REQUEST_INTERVAL_MS = 500

const sleepDefault = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

function startRun(meta, now) {
  if (meta?.activeRun?.resource === 'directMessages') return meta

  return {
    ...(meta || {}),
    activeRun: {
      resource: 'directMessages',
      mode: 'backfill',
      committedPages: 0,
      nextConversationId: null,
      nextMessagePage: 1,
      startedAt: now,
    },
  }
}

function stopRun(meta, reason, now, message = '') {
  return {
    ...meta,
    activeRun: {
      ...meta.activeRun,
      stopReason: reason,
      stoppedAt: now,
      lastError: message ? { message } : null,
    },
  }
}

function finishRun(meta, now) {
  return {
    ...meta,
    activeRun: null,
    lastSyncedAtByResource: { ...(meta.lastSyncedAtByResource || {}), directMessages: now },
  }
}

async function fetchConversationList(client) {
  const conversations = []
  const seen = new Set()

  for (let page = 1; page <= 200; page += 1) {
    const items = await client.fetchDirectMessageConversationList({ count: PAGE_SIZE, page })
    if (!items.length) return conversations

    let newCount = 0
    for (const item of items) {
      const id = getConversationUserId(item)
      if (!id) throw new TypeError('私信对话列表缺少 otherid')
      if (!seen.has(id)) {
        seen.add(id)
        conversations.push(item)
        newCount += 1
      }
    }
    if (!newCount) throw new Error('私信对话列表分页没有前进')
  }

  throw new Error('私信对话列表超过 200 页，已安全停止')
}

/**
 * 对话逐个、页面逐页提交。重跑只会按消息 ID 合并，绝不重复写入。
 * 私信正文不会出现在 progress 或错误文本里。
 */
export default async function syncDirectMessages({
  account,
  client,
  store,
  sleep = sleepDefault,
  clock = () => new Date(),
  shouldPause = () => false,
  onProgress = () => undefined,
}) {
  const dmStore = createDirectMessageStore(store)
  let meta = startRun(await store.readMeta(), clock().toISOString())
  await store.writeMeta(meta)

  try {
    const conversations = await fetchConversationList(client)
    const resumeId = meta.activeRun.nextConversationId
    let resumeFound = !resumeId

    for (const conversation of conversations) {
      const otherUserId = getConversationUserId(conversation)
      if (!resumeFound) {
        if (otherUserId !== resumeId) continue
        resumeFound = true
      }
      let pageNumber = otherUserId === resumeId ? meta.activeRun.nextMessagePage || 1 : 1

      while (true) {
        if (shouldPause()) {
          meta = stopRun(meta, 'paused', clock().toISOString())
          await store.writeMeta(meta)
          return { status: 'paused', meta }
        }

        const { rawMessages } = { rawMessages: await client.fetchDirectMessageConversation(otherUserId, {
          count: PAGE_SIZE,
          page: pageNumber,
        }) }
        if (!rawMessages.length) break

        const { meta: committedMeta } = await dmStore.commitConversationPage({
          account,
          conversation,
          rawMessages,
          meta: {
            ...meta,
            activeRun: {
              ...meta.activeRun,
              committedPages: (meta.activeRun.committedPages || 0) + 1,
              nextConversationId: otherUserId,
              nextMessagePage: pageNumber + 1,
            },
          },
          archivedAt: clock().toISOString(),
        })
        meta = committedMeta
        onProgress({
          status: 'running',
          committedPages: meta.activeRun.committedPages,
          count: meta.counts.directMessages || 0,
          conversationCount: meta.directMessages.conversationCount,
          meta,
        })
        pageNumber += 1
        await sleep(REQUEST_INTERVAL_MS)
      }

      meta = {
        ...meta,
        activeRun: {
          ...meta.activeRun,
          nextConversationId: null,
          nextMessagePage: 1,
        },
      }
      await store.writeMeta(meta)
    }

    if (!resumeFound) throw new Error('上次私信同步的会话已不在当前列表中，请重新开始')
    meta = finishRun(meta, clock().toISOString())
    await store.writeMeta(meta)
    onProgress({ status: 'completed', count: meta.counts?.directMessages || 0, meta })
    return { status: 'completed', meta }
  } catch (error) {
    meta = stopRun(meta, 'error', clock().toISOString(), error?.message || String(error))
    await store.writeMeta(meta)
    throw error
  }
}
