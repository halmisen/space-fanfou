/**
 * proxiedFetch 経由で fanfou.com/<userid> の生 HTML を取得し、日付情報を探す
 * Extension loaded from main branch dist
 */
const path = require('path')
const { chromium } = require('playwright')
require('dotenv').config({ path: path.join(__dirname, '.env.local') })

const EXTENSION_PATH = '/home/fiver/projects/space-fanfou/dist'
const WINDOWS_PROXY = 'http://172.29.240.1:7897'
const TARGET_USER = process.env.FANFOU_TEST_USER_ID || 'fanfou'

;(async () => {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      `--proxy-server=${WINDOWS_PROXY}`,
    ],
  })

  const cookie = process.env.FANFOU_COOKIE
  const cookiePairs = cookie.split(';').map(p => p.trim()).filter(Boolean).map(p => {
    const eq = p.indexOf('=')
    return { name: p.slice(0, eq).trim(), value: p.slice(eq + 1).trim(), domain: '.fanfou.com', path: '/' }
  })
  await context.addCookies(cookiePairs)

  // Use Playwright's own request context (sends cookies, bypasses CORS)
  const req = context.request

  console.log(`\n=== Fetching https://fanfou.com/${TARGET_USER} ===`)
  const resp = await req.get(`https://fanfou.com/${TARGET_USER}`, {
    headers: { 'Cookie': cookie }
  })
  const html = await resp.text()
  console.log('Status:', resp.status(), 'Length:', html.length)

  // Search for dates
  const patterns = [
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g,  // ISO date
    /created_at[^"]*"[^"]+"/g,                  // created_at in JSON
    /20\d{2}年\d{1,2}月\d{1,2}日/g,            // Chinese date
    /\d{4}-\d{2}-\d{2}/g,                       // plain date
    /"created":\s*"[^"]+"/g,                     // created field
    /joined|since|member since/gi,               // English keywords
    /注册|加入/g,                                 // Chinese keywords
  ]

  for (const pat of patterns) {
    const matches = html.match(pat) || []
    if (matches.length > 0) {
      console.log(`\nPattern ${pat}: ${matches.slice(0, 5).join(', ')}`)
    }
  }

  // Also check m.fanfou.com profile
  console.log(`\n=== Fetching https://m.fanfou.com/${TARGET_USER} ===`)
  const mResp = await req.get(`https://m.fanfou.com/${TARGET_USER}`, {
    headers: { 'Cookie': cookie }
  })
  const mHtml = await mResp.text()
  console.log('Status:', mResp.status(), 'Length:', mHtml.length)

  // Print section with 生日/birthday
  const birthdayMatch = mHtml.match(/.{0,50}(生日|birthday|created|joined).{0,100}/gi)
  if (birthdayMatch) {
    console.log('\n生日/birthday context:', birthdayMatch)
  }

  // Print all date patterns in mHtml
  for (const pat of patterns) {
    const matches = mHtml.match(pat) || []
    if (matches.length > 0) {
      console.log(`m.fanfou Pattern ${pat}: ${matches.slice(0, 5).join(', ')}`)
    }
  }

  await context.close()
})().catch(e => { console.error(e.message); process.exit(1) })
