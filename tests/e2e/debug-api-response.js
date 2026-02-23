/**
 * 在扩展加载的页面上下文里，检查 JSONP 实际请求的响应
 */
const { chromium } = require('playwright')
const path = require('path')
const { launchWithExtension, loginWithCookie } = require('./setup')
require('dotenv').config({ path: path.join(__dirname, '.env.local') })

;(async () => {
  const context = await launchWithExtension({ chromium })
  await loginWithCookie(context)
  const page = await context.newPage()

  // 拦截 api.fanfou.com 的响应
  const apiResponses = []
  page.on('response', async resp => {
    if (resp.url().includes('api.fanfou.com')) {
      const body = await resp.text().catch(() => '')
      apiResponses.push({ url: resp.url(), status: resp.status(), body: body.slice(0, 200) })
    }
  })

  const userId = process.env.FANFOU_LOGGED_IN_USER_ID || 'kiruoto'
  await page.goto(`https://fanfou.com/${userId}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(5000)  // 等待 JSONP 超时或返回

  console.log('=== API 响应 ===')
  apiResponses.forEach(r => {
    console.log(`${r.status} ${r.url.slice(0, 80)}`)
    console.log('  body:', r.body.slice(0, 150))
  })

  if (apiResponses.length === 0) {
    console.log('未拦截到 api.fanfou.com 响应（JSONP 可能超时或被阻止）')
  }

  // 在页面上下文直接 fetch 测试
  const fetchResult = await page.evaluate(async () => {
    try {
      const r = await fetch('https://api.fanfou.com/users/show.json?id=kiruoto', {
        credentials: 'include'
      })
      return { status: r.status, body: (await r.text()).slice(0, 200) }
    } catch (e) {
      return { error: e.message }
    }
  })
  console.log('\n=== fetch 直接测试（带 credentials） ===')
  console.log(fetchResult)

  await context.close()
})().catch(e => { console.error(e); process.exit(1) })
