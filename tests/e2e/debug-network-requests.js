/**
 * 捕获 fanfou.com 个人页面的所有网络请求，寻找包含 created_at 的 JSON 响应
 */
const { chromium } = require('playwright')
const { launchWithExtension, loginWithCookie } = require('./setup')
require('dotenv').config({ path: require('path').join(__dirname, '.env.local') })

;(async () => {
  const context = await launchWithExtension({ chromium })
  await loginWithCookie(context)
  const page = await context.newPage()

  const allRequests = []
  page.on('request', req => {
    const url = req.url()
    if (url.startsWith('https://static.fanfou.com')) return
    if (url.startsWith('https://s3.meituan.net')) return
    allRequests.push({ method: req.method(), url })
  })

  page.on('response', async resp => {
    const url = resp.url()
    if (url.startsWith('https://static.fanfou.com')) return
    if (url.startsWith('https://s3.meituan.net')) return
    const contentType = resp.headers()['content-type'] || ''
    if (contentType.includes('json') || url.includes('.json') || url.includes('api')) {
      try {
        const body = await resp.text()
        if (body.includes('created_at')) {
          console.log('\n>>> 找到含 created_at 的响应!')
          console.log('URL:', url)
          console.log('Status:', resp.status())
          console.log('Body (first 500):', body.slice(0, 500))
        }
      } catch (e) {
        // ignore
      }
    }
  })

  console.log('正在加载 fanfou.com/fanfou ...')
  await page.goto('https://fanfou.com/fanfou', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  console.log('\n=== 所有非静态请求 ===')
  allRequests.forEach(r => console.log(r.method, r.url.slice(0, 120)))

  await context.close()
})().catch(e => { console.error(e.message); process.exit(1) })
