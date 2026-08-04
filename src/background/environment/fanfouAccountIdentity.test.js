/* eslint camelcase: off */

import createAccountIdentityResolver, { pickAccountIdentity } from './fanfouAccountIdentity'

const tokensWithoutIdentity = {
  oauthToken: 'token',
  oauthTokenSecret: 'secret',
  screenName: null,
  userId: null,
  consumerKey: 'key',
}

function createResolver(fetchUser) {
  const saveTokens = jest.fn()
  const onError = jest.fn()
  const resolver = createAccountIdentityResolver({ fetchUser, saveTokens, onError })

  return { resolver, saveTokens, onError }
}

describe('pickAccountIdentity', () => {
  it('显示名优先取 name，与备份 meta.json 的写法一致', () => {
    expect(pickAccountIdentity({ id: 'halmisen', name: '海米', screen_name: 'halmisen' }))
      .toEqual({ userId: 'halmisen', screenName: '海米' })
  })

  it('没有 name 时退回 screen_name', () => {
    expect(pickAccountIdentity({ id: 'halmisen', screen_name: 'halmisen' }))
      .toEqual({ userId: 'halmisen', screenName: 'halmisen' })
  })

  it('返回体不含账号信息时给出 null，让调用方保持原样', () => {
    expect(pickAccountIdentity({})).toBe(null)
    expect(pickAccountIdentity(null)).toBe(null)
  })
})

describe('createAccountIdentityResolver', () => {
  it('token 里没有账号信息时补查一次并落盘', async () => {
    const { resolver, saveTokens } = createResolver(
      () => Promise.resolve({ id: 'halmisen', name: '海米' }),
    )

    const result = await resolver.ensure(tokensWithoutIdentity)

    expect(result).toEqual({ ...tokensWithoutIdentity, userId: 'halmisen', screenName: '海米' })
    expect(saveTokens).toHaveBeenCalledWith(result)
  })

  it('把调用现场的 consumer 传给请求方，签名才能用当前 key', async () => {
    const fetchUser = jest.fn(() => Promise.resolve({ id: 'halmisen', name: '海米' }))
    const { resolver } = createResolver(fetchUser)
    const consumer = { consumerKey: 'key', consumerSecret: 'secret' }

    await resolver.ensure(tokensWithoutIdentity, consumer)

    expect(fetchUser).toHaveBeenCalledWith(tokensWithoutIdentity, consumer)
  })

  it('已经知道账号是谁就不再打网络', async () => {
    const fetchUser = jest.fn()
    const { resolver } = createResolver(fetchUser)
    const tokens = { ...tokensWithoutIdentity, screenName: '海米' }

    expect(await resolver.ensure(tokens)).toBe(tokens)
    expect(fetchUser).not.toHaveBeenCalled()
  })

  it('尚未授权时直接放行', async () => {
    const fetchUser = jest.fn()
    const { resolver } = createResolver(fetchUser)

    expect(await resolver.ensure(null)).toBe(null)
    expect(await resolver.ensure({ oauthToken: 'token' })).toEqual({ oauthToken: 'token' })
    expect(fetchUser).not.toHaveBeenCalled()
  })

  // 读状态是高频调用，查不到账号不能变成每次都打一次网络。
  it('查询失败后本轮不再重试，也不让调用方失败', async () => {
    const fetchUser = jest.fn(() => Promise.reject(new Error('401')))
    const { resolver, saveTokens, onError } = createResolver(fetchUser)

    expect(await resolver.ensure(tokensWithoutIdentity)).toBe(tokensWithoutIdentity)
    expect(await resolver.ensure(tokensWithoutIdentity)).toBe(tokensWithoutIdentity)
    expect(fetchUser).toHaveBeenCalledTimes(1)
    expect(saveTokens).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('换了 token 之后重新允许查询', async () => {
    const fetchUser = jest.fn(() => Promise.reject(new Error('401')))
    const { resolver } = createResolver(fetchUser)

    await resolver.ensure(tokensWithoutIdentity)
    resolver.reset()
    await resolver.ensure(tokensWithoutIdentity)

    expect(fetchUser).toHaveBeenCalledTimes(2)
  })

  it('返回体里没有账号信息时保持原样，不写坏 token 记录', async () => {
    const { resolver, saveTokens } = createResolver(() => Promise.resolve({}))

    expect(await resolver.ensure(tokensWithoutIdentity)).toBe(tokensWithoutIdentity)
    expect(saveTokens).not.toHaveBeenCalled()
  })
})
