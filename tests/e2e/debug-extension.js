/**
 * 调试：确认扩展加载情况，并检查 sidebar 在哪个页面出现
 */
const { chromium } = require('playwright')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env.local') })

const EXTENSION_PATH = path.resolve(__dirname, '../../dist')
const { launchWithExtension, loginWithCookie } = require('./setup')

;(async () => {
  const context = await launchWithExtension({ chromium })
  await loginWithCookie(context)
  const page = await context.newPage()

  // 尝试几个可能触发 sidebar 的页面
  const urls = [
    'https://fanfou.com/kiruoto',   // 登录用户自己的 profile
    'https://fanfou.com/home',       // 首页（不应有 sidebar）
    'https://fanfou.com/fanfou',     // 官方 fanfou 账号的 profile
  ]

  for (const url of urls) {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)

    const sidebar = await page.$('.sf-sidebar-statistics')
    const sfElements = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[class*="sf-"]')).map(e => e.className).slice(0, 10)
    )
    const consoleLogs = []
    page.on('console', m => consoleLogs.push(m.text()))

    console.log(`\n--- ${url} ---`)
    console.log('sf-sidebar-statistics 存在:', !!sidebar)
    console.log('sf- 元素列表:', sfElements)

    // 检查是否有扩展注入的 script
    const hasPageScript = await page.evaluate(() =>
      !!document.querySelector('script[src*="page.js"]') ||
      typeof window.__sf !== 'undefined'
    )
    console.log('page.js 已注入:', hasPageScript)

    // 截图
    await page.screenshot({
      path: path.join(__dirname, `screenshots/debug-${url.split('/').pop()}.png`),
    })
  }

  await context.close()
})().catch(e => { console.error(e); process.exit(1) })
