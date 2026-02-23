const { chromium } = require('playwright')
const { launchWithExtension, loginWithCookie } = require('./setup')
require('dotenv').config({ path: require('path').join(__dirname, '.env.local') })

;(async () => {
  const context = await launchWithExtension({ chromium })
  await loginWithCookie(context)
  const page = await context.newPage()

  // 先测自己的（已知成功）
  async function fetchAndAnalyze(url, label) {
    console.log(`\n=== ${label} ===`)
    const result = await page.evaluate(async (u) => {
      try {
        const r = await fetch(u, { credentials: 'include' })
        const html = await r.text()
        // 找各种日期格式
        const fmt1 = (html.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/g) || []).slice(-3)
        const fmt2 = (html.match(/\d{2}\/\d{2}\/\d{4}/g) || []).slice(-3)
        const fmt3 = (html.match(/\d{4}年\d{1,2}月\d{1,2}日/g) || []).slice(-3)
        const fmt4 = (html.match(/title="([^"]+\d{4}[^"]+)"/g) || []).slice(-3)
        // 最后几百字符
        const tail = html.slice(-500)
        return { status: r.status, length: html.length, fmt1, fmt2, fmt3, fmt4, tail }
      } catch (e) { return { error: e.message } }
    }, url)
    console.log('HTTP status:', result.status, '  HTML length:', result.length)
    console.log('YYYY-MM-DD HH:MM 格式:', result.fmt1)
    console.log('MM/DD/YYYY 格式:', result.fmt2)
    console.log('YYYY年M月D日 格式:', result.fmt3)
    console.log('title 属性中的日期:', result.fmt4)
    if (result.error) console.log('Error:', result.error)
    // 输出 tail 以便查看结构
    console.log('HTML 末尾 500 字符:', result.tail?.slice(0, 400))
  }

  await fetchAndAnalyze('https://m.fanfou.com/kiruoto/p.49', 'kiruoto p.49 (已知成功)')
  await fetchAndAnalyze('https://m.fanfou.com/duetto/p.65', 'duetto p.65')
  await fetchAndAnalyze('https://m.fanfou.com/duetto/p.64', 'duetto p.64')
  await fetchAndAnalyze(`https://m.fanfou.com/${encodeURIComponent('鱼小颜')}/p.113`, '鱼小颜 p.113')

  await context.close()
})().catch(e => { console.error(e.message); process.exit(1) })
