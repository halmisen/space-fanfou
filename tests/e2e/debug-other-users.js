/**
 * 诊断：在他人页面上的 DOM 提取和好友检查
 * 用法: FANFOU_TARGET_USER_ID=subo node tests/e2e/debug-other-users.js
 */
const { chromium } = require('playwright')
const path = require('path')
const { launchWithExtension, loginWithCookie } = require('./setup')
require('dotenv').config({ path: path.join(__dirname, '.env.local') })

const targetUserId = process.env.FANFOU_TARGET_USER_ID || 'fanfou'

;(async () => {
  const context = await launchWithExtension({ chromium })
  await loginWithCookie(context)
  const page = await context.newPage()

  console.log(`\n=== 访问 fanfou.com/${targetUserId} ===\n`)
  await page.goto(`https://fanfou.com/${targetUserId}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)

  const diag = await page.evaluate((uid) => {
    // 1. meta[name=author]
    const meta = document.querySelector('meta[name=author]')
    const metaContent = meta ? meta.content : null
    const userIdFromMeta = metaContent ? (metaContent.match(/\((.+)\)/) || [])[1] : null

    // 2. DOM 计数提取
    const getEl = sel => document.querySelector(sel)
    const getCount = href => {
      const el = getEl(`a[href="${href}"] .count`)
      return { found: !!el, html: el ? el.outerHTML : null, text: el ? el.textContent : null, parsed: el ? parseInt(el.textContent.replace(/\D/g, ''), 10) : 0 }
    }

    // 3. 所有含 count class 的元素
    const allCounts = Array.from(document.querySelectorAll('.count')).map(e => ({
      text: e.textContent, parent: e.parentElement ? e.parentElement.outerHTML.slice(0, 100) : ''
    }))

    // 4. href=/uid 的所有链接
    const hrefLinks = Array.from(document.querySelectorAll(`a[href="/${uid}"]`)).map(e => e.outerHTML.slice(0, 150))

    return {
      metaContent,
      userIdFromMeta,
      statusesCount: getCount(`/${uid}`),
      friendsCount: getCount(`/friends/${uid}`),
      followersCount: getCount(`/followers/${uid}`),
      allCounts: allCounts.slice(0, 10),
      hrefLinks,
    }
  }, targetUserId)

  console.log('meta[name=author]:', diag.metaContent)
  console.log('getUserId() 返回:', diag.userIdFromMeta)
  console.log('\nstatuses_count:', JSON.stringify(diag.statusesCount))
  console.log('friends_count:', JSON.stringify(diag.friendsCount))
  console.log('followers_count:', JSON.stringify(diag.followersCount))
  console.log('\nhref=/${uid} 的链接:', diag.hrefLinks)
  console.log('\n所有 .count 元素:', diag.allCounts.map(c => `"${c.text}" in: ${c.parent.slice(0, 80)}`))

  // 5. 测试 proxiedFetch 到 m.fanfou.com
  console.log('\n=== 测试 m.fanfou.com 最后一页 ===')
  const stCount = diag.statusesCount.parsed || 0
  if (stCount > 0) {
    const lastPage = Math.ceil(stCount / 30)
    console.log(`statuses_count=${stCount}, lastPage=${lastPage}`)
    // 通过扩展的 proxiedFetch 测试
    const mResult = await page.evaluate(async (uid, pg) => {
      return new Promise(resolve => {
        const timeout = setTimeout(() => resolve({ error: 'timeout' }), 8000)
        window.dispatchEvent(new CustomEvent('sf-bridge', {
          detail: { type: 'proxiedFetch', url: `https://m.fanfou.com/${uid}/p.${pg}` }
        }))
        // 简单 fetch 测试（不走扩展通道）
        fetch(`https://m.fanfou.com/${uid}/p.${pg}`, { credentials: 'include' })
          .then(r => r.text())
          .then(html => {
            clearTimeout(timeout)
            const dates = html.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/g) || []
            resolve({ ok: true, length: html.length, dateCount: dates.length, lastDate: dates[dates.length - 1] })
          })
          .catch(e => { clearTimeout(timeout); resolve({ error: e.message }) })
      })
    }, targetUserId, lastPage)
    console.log('m.fanfou.com fetch 结果:', mResult)
  } else {
    console.log('statuses_count=0，跳过 m.fanfou.com 测试')
  }

  // 6. 好友检查诊断
  console.log('\n=== check-friendship 诊断 ===')
  const cfDiag = await page.evaluate(async (uid) => {
    // 直接 fetch 我的 followers 和 friends 列表
    const fetchList = async (url) => {
      try {
        const r = await fetch(url, { credentials: 'include' })
        const html = await r.text()
        // 提取 span.a 的文本
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')
        const spans = Array.from(doc.querySelectorAll('ol > li > a > span.a'))
        return { ids: spans.map(s => s.textContent.replace(/^\(|\)$/g, '')), hasNext: !!doc.querySelector('a[href*="p.2"]') }
      } catch (e) { return { error: e.message } }
    }

    const followers1 = await fetchList('https://m.fanfou.com/followers/p.1')
    const friends1 = await fetchList('https://m.fanfou.com/friends/p.1')

    return {
      targetUserId: uid,
      myFollowers_p1: followers1,
      myFriends_p1: friends1,
      targetInMyFollowers: followers1.ids ? followers1.ids.includes(uid) : false,
      targetInMyFriends: friends1.ids ? friends1.ids.includes(uid) : false,
    }
  }, targetUserId)

  console.log('targetUserId:', cfDiag.targetUserId)
  console.log('我的 followers[1]:', cfDiag.myFollowers_p1)
  console.log('我的 friends[1]:', cfDiag.myFriends_p1)
  console.log(`${targetUserId} 在我的 followers?`, cfDiag.targetInMyFollowers)
  console.log(`${targetUserId} 在我的 friends?`, cfDiag.targetInMyFriends)

  await context.close()
})().catch(e => { console.error(e.message); process.exit(1) })
