/**
 * 一次性工具：打开可视 Chromium 窗口，等你登录饭否后自动提取 cookie
 * 用法: node tests/e2e/get-cookies.js
 */
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const ENV_FILE = path.join(__dirname, '.env.local')
const PROFILE_DIR = path.join(__dirname, '../../.tmp-chrome-profile')

;(async () => {
  console.log('\n🚀 启动 Chromium（窗口会显示在 Windows 桌面）...')
  console.log('📍 请在打开的浏览器中登录饭否，登录成功后脚本自动提取 cookie 并退出\n')

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    locale: 'zh-CN',
  })

  const page = await context.newPage()
  await page.goto('https://fanfou.com/login', { waitUntil: 'domcontentloaded' })

  console.log('⏳ 等待登录...')

  // 轮询检查是否已登录（检测 #home 或重定向到 /home）
  let loggedIn = false
  for (let i = 0; i < 120; i++) {  // 最多等 2 分钟
    await page.waitForTimeout(1000)
    const url = page.url()
    const hasStream = await page.$('#stream').catch(() => null)
    const hasHome = url.includes('/home') || url.includes('fanfou.com/home')

    if (hasHome || hasStream) {
      loggedIn = true
      break
    }
    process.stdout.write(`\r  等待中... ${i + 1}s`)
  }

  if (!loggedIn) {
    console.log('\n❌ 超时：未检测到登录成功')
    await context.close()
    process.exit(1)
  }

  console.log('\n✅ 检测到登录成功，提取 cookie...')

  const cookies = await context.cookies('https://fanfou.com')
  const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ')

  // 找用户 ID（从 u cookie 或从页面 URL）
  const uCookie = cookies.find(c => c.name === 'u')
  let userId = uCookie ? uCookie.value : ''

  if (!userId) {
    // 尝试从导航栏"我的空间"链接提取
    try {
      await page.goto('https://fanfou.com/home', { waitUntil: 'domcontentloaded' })
      const profileLink = await page.$('#navigation a[href*="/"]')
      if (profileLink) {
        const href = await profileLink.getAttribute('href')
        userId = href ? href.replace('/', '').split('/')[0] : ''
      }
    } catch (e) {}
  }

  console.log(`\n📋 提取到 ${cookies.length} 个 cookie`)
  if (userId) console.log(`👤 登录用户 ID: ${userId}`)

  // 写入 .env.local
  const envContent = [
    `FANFOU_COOKIE=${cookieStr}`,
    userId ? `FANFOU_LOGGED_IN_USER_ID=${userId}` : '# FANFOU_LOGGED_IN_USER_ID=',
    '# 设置一个你知道对方是否关注你的用户 ID，用于验证 check-friendship',
    '# FANFOU_TEST_USER_ID=someuser',
  ].join('\n') + '\n'

  fs.writeFileSync(ENV_FILE, envContent)
  console.log(`\n💾 Cookie 已保存到: ${ENV_FILE}`)
  console.log('⚠️  此文件已在 .gitignore 中，不会被提交\n')

  await context.close()
  process.exit(0)
})()
