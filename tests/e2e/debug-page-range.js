const { chromium } = require('playwright')
const { launchWithExtension, loginWithCookie } = require('./setup')
require('dotenv').config({ path: require('path').join(__dirname, '.env.local') })

async function fetchViaProxy(page, url) {
  // 通过 proxiedFetch 机制获取（走 background service worker）
  return page.evaluate(async (u) => {
    return new Promise((resolve) => {
      const id = Math.random().toString(36).slice(2)
      const BRIDGE = 'sf-feature-bridge'
      const timeout = setTimeout(() => resolve({ error: 'timeout', html: '' }), 8000)

      // 实际上我们不能直接调用 proxiedFetch，直接 fetch 会被 CORS 阻止
      // 改用 background fetch via chrome.runtime（如果有的话）
      // 或者先测 page 1 来看结构
      fetch(u, { credentials: 'include' })
        .then(r => r.text())
        .then(html => { clearTimeout(timeout); resolve({ html, length: html.length }) })
        .catch(e => { clearTimeout(timeout); resolve({ error: e.message }) })
    })
  }, url)
}

;(async () => {
  const context = await launchWithExtension({ chromium })
  await loginWithCookie(context)
  const page = await context.newPage()

  // 先在 m.fanfou.com 域下做测试（不跨域）
  await page.goto('https://m.fanfou.com/', { waitUntil: 'domcontentloaded' })

  // 在 m.fanfou.com 页面上下文里直接 fetch（同域，无 CORS）
  const testUrls = [
    'https://m.fanfou.com/duetto',        // 第1页
    'https://m.fanfou.com/duetto/p.2',     // 第2页
    'https://m.fanfou.com/duetto/p.10',    // 第10页
    'https://m.fanfou.com/duetto/p.65',    // 计算的最后页
    'https://m.fanfou.com/daiyon/p.1',     // daiyon 第1页
    'https://m.fanfou.com/daiyon/p.231',   // daiyon 计算最后页
    `https://m.fanfou.com/${encodeURIComponent('鱼小颜')}/p.1`,
    `https://m.fanfou.com/${encodeURIComponent('鱼小颜')}/p.113`,
  ]

  for (const url of testUrls) {
    const result = await page.evaluate(async (u) => {
      try {
        const r = await fetch(u, { credentials: 'include' })
        const html = await r.text()
        const dates = html.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/g) || []
        const items = (html.match(/<li[^>]*>/g) || []).length
        return { length: html.length, dates: dates.slice(-3), items, head: html.slice(0, 200) }
      } catch (e) { return { error: e.message } }
    }, url)
    const shortUrl = url.replace('https://m.fanfou.com', '')
    console.log(`${shortUrl}: len=${result.length} items=${result.items} dates=${JSON.stringify(result.dates)}`)
    if (result.error) console.log('  ERROR:', result.error)
    if (result.items === 0 && result.length < 3000) console.log('  head:', result.head?.slice(0, 150))
  }

  await context.close()
})().catch(e => { console.error(e.message); process.exit(1) })
