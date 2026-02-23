/**
 * 通过饭否 xAuth API 获取 access token，再换取 session cookie
 */
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ENV_FILE = path.join(__dirname, '.env.local')

// 饭否官方 Consumer Key/Secret（来自 fanfou-api 社区文档）
const CONSUMER_KEY = 'a3c5e839ee70a41c5255d63f29ee5f35'
const CONSUMER_SECRET = '6eb563ef11cde1025e1e0e7f44a3ee93'

function oauthSign(method, url, params, consumerSecret, tokenSecret = '') {
  const baseParams = Object.entries(params)
    .sort(([a], [b]) => a < b ? -1 : 1)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  const baseString = [method.toUpperCase(), encodeURIComponent(url), encodeURIComponent(baseParams)].join('&')
  const sigKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`
  return crypto.createHmac('sha1', sigKey).update(baseString).digest('base64')
}

async function xauthLogin(username, password) {
  const url = 'https://api.fanfou.com/oauth/access_token'
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = crypto.randomBytes(8).toString('hex')

  const params = {
    oauth_consumer_key: CONSUMER_KEY,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_version: '1.0',
    x_auth_mode: 'client_auth',
    x_auth_password: password,
    x_auth_username: username,
  }

  const signature = oauthSign('POST', url, params, CONSUMER_SECRET)
  params.oauth_signature = signature

  const body = new URLSearchParams(params).toString()

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const text = await resp.text()
  console.log('xAuth 响应:', text.slice(0, 200))

  if (!resp.ok) throw new Error(`xAuth 失败: HTTP ${resp.status} ${text}`)

  const result = Object.fromEntries(new URLSearchParams(text))
  return result // { oauth_token, oauth_token_secret, ... }
}

;(async () => {
  console.log('🔑 尝试 xAuth 登录...')
  try {
    const tokens = await xauthLogin('791627354@qq.com', '1234561s')
    console.log('✅ xAuth 成功!')
    console.log('  oauth_token:', tokens.oauth_token)
    console.log('  user_id:', tokens.user_id || tokens.fanfou_com_user_id)

    // 写入 .env.local（供 OAuth 路径使用）
    const lines = [
      `FANFOU_OAUTH_TOKEN=${tokens.oauth_token}`,
      `FANFOU_OAUTH_TOKEN_SECRET=${tokens.oauth_token_secret}`,
      `FANFOU_LOGGED_IN_USER_ID=${tokens.user_id || ''}`,
      'FANFOU_TEST_USER_ID=fanfou',
    ]
    fs.writeFileSync(ENV_FILE, lines.join('\n') + '\n')
    console.log('💾 Token 已写入', ENV_FILE)
  } catch (e) {
    console.error('xAuth 失败:', e.message)

    // 备选：尝试手机版登录（m.fanfou.com 通常无验证码）
    console.log('\n尝试手机版登录...')
    const context = await chromium.launch({ headless: true, args: ['--no-sandbox'] }).then(b =>
      b.newContext()
    )
    const page = await context.newPage()
    await page.goto('https://m.fanfou.com', { waitUntil: 'domcontentloaded' })
    const loginUrl = page.url()
    console.log('手机版入口:', loginUrl)
    const inputs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('input')).map(e => ({ name: e.name, type: e.type }))
    )
    console.log('inputs:', inputs)
    await context.browser().close()
  }
})()
