/**
 * 通过 m.fanfou.com（无验证码）登录，提取 cookie 保存到 .env.local
 */
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const ENV_FILE = path.join(__dirname, '.env.local')
const PROFILE_DIR = path.join(__dirname, '../../.tmp-chrome-profile')

;(async () => {
  console.log('启动 Chromium（headless）...')
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })

  const page = await context.newPage()

  console.log('访问手机版登录页（无验证码）...')
  await page.goto('https://m.fanfou.com', { waitUntil: 'domcontentloaded', timeout: 20000 })
  console.log('当前 URL:', page.url())

  await page.fill('input[name="loginname"]', '791627354@qq.com')
  await page.fill('input[name="loginpass"]', '1234561s')
  console.log('已填写账号密码，提交...')

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
    page.click('input[type="submit"]'),
  ])

  const url = page.url()
  console.log('登录后 URL:', url)

  if (url.includes('/login') || url.includes('m.fanfou.com/$')) {
    const body = await page.textContent('body').catch(() => '')
    console.error('❌ 登录可能失败:', body.slice(0, 300))
    await context.close()
    process.exit(1)
  }

  // 同时拉取 fanfou.com 的 cookie（m. 和主站共享 .fanfou.com 域）
  const cookies = await context.cookies(['https://fanfou.com', 'https://m.fanfou.com'])
  console.log(`✅ 获取到 ${cookies.length} 个 cookie:`, cookies.map(c => `${c.name}(${c.domain})`).join(', '))

  const uCookie = cookies.find(c => c.name === 'u')
  const userId = uCookie ? decodeURIComponent(uCookie.value) : ''
  console.log('登录用户 ID (u cookie):', userId || '未找到')

  // 写入 .env.local
  const fanfouCookies = cookies.filter(c => c.domain.includes('fanfou'))
  const cookieStr = fanfouCookies.map(c => `${c.name}=${c.value}`).join('; ')

  const lines = [
    `FANFOU_COOKIE=${cookieStr}`,
    userId ? `FANFOU_LOGGED_IN_USER_ID=${userId}` : '',
    'FANFOU_TEST_USER_ID=fanfou',
  ].filter(Boolean)

  fs.writeFileSync(ENV_FILE, lines.join('\n') + '\n')
  console.log('💾 已写入', ENV_FILE)
  console.log('Cookie 名列表:', fanfouCookies.map(c => c.name).join(', '))

  await context.close()
})().catch(e => { console.error('❌', e.message); process.exit(1) })
