const { test, expect } = require('@playwright/test')
const path = require('path')
const { launchWithExtension, loginWithCookie } = require('./setup')
require('dotenv').config({ path: path.join(__dirname, '.env.local') })

let context, page

test.use({ timeout: 30000 })

test.beforeAll(async ({ playwright }) => {
  context = await launchWithExtension(playwright)
  await loginWithCookie(context)
  page = await context.newPage()
})

test.afterAll(async () => {
  if (context) await context.close()
})

test('sidebar-statistics 显示用户注册时间', async () => {
  // 访问饭否首页（有 sidebar 的页面）
  await page.goto('https://fanfou.com/home', { waitUntil: 'domcontentloaded' })

  // 等待扩展注入的 sidebar 统计面板
  await page.waitForSelector('.sf-sidebar-statistics', { timeout: 20000 })

  // 截图：当前状态（修复前应显示 ……）
  await page.screenshot({
    path: path.join(__dirname, 'screenshots/sidebar-current.png'),
    fullPage: false,
  })

  // 检查注册时间文字
  const regTimeItem = await page.$('.sf-sidebar-statistics-item:has-text("注册")')
  expect(regTimeItem, '应存在包含"注册"字样的统计项').not.toBeNull()

  const regTimeText = await regTimeItem.textContent()
  console.log('[test] 注册时间文字:', regTimeText)

  expect(regTimeText, '不应包含 NaN').not.toContain('NaN')
  expect(regTimeText, '不应包含 Invalid').not.toContain('Invalid')
  expect(regTimeText, '应包含年份数字').toMatch(/\d{4}/)
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
