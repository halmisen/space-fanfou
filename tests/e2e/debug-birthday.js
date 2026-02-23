const path = require('path')
const { chromium } = require('playwright')
require('dotenv').config({ path: path.join(__dirname, '.env.local') })

const cookie = process.env.FANFOU_COOKIE
const userId = process.env.FANFOU_LOGGED_IN_USER_ID || 'kiruoto'

;(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--proxy-server=http://172.29.240.1:7897', '--no-sandbox'],
  })
  const context = await browser.newContext()
  const req = context.request

  for (const uid of [userId, 'fanfou', 'duetto']) {
    try {
      const resp = await req.get(`https://m.fanfou.com/${uid}`, {
        headers: { 'Cookie': cookie },
        timeout: 10000,
      })
      const html = await resp.text()
      const bday = html.match(/<p>生日：([^<]+)</)
      const statuses = html.match(/消息\((\d+)\)/)
      const followers = html.match(/关注他的人\((\d+)\)/)
      console.log(`[${uid}] 生日: ${bday ? bday[1] : '(未设置)'}, 消息: ${statuses ? statuses[1] : '?'}, 关注者: ${followers ? followers[1] : '?'}`)
    } catch (e) {
      console.log(`[${uid}] ERROR: ${e.message}`)
    }
  }

  await browser.close()
})().catch(e => { console.error(e.message); process.exit(1) })
