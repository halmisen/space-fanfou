/*
 * 多账号防护：备份跟着 OAuth 授权走，不跟着网页登录走。
 * 网页切了账号但没重新授权时，备份的仍是原账号；此时若同步进同一个文件夹，
 * 必须报错而不是把两个账号的消息混进同一份归档。
 */

import createFanfouClient from './fanfouClient'
import { resumeOrStartSync } from './checkpoint'
import { FANFOU_OAUTH_GET_STATUS } from '@constants/action-types'

const NOW = '2026-08-03T02:00:00.000Z'

function metaFor(id, name) {
  return resumeOrStartSync(null, { id, name }, NOW)
}

describe('归档目录的账号归属', () => {
  test('同一个账号可以继续往原目录同步', () => {
    const meta = metaFor('small', '小号')

    expect(() => resumeOrStartSync(meta, { id: 'small', name: '小号' }, NOW)).not.toThrow()
  })

  test('换了账号就拒绝写入，不把两个账号混进同一份归档', () => {
    const meta = metaFor('small', '小号')

    expect(() => resumeOrStartSync(meta, { id: 'big', name: '大号' }, NOW)).toThrow()
  })

  test('错误信息点名两个账号并给出可照做的下一步', () => {
    const meta = metaFor('small', '小号')
    let message = ''

    try {
      resumeOrStartSync(meta, { id: 'big', name: '大号' }, NOW)
    } catch (error) {
      ({ message } = error)
    }

    expect(message).toContain('小号')
    expect(message).toContain('大号')
    expect(message).toContain('换一个空文件夹')
    expect(message).toContain('重新授权')
    // 这句会原样显示给用户，不该漏出英文内部术语
    expect(message).not.toMatch(/mismatch|expected|unknown/i)
  })

  test('meta 里没有账号信息时也要拦住', () => {
    expect(() => resumeOrStartSync({ account: undefined }, { id: 'big' }, NOW)).toThrow()
  })
})

describe('fetchAuthorizationStatus', () => {
  function clientWith(status) {
    return createFanfouClient({
      postMessage(message) {
        if (message.action === FANFOU_OAUTH_GET_STATUS) return Promise.resolve({ status })
        throw new Error(`不该打其它请求：${message.action}`)
      },
    })
  }

  test('只读授权状态，不打 API', async () => {
    const status = { hasTokens: true, userId: 'big', screenName: '大号' }

    await expect(clientWith(status).fetchAuthorizationStatus()).resolves.toEqual(status)
  })

  test('未授权时如实返回，让面板显示提示而不是崩掉', async () => {
    await expect(clientWith({ hasTokens: false }).fetchAuthorizationStatus())
      .resolves.toEqual({ hasTokens: false })
    await expect(clientWith(undefined).fetchAuthorizationStatus()).resolves.toBeNull()
  })
})
