import { extractUserIdFromUrl, getStatusAuthor, findConversationMatch, getMuteMatch } from './matchers'

function createStatusElement({
  authorId = 'someone',
  authorNickname = '某人',
  contentHtml = 'hello world',
  replyHtml = '',
} = {}) {
  const li = document.createElement('li')

  li.innerHTML = `
    <a class="author" href="https://fanfou.com/${authorId}">${authorNickname}</a>
    <span class="content">${contentHtml}</span>
    <span class="stamp">
      <a class="time" href="https://fanfou.com/statuses/abc">1分钟前</a>
      ${replyHtml}
    </span>
    <span class="op"><a class="reply" href="#">回复</a></span>
  `

  return li
}

const mutedUsers = [
  { userId: 'muted-one', nickname: '被静音的人' },
  { userId: '~yzl0Iu9EWmQ', nickname: '波浪号用户' },
]

describe('extractUserIdFromUrl', () => {
  it('提取普通用户链接的 userId', () => {
    expect(extractUserIdFromUrl('https://fanfou.com/muted-one')).toBe('muted-one')
  })

  it('兼容相对链接与 ~ 前缀 id', () => {
    expect(extractUserIdFromUrl('/~yzl0Iu9EWmQ')).toBe('~yzl0Iu9EWmQ')
  })

  it('解码 percent-encoding 的 userId', () => {
    expect(extractUserIdFromUrl('https://fanfou.com/%E9%A5%AD%E5%90%A6')).toBe('饭否')
  })

  it('排除保留路径与多级路径', () => {
    expect(extractUserIdFromUrl('https://fanfou.com/home')).toBeNull()
    expect(extractUserIdFromUrl('https://fanfou.com/statuses/abc123')).toBeNull()
    expect(extractUserIdFromUrl('https://fanfou.com/q/%E8%AF%9D%E9%A2%98')).toBeNull()
  })

  it('排除外站链接与非法输入', () => {
    expect(extractUserIdFromUrl('https://example.com/muted-one')).toBeNull()
    expect(extractUserIdFromUrl('')).toBeNull()
    expect(extractUserIdFromUrl(null)).toBeNull()
  })
})

describe('getStatusAuthor', () => {
  it('提取作者 userId 和昵称', () => {
    const li = createStatusElement({ authorId: 'muted-one', authorNickname: '被静音的人' })

    expect(getStatusAuthor(li)).toEqual({ userId: 'muted-one', nickname: '被静音的人' })
  })

  it('个人页时间线没有 .author 时返回 null', () => {
    const li = createStatusElement()

    li.querySelector('a.author').remove()
    expect(getStatusAuthor(li)).toBeNull()
  })
})

describe('findConversationMatch', () => {
  it('正文中 @ 提及被静音饭友时命中', () => {
    const li = createStatusElement({
      contentHtml: '同意 <a href="https://fanfou.com/muted-one" class="former">被静音的人</a> 的看法',
    })

    expect(findConversationMatch(li, mutedUsers)).toEqual(mutedUsers[0])
  })

  it('「回复/转自」文本包含被静音昵称时命中', () => {
    const li = createStatusElement({
      replyHtml: '<span class="reply">转自<a href="https://fanfou.com/statuses/xyz">被静音的人</a></span>',
    })

    expect(findConversationMatch(li, mutedUsers)).toEqual(mutedUsers[0])
  })

  it('正文里的外站链接和保留路径不误伤', () => {
    const li = createStatusElement({
      contentHtml: '看 <a href="https://example.com/muted-one">外站</a> 和 <a href="https://fanfou.com/q/muted-one">话题</a>',
    })

    expect(findConversationMatch(li, mutedUsers)).toBeNull()
  })
})

describe('getMuteMatch', () => {
  it('作者命中', () => {
    const li = createStatusElement({ authorId: 'muted-one' })
    const match = getMuteMatch(li, { mutedUsers })

    expect(match).toEqual({ user: mutedUsers[0], reason: 'author' })
  })

  it('muteConversations 开启时对话命中', () => {
    const li = createStatusElement({
      contentHtml: '@<a href="/~yzl0Iu9EWmQ">波浪号用户</a> 在吗',
    })

    expect(getMuteMatch(li, { mutedUsers, muteConversations: true }))
      .toEqual({ user: mutedUsers[1], reason: 'conversation' })
  })

  it('muteConversations 关闭时对话不命中', () => {
    const li = createStatusElement({
      contentHtml: '@<a href="/~yzl0Iu9EWmQ">波浪号用户</a> 在吗',
    })

    expect(getMuteMatch(li, { mutedUsers, muteConversations: false })).toBeNull()
  })

  it('自己发的消息永不静音（即使提及被静音饭友）', () => {
    const li = createStatusElement({
      authorId: 'myself',
      contentHtml: '@<a href="https://fanfou.com/muted-one">被静音的人</a> 你好',
    })

    expect(getMuteMatch(li, {
      mutedUsers,
      muteConversations: true,
      exemptUserIds: [ 'myself' ],
    })).toBeNull()
  })

  it('名单为空时不命中', () => {
    const li = createStatusElement({ authorId: 'muted-one' })

    expect(getMuteMatch(li, { mutedUsers: [] })).toBeNull()
  })
})
