// 静音命中判定，全部为纯函数，方便用 jsdom fixture 做单测
// li 为 #stream > ol > li 的消息元素，mutedUsers 为 [ { userId, nickname } ]

// 站内一级路径中不是用户 id 的保留字
const RESERVED_FIRST_PATH_SEGMENTS = new Set([
  'home', 'login', 'browse', 'friends', 'followers',
  'album', 'photo', 'statuses', 'favorites', 'privatemsg',
  'sharer', 'q', 'friend.request', 'settings', 'mentions',
  'dialogue', 'about', 'help', 'terms', 'blocked',
])

// 从站内用户链接提取 userId；不是用户链接时返回 null
// 兼容绝对/相对链接、自定义 login name 和需要解码的 id
export function extractUserIdFromUrl(url) {
  if (!url) return null

  let parsedUrl

  try {
    parsedUrl = new URL(url, 'https://fanfou.com')
  } catch (error) {
    return null
  }

  if (!/(^|\.)fanfou\.com$/.test(parsedUrl.hostname)) return null

  const pathSegments = parsedUrl.pathname.split('/').filter(Boolean)

  if (pathSegments.length !== 1) return null
  if (RESERVED_FIRST_PATH_SEGMENTS.has(pathSegments[0])) return null

  try {
    return decodeURIComponent(pathSegments[0])
  } catch (error) {
    return null
  }
}

// 提取消息作者；个人页时间线等场景没有 .author 时返回 null
export function getStatusAuthor(li) {
  const authorLink = li.querySelector('a.author')

  if (!authorLink) return null

  const userId = extractUserIdFromUrl(authorLink.getAttribute('href'))

  if (!userId) return null

  return {
    userId,
    nickname: authorLink.textContent.trim(),
  }
}

function findByUserId(mutedUsers, userId) {
  return mutedUsers.find(mutedUser => mutedUser.userId === userId) || null
}

// 对话命中：正文中的站内用户链接，或「回复/转自×××」文本
export function findConversationMatch(li, mutedUsers) {
  for (const link of li.querySelectorAll('.content a')) {
    const userId = extractUserIdFromUrl(link.getAttribute('href'))

    if (!userId) continue

    const matchedUser = findByUserId(mutedUsers, userId)

    if (matchedUser) return matchedUser
  }

  const replyElement = li.querySelector('.stamp .reply')

  if (replyElement) {
    const replyText = replyElement.textContent

    const matchedUser = mutedUsers.find(mutedUser => (
      mutedUser.nickname && replyText.includes(mutedUser.nickname)
    ))

    if (matchedUser) return matchedUser
  }

  return null
}

// 综合判定，返回 { user, reason: 'author' | 'conversation' } 或 null
// exemptUserIds：这些作者的消息永不静音（如当前登录用户自己）
export function getMuteMatch(li, { mutedUsers, muteConversations = false, exemptUserIds = [] }) {
  if (!mutedUsers.length) return null

  const author = getStatusAuthor(li)

  if (author && exemptUserIds.includes(author.userId)) return null

  if (author) {
    const matchedUser = findByUserId(mutedUsers, author.userId)

    if (matchedUser) return { user: matchedUser, reason: 'author' }
  }

  if (muteConversations) {
    const matchedUser = findConversationMatch(li, mutedUsers)

    if (matchedUser) return { user: matchedUser, reason: 'conversation' }
  }

  return null
}
