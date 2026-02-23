const { chromium } = require('playwright')
const { launchWithExtension, loginWithCookie } = require('./setup')
require('dotenv').config({ path: require('path').join(__dirname, '.env.local') })

;(async () => {
  const context = await launchWithExtension({ chromium })
  await loginWithCookie(context)
  const page = await context.newPage()
  await page.goto('https://m.fanfou.com/', { waitUntil: 'domcontentloaded' })

  const testCases = [
    { userId: 'daiyon',    pages: [1, 2, 5, 10, 20, 30, 50, 100, 200, 230, 231] },
    { userId: '鱼小颜',   pages: [1, 2, 5, 10, 20, 30, 50, 100, 110, 112, 113] },
    { userId: 'kiruoto',   pages: [1, 10, 20, 40, 49, 50] },
  ]

  for (const { userId, pages } of testCases) {
    console.log(`\n=== ${userId} ===`)
    for (const p of pages) {
      const url = `https://m.fanfou.com/${encodeURIComponent(userId)}/p.${p}`
      const result = await page.evaluate(async (u) => {
        try {
          const r = await fetch(u, { credentials: 'include' })
          const html = await r.text()
          const dates = (html.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/g) || [])
          // 找分页链接
          const pageLinks = (html.match(/href="\/[^"]+\/p\.(\d+)"/g) || []).map(m => m.match(/p\.(\d+)/)?.[1]).filter(Boolean)
          return { len: html.length, dateCount: dates.length, first: dates[0], last: dates[dates.length-1], pageLinks }
        } catch (e) { return { error: e.message } }
      }, url)
      const marker = result.dateCount > 0 ? '✓' : '✗'
      console.log(`  p.${String(p).padStart(3)}: ${marker} len=${result.len} dates=${result.dateCount} first=${result.first||'-'} last=${result.last||'-'} pages=${JSON.stringify(result.pageLinks)}`)
    }
  }

  await context.close()
})().catch(e => { console.error(e.message); process.exit(1) })
