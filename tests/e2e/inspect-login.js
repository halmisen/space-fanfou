const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  const p = await b.newPage()
  await p.goto('https://fanfou.com/login', { waitUntil: 'domcontentloaded', timeout: 20000 })
  const inputs = await p.evaluate(() =>
    Array.from(document.querySelectorAll('input')).map(e => ({
      name: e.name, type: e.type, id: e.id, placeholder: e.placeholder
    }))
  )
  console.log('inputs:', JSON.stringify(inputs, null, 2))
  const title = await p.title()
  console.log('title:', title)
  await b.close()
})().catch(e => { console.error(e); process.exit(1) })
