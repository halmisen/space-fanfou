const { test, expect } = require('@playwright/test')
const path = require('path')
const { launchWithExtension, loginWithCookie } = require('./setup')
require('dotenv').config({ path: path.join(__dirname, '.env.local') })

let context, page

test.use({ timeout: 60000 })

test.beforeAll(async ({ playwright }) => {
  context = await launchWithExtension(playwright)
  await loginWithCookie(context)
  page = await context.newPage()
})

test.afterAll(async () => {
  if (context) await context.close()
})

test('sidebar-statistics 正确渲染（无 NaN/无永久省略号）', async () => {
  const ownUserId = process.env.FANFOU_LOGGED_IN_USER_ID || 'kiruoto'
  await page.goto(`https://fanfou.com/${ownUserId}`, { waitUntil: 'domcontentloaded' })

  // 等待 sidebar 渲染（最多 35 秒，含 JSONP 3次重试×10秒超时）
  await page.waitForSelector('.sf-sidebar-statistics', { timeout: 35000 })

  // 等待 JSONP 完成或超时降级（10s×3重试 ≈ 35s）
  await page.waitForFunction(
    () => {
      const el = document.querySelector('.sf-sidebar-statistics-item')
      if (!el) return false
      const t = el.textContent
      return !t.includes('……')
    },
    { timeout: 50000 }
  )

  await page.screenshot({
    path: path.join(__dirname, 'screenshots/sidebar-after.png'),
    fullPage: false,
  })

  const regTimeItem = await page.$('.sf-sidebar-statistics-item')
  const regTimeText = await regTimeItem.textContent()
  console.log('[test] 注册时间文字:', regTimeText)

  // 核心断言：不应有 NaN（之前的 bug），不应有永久 ……
  expect(regTimeText, '不应包含 NaN').not.toContain('NaN')
  expect(regTimeText, '不应包含 Invalid Date').not.toContain('Invalid')
  // 应该是年份 或 降级提示
  const hasYear = /\d{4}/.test(regTimeText)
  const hasApiUnavailable = regTimeText.includes('API 不可用')
  expect(hasYear || hasApiUnavailable, `应显示年份或降级文案，实际: "${regTimeText}"`).toBe(true)
})

test('check-friendship 检测好友关系', async () => {
  const targetUserId = process.env.FANFOU_TEST_USER_ID
  if (!targetUserId) {
    test.skip(true, 'FANFOU_TEST_USER_ID 未设置，跳过')
    return
  }

  await page.goto(`https://fanfou.com/${targetUserId}`, { waitUntil: 'domcontentloaded' })

  // 等待好友检查按钮（扩展注入）
  await page.waitForSelector('.sf-check-friendship-button', { timeout: 15000 })

  // 截图：点击前
  await page.screenshot({
    path: path.join(__dirname, 'screenshots/friendship-before.png'),
  })

  // 点击检查
  await page.click('.sf-check-friendship-button')

  // 等待结果（按钮文字从初始状态变为"关注了你"或"未关注你"）
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('.sf-check-friendship-button')
      if (!btn) return false
      const t = btn.textContent.trim()
      return t.includes('关注') || t.includes('错误') || t.includes('失败')
    },
    { timeout: 30000 }
  )

  const resultText = await page.textContent('.sf-check-friendship-button')
  console.log('[test] check-friendship 结果:', resultText)

  // 截图：检查后
  await page.screenshot({
    path: path.join(__dirname, 'screenshots/friendship-after.png'),
  })

  // 应该得到明确结果，不是静默失败
  expect(resultText).toMatch(/关注/)
})
