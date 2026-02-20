const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env.local') })

const EXTENSION_PATH = path.resolve(__dirname, '../../dist')

// Windows 代理（Clash/V2Ray 等），WSL2 通过宿主 IP 访问
const WINDOWS_PROXY = 'http://172.29.240.1:7897'

async function launchWithExtension(playwright) {
  const context = await playwright.chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-dev-shm-usage',
      `--proxy-server=${WINDOWS_PROXY}`,
    ],
  })
  return context
}

async function loginWithCookie(context, cookieStr) {
  const cookie = cookieStr || process.env.FANFOU_COOKIE
  if (!cookie) throw new Error('FANFOU_COOKIE not set in tests/e2e/.env.local')

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
}

module.exports = { launchWithExtension, loginWithCookie, EXTENSION_PATH }
