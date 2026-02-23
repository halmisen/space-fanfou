const { chromium } = require('playwright')
const path = require('path')
const { launchWithExtension, loginWithCookie } = require('./setup')
require('dotenv').config({ path: path.join(__dirname, '.env.local') })

;(async () => {
  const context = await launchWithExtension({ chromium })
  await loginWithCookie(context)
  const page = await context.newPage()

  const consoleLogs = []
  const consoleErrors = []
  page.on('console', m => {
    const t = m.type()
    if (t === 'error') consoleErrors.push(m.text())
    else consoleLogs.push(`[${t}] ${m.text()}`)
  })
  page.on('pageerror', e => consoleErrors.push('PAGE ERROR: ' + e.message))

  const userId = process.env.FANFOU_LOGGED_IN_USER_ID || 'kiruoto'
  await page.goto(`https://fanfou.com/${userId}`, { waitUntil: 'domcontentloaded' })

  // 检查 meta[name=author]
  const metaAuthor = await page.evaluate(() => {
    const m = document.querySelector('meta[name=author]')
    return m ? m.content : null
  })
  console.log('meta[name=author]:', metaAuthor)

  // 直接在页面上下文测试 JSONP API 可达性
  const apiResult = await page.evaluate(async (uid) => {
    return new Promise((resolve) => {
      const callbackName = '__test_jsonp_' + Date.now()
      const script = document.createElement('script')
      const timeout = setTimeout(() => {
        delete window[callbackName]
        script.remove()
        resolve({ error: 'timeout after 8s' })
      }, 8000)

      window[callbackName] = (data) => {
        clearTimeout(timeout)
        delete window[callbackName]
        script.remove()
        resolve({ ok: true, created_at: data.created_at, name: data.name })
      }

      script.src = `//api.fanfou.com/users/show.json?callback=${callbackName}&id=${uid}&_=${Date.now()}`
      document.head.appendChild(script)
    })
  }, userId)

  console.log('JSONP API 测试结果:', JSON.stringify(apiResult))

  // 等待更长时间看 sidebar 是否最终更新
  await page.waitForTimeout(10000)
  const sidebarText = await page.textContent('.sf-sidebar-statistics').catch(() => 'NOT FOUND')
  console.log('sidebar 最终内容（前100字）:', sidebarText.slice(0, 100))

  console.log('\n=== console logs ===')
  consoleLogs.forEach(l => console.log(l))
  if (consoleErrors.length) {
    console.log('\n=== errors ===')
    consoleErrors.forEach(e => console.log(e))
  }

  await context.close()
})().catch(e => { console.error(e); process.exit(1) })
