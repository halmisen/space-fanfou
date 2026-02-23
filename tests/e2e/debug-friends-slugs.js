const { chromium } = require('playwright')
const { launchWithExtension, loginWithCookie } = require('./setup')
require('dotenv').config({ path: require('path').join(__dirname, '.env.local') })

;(async () => {
  const context = await launchWithExtension({ chromium })
  await loginWithCookie(context)
  const page = await context.newPage()

  // 从 fanfou.com 关注列表获取 URL slug
  await page.goto('https://fanfou.com/friends/kiruoto', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)

  const friends = await page.evaluate(() => {
    const results = []
    document.querySelectorAll('li').forEach(li => {
      const link = li.querySelector('a[href]')
      if (!link) return
      const href = link.getAttribute('href')
      const name = link.textContent.trim()
      if (href && href.match(/^\/[a-zA-Z0-9_\u4e00-\u9fff]+$/) && name) {
        results.push({ name, slug: href.slice(1) })
      }
    })
    return [...new Map(results.map(r => [r.slug, r])).values()]
  })
  console.log('关注列表 (名→slug):', friends)

  // 我的粉丝列表
  await page.goto('https://fanfou.com/followers/kiruoto', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)
  const followers = await page.evaluate(() => {
    const results = []
    document.querySelectorAll('li').forEach(li => {
      const link = li.querySelector('a[href]')
      if (!link) return
      const href = link.getAttribute('href')
      const name = link.textContent.trim()
      if (href && href.match(/^\/[a-zA-Z0-9_\u4e00-\u9fff]+$/) && name) {
        results.push({ name, slug: href.slice(1) })
      }
    })
    return [...new Map(results.map(r => [r.slug, r])).values()]
  })
  console.log('粉丝列表 (名→slug):', followers)

  // m.fanfou.com 的显示格式
  await page.goto('https://m.fanfou.com/friends/p.1', { waitUntil: 'domcontentloaded' })
  const mFriends = await page.evaluate(() =>
    Array.from(document.querySelectorAll('ol > li > a > span.a')).map(e => e.textContent.trim())
  )
  console.log('\nm.fanfou.com/friends 显示:', mFriends)

  await page.goto('https://m.fanfou.com/followers/p.1', { waitUntil: 'domcontentloaded' })
  const mFollowers = await page.evaluate(() =>
    Array.from(document.querySelectorAll('ol > li > a > span.a')).map(e => e.textContent.trim())
  )
  console.log('m.fanfou.com/followers 显示:', mFollowers)

  await context.close()
})().catch(e => { console.error(e.message); process.exit(1) })
