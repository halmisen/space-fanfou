const { chromium } = require('playwright')
const { launchWithExtension, loginWithCookie } = require('./setup')
require('dotenv').config({ path: require('path').join(__dirname, '.env.local') })

;(async () => {
  const context = await launchWithExtension({ chromium })
  await loginWithCookie(context)
  const page = await context.newPage()

  // 找到 friends/followers 的实际 profile 链接
  await page.goto('https://fanfou.com/friends/kiruoto', { waitUntil: 'networkidle' })
  const urls = await page.evaluate(() => {
    const seen = new Set()
    return Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ href: a.href, text: a.textContent.trim().slice(0, 20) }))
      .filter(x => {
        const u = new URL(x.href)
        return u.hostname === 'fanfou.com' &&
          u.pathname.match(/^\/[a-zA-Z0-9_\u4e00-\u9fff]+$/) &&
          !['/', '/home', '/login', '/browse'].includes(u.pathname) &&
          !seen.has(u.pathname) && seen.add(u.pathname)
      })
  })
  console.log('关注页面的所有用户 URL:')
  urls.forEach(u => console.log(`  ${u.href}  (${u.text})`))

  // 也从 followers 页面
  await page.goto('https://fanfou.com/followers/kiruoto', { waitUntil: 'networkidle' })
  const urls2 = await page.evaluate(() => {
    const seen = new Set()
    return Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ href: a.href, text: a.textContent.trim().slice(0, 20) }))
      .filter(x => {
        const u = new URL(x.href)
        return u.hostname === 'fanfou.com' &&
          u.pathname.match(/^\/[a-zA-Z0-9_\u4e00-\u9fff]+$/) &&
          !['/', '/home', '/login', '/browse', '/kiruoto'].includes(u.pathname) &&
          !seen.has(u.pathname) && seen.add(u.pathname)
      })
  })
  console.log('\n粉丝页面的所有用户 URL:')
  urls2.forEach(u => console.log(`  ${u.href}  (${u.text})`))

  await context.close()
})().catch(e => { console.error(e.message); process.exit(1) })
