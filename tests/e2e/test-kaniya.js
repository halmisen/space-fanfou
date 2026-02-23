const { chromium } = require('playwright')
const { launchWithExtension, loginWithCookie } = require('./setup')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env.local') })

;(async () => {
  const context = await launchWithExtension({ chromium })
  await loginWithCookie(context)
  const page = await context.newPage()
  const logs = []
  page.on('console', m => { if (m.text().includes('[SF')) logs.push(m.text()) })

  // 卡妮娅洼 = 爱自 (user ID)
  await page.goto('https://fanfou.com/%E7%88%B1%E8%87%AA', { waitUntil: 'networkidle' })

  // 等待 sidebar 出现并完成渲染
  await page.waitForSelector('.sf-sidebar-statistics', { timeout: 10000 }).catch(() => {})
  await page.waitForFunction(
    () => {
      const el = document.querySelector('.sf-sidebar-statistics-item')
      return el && !el.textContent.includes('……')
    },
    { timeout: 10000 }
  ).catch(() => {})

  // 提取所有相关信息
  const info = await page.evaluate(() => {
    const userId = (() => {
      const meta = document.querySelector('meta[name=author]')
      if (meta) {
        const m = meta.content.match(/\(([^)]+)\)$/)
        if (m) return m[1]
      }
      const raw = window.location.pathname.split('/').filter(Boolean)[0] || ''
      try { return decodeURIComponent(raw) } catch { return raw }
    })()

    // 找所有 href=/followers/{userId} 的 .count
    const followerEls = Array.from(document.querySelectorAll(`a[href="/followers/${userId}"] .count`))
      .map(e => ({ text: e.textContent, html: e.closest('a').outerHTML.slice(0, 200) }))
    const friendEls = Array.from(document.querySelectorAll(`a[href="/friends/${userId}"] .count`))
      .map(e => ({ text: e.textContent }))
    const statusEls = Array.from(document.querySelectorAll(`a[href="/${userId}"] .count`))
      .map(e => ({ text: e.textContent }))

    return {
      userId,
      url: window.location.pathname,
      followerEls,
      friendEls,
      statusEls,
      sidebarText: document.querySelector('.sf-sidebar-statistics')?.textContent?.slice(0, 200),
    }
  })

  console.log('userId:', info.userId)
  console.log('url:', info.url)
  console.log('follower elements:', JSON.stringify(info.followerEls, null, 2))
  console.log('friend elements:', JSON.stringify(info.friendEls, null, 2))
  console.log('status elements:', JSON.stringify(info.statusEls, null, 2))
  console.log('sidebar:', info.sidebarText)

  await page.screenshot({ path: path.join(__dirname, 'screenshots/kaniya.png') })
  await context.close()
})().catch(e => { console.error(e.message); process.exit(1) })
