const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const p = await b.newPage()
  // 关闭 webdriver 特征
  await p.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }) })
  await p.goto('https://fanfou.com/login', { waitUntil: 'domcontentloaded' })

  // 找验证码相关元素
  const captchaEls = await p.evaluate(() =>
    Array.from(document.querySelectorAll('img')).map(e => ({
      src: e.src.slice(0, 80), alt: e.alt, id: e.id, class: e.className, visible: e.offsetParent !== null
    }))
  )
  console.log('images:', JSON.stringify(captchaEls, null, 2))

  // captcha div 显隐状态
  const captchaDiv = await p.evaluate(() => {
    const el = document.querySelector('#captcha, .captcha, [id*=captcha], [class*=captcha]')
    return el ? { html: el.outerHTML.slice(0, 200), display: getComputedStyle(el).display } : null
  })
  console.log('captcha div:', captchaDiv)

  await b.close()
})()
