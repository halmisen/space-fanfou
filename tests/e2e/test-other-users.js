/**
 * 测试他人页面的统计信息（duetto = avian, 鱼小颜 = 素白）
 */
const { chromium } = require('playwright')
const path = require('path')
const { launchWithExtension, loginWithCookie } = require('./setup')
require('dotenv').config({ path: path.join(__dirname, '.env.local') })

async function testUserPage(context, userId) {
  const page = await context.newPage()
  const logs = []
  page.on('console', msg => {
    if (msg.text().includes('[SF stats]')) logs.push(msg.text())
  })

  console.log(`\n=== fanfou.com/${userId} ===`)
  await page.goto(`https://fanfou.com/${encodeURIComponent(userId)}`, { waitUntil: 'domcontentloaded' })

  // 等待 sidebar 出现
  const sidebarFound = await page.waitForSelector('.sf-sidebar-statistics', { timeout: 8000 }).then(() => true).catch(() => false)
  console.log('sidebar 出现:', sidebarFound)

  if (sidebarFound) {
    // 等待注册时间不再是 ……
    await page.waitForFunction(
      () => {
        const el = document.querySelector('.sf-sidebar-statistics-item')
        return el && !el.textContent.includes('……')
      },
      { timeout: 15000 }
    ).catch(() => {})

    const text = await page.textContent('.sf-sidebar-statistics').catch(() => '')
    console.log('统计面板内容:', text.slice(0, 150))
  }

  // SF stats 日志
  console.log('调试日志:')
  logs.forEach(l => console.log(' ', l))

  await page.screenshot({ path: path.join(__dirname, `screenshots/other-user-${userId.replace(/[^a-zA-Z0-9]/g, '_')}.png`) })
  await page.close()
}

;(async () => {
  const context = await launchWithExtension({ chromium })
  await loginWithCookie(context)

  // 测试 duetto（avian，加锁，我关注了她）
  await testUserPage(context, 'duetto')

  // 测试 鱼小颜（素白，中文ID，公开账号）
  await testUserPage(context, '鱼小颜')

  // 测试 daiyon（另一个关注的用户）
  await testUserPage(context, 'daiyon')

  await context.close()
})().catch(e => { console.error(e.message); process.exit(1) })
