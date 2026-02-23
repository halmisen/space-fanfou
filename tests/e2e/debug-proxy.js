/**
 * 测试代理是否在 Playwright 浏览器中工作
 */
const { chromium } = require('playwright')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env.local') })

;(async () => {
  // 不加载扩展，只测试代理
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--proxy-server=http://172.29.240.1:7897',
    ],
  })
  const page = await browser.newPage()

  // 测试代理：先访问一个简单的 URL 确认代理工作
  const responses = []
  page.on('response', r => {
    if (!r.url().includes('google')) {
      responses.push({ url: r.url().slice(0, 60), status: r.status() })
    }
  })

  try {
    await page.goto('https://fanfou.com/', { waitUntil: 'domcontentloaded', timeout: 10000 })
    console.log('fanfou.com 状态:', (await page.title()).slice(0, 30))
  } catch (e) {
    console.log('fanfou.com 加载失败:', e.message)
  }

  const fetchResult = await page.evaluate(async () => {
    try {
      const r = await fetch('https://api.fanfou.com/users/show.json?id=fanfou')
      return { status: r.status, body: (await r.text()).slice(0, 100) }
    } catch (e) {
      return { error: e.message }
    }
  })
  console.log('api.fanfou.com fetch:', fetchResult)

  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
