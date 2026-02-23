/**
 * 在 extension 上下文中测试代理 + 带 cookie 的 API 访问
 */
const { chromium } = require('playwright')
const path = require('path')
const { launchWithExtension, loginWithCookie } = require('./setup')
require('dotenv').config({ path: path.join(__dirname, '.env.local') })

;(async () => {
  const context = await launchWithExtension({ chromium })
  await loginWithCookie(context)
  const page = await context.newPage()

  const apiResponses = []
  page.on('response', async resp => {
    if (resp.url().includes('api.fanfou.com')) {
      const body = await resp.text().catch(() => '')
      apiResponses.push({ status: resp.status(), body: body.slice(0, 300) })
    }
  })

  const userId = process.env.FANFOU_LOGGED_IN_USER_ID || 'kiruoto'
  await page.goto(`https://fanfou.com/${userId}`, { waitUntil: 'domcontentloaded' })

  // 在页面上下文直接 fetch，带 credentials
  const fetchResult = await page.evaluate(async (uid) => {
    try {
      const r = await fetch(`https://api.fanfou.com/users/show.json?id=${uid}`, {
        credentials: 'include',
      })
      return { status: r.status, body: (await r.text()).slice(0, 300) }
    } catch (e) {
      return { error: e.message }
    }
  }, userId)
  console.log('fetch with credentials:', fetchResult)

  // 等一会儿看 JSONP 是否有响应
  await page.waitForTimeout(5000)
  console.log('api.fanfou.com 响应:', apiResponses)

  const sidebarText = await page.textContent('.sf-sidebar-statistics').catch(() => 'NOT FOUND')
  console.log('sidebar:', sidebarText.slice(0, 100))

  await context.close()
})().catch(e => { console.error(e.message); process.exit(1) })
