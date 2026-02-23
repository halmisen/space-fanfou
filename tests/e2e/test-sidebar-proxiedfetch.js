/**
 * 测试 sidebar-statistics 使用 proxiedFetch 后是否能正确获取他人资料
 * 运行: node tests/e2e/test-sidebar-proxiedfetch.js
 */
const path = require('path')
const { chromium } = require('playwright')
require('dotenv').config({ path: path.join(__dirname, '.env.local') })

// 指向主分支（已修复）的 dist/，而非 worktree 的旧代码
const EXTENSION_PATH = '/home/fiver/projects/space-fanfou/dist'
const WINDOWS_PROXY = 'http://172.29.240.1:7897'
const TARGET_USER = process.env.FANFOU_TEST_USER_ID || 'fanfou'

async function main() {
  console.log(`[test] 加载扩展: ${EXTENSION_PATH}`)
  console.log(`[test] 目标用户: ${TARGET_USER}`)

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-dev-shm-usage',
      `--proxy-server=${WINDOWS_PROXY}`,
    ],
  })

  // 注入 cookie
  const cookie = process.env.FANFOU_COOKIE
  if (!cookie) {
    console.error('[test] 缺少 FANFOU_COOKIE，请先运行 login-and-save.js')
    await context.close()
    process.exit(1)
  }

  const cookiePairs = cookie.split(';')
    .map(pair => pair.trim())
    .filter(Boolean)
    .map(pair => {
      const eqIdx = pair.indexOf('=')
      const name = pair.slice(0, eqIdx).trim()
      const value = pair.slice(eqIdx + 1).trim()
      return { name, value, domain: '.fanfou.com', path: '/' }
    })
  await context.addCookies(cookiePairs)

  const page = await context.newPage()

  // 捕获控制台输出（包含扩展日志）
  page.on('console', msg => {
    const text = msg.text()
    if (text.includes('SpaceFanfou') || text.includes('SidebarStatistics') || text.includes('proxiedFetch')) {
      console.log(`[browser] ${msg.type()}: ${text}`)
    }
  })

  console.log(`[test] 打开 https://fanfou.com/${TARGET_USER}`)
  await page.goto(`https://fanfou.com/${TARGET_USER}`, { waitUntil: 'domcontentloaded' })

  console.log('[test] 等待 .sf-sidebar-statistics 出现（最多 20 秒）...')
  try {
    await page.waitForSelector('.sf-sidebar-statistics', { timeout: 20000 })
    console.log('[test] ✅ 统计信息容器已渲染')
  } catch (e) {
    console.error('[test] ❌ 统计信息容器未出现')
    await page.screenshot({ path: path.join(__dirname, 'screenshots/sidebar-proxiedfetch-fail.png') })
    await context.close()
    process.exit(1)
  }

  console.log('[test] 等待数据加载（不再是 ……）...')
  try {
    await page.waitForFunction(
      () => {
        const item = document.querySelector('.sf-sidebar-statistics-item')
        return item && !item.textContent.includes('……')
      },
      { timeout: 15000 }
    )
    console.log('[test] ✅ 数据已加载')
  } catch (e) {
    console.error('[test] ❌ 数据加载超时（还是 ……）')
  }

  // 读取所有统计项文字
  const items = await page.$$eval('.sf-sidebar-statistics-item', els =>
    els.map(el => el.textContent.trim())
  )
  console.log('[test] 统计项内容:')
  items.forEach((text, i) => console.log(`  [${i}] ${text}`))

  // 断言
  const hasNaN = items.some(t => t.includes('NaN'))
  const hasFail = items.some(t => t.includes('获取失败'))
  const hasDate = items.some(t => /\d{4}/.test(t))

  if (hasNaN) console.error('[test] ❌ 存在 NaN')
  else console.log('[test] ✅ 无 NaN')

  if (hasFail) console.error('[test] ❌ 显示"获取失败"（proxiedFetch 或 API 失败）')
  else console.log('[test] ✅ 无"获取失败"')

  if (hasDate) console.log('[test] ✅ 包含年份数字（数据正常）')
  else console.warn('[test] ⚠️  无年份数字')

  await page.screenshot({ path: path.join(__dirname, 'screenshots/sidebar-proxiedfetch-result.png'), fullPage: false })
  console.log('[test] 截图已保存到 screenshots/sidebar-proxiedfetch-result.png')

  // 保持浏览器打开 5 秒供肉眼确认
  await new Promise(r => setTimeout(r, 5000))
  await context.close()
}

main().catch(err => {
  console.error('[test] 未捕获异常:', err)
  process.exit(1)
})
