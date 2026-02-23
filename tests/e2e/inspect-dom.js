const { chromium } = require('playwright')
const path = require('path')
const { launchWithExtension, loginWithCookie } = require('./setup')
require('dotenv').config({ path: path.join(__dirname, '.env.local') })

;(async () => {
  const context = await launchWithExtension({ chromium })
  await loginWithCookie(context)
  const page = await context.newPage()
  const userId = process.env.FANFOU_LOGGED_IN_USER_ID || 'kiruoto'
  await page.goto(`https://fanfou.com/${userId}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)

  const info = await page.evaluate((uid) => {
    const get = sel => { const el = document.querySelector(sel); return el ? el.outerHTML.slice(0, 200) : null }
    const getText = sel => { const el = document.querySelector(sel); return el ? el.textContent.trim() : null }

    return {
      // 消息数链接
      statusesLink: get(`a[href="/${uid}"]`),
      statusesText: getText(`a[href="/${uid}"]`),

      // 关注数链接
      friendsLink: get(`a[href="/friends/${uid}"]`),
      friendsText: getText(`a[href="/friends/${uid}"]`),

      // 粉丝数链接
      followersLink: get(`a[href="/followers/${uid}"]`),
      followersText: getText(`a[href="/followers/${uid}"]`),

      // body 背景图
      bodyBg: getComputedStyle(document.body).backgroundImage,

      // 加锁标志
      protectedEl: get('[class*="lock"], .locked, #private'),
      isProtectedText: getText('#user_infos .private, .icon-lock'),

      // m.fanfou 最后一页日期（验证格式）
      sampleFromPage: Array.from(document.querySelectorAll('a.time, .time, abbr')).slice(0, 3).map(e => e.outerHTML).join('|'),
    }
  }, userId)

  console.log(JSON.stringify(info, null, 2))
  await context.close()
})().catch(e => { console.error(e.message); process.exit(1) })
