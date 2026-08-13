/* eslint camelcase: off */
// no-script-url: 这个文件的意义就是把 `javascript:` 载荷喂给生成器，断言它出不来。
/* eslint no-script-url: off */

import buildArchiveHtml, { escapeHtml, toScriptSafeJson } from './buildHtml'

const meta = {
  archiveTimezone: 'Asia/Shanghai',
  account: { id: 'kiruoto', name: '断电模式' },
  lastSyncedAt: '2026-07-31T07:40:53.827Z',
  counts: { statuses: 2 },
  watermark: { statuses: { reachedFirstEver: true } },
}

function status(overrides = {}) {
  return {
    id: 'abc',
    created_at: 'Sat Jun 30 15:12:03 +0000 2012',
    text: '正文',
    user: { id: 'kiruoto', name: '断电模式' },
    _archive: { createdAtISO: '2012-06-30T15:12:03.000Z' },
    ...overrides,
  }
}

function build(statuses, availableMedia = new Map()) {
  return buildArchiveHtml({ meta, statuses, availableMedia })
}

test('the archive splits into one page per year plus an index and assets', () => {
  const files = build([
    status({ id: 'a', _archive: { createdAtISO: '2012-06-30T15:12:03.000Z' } }),
    status({ id: 'b', _archive: { createdAtISO: '2013-01-05T02:00:00.000Z' } }),
  ])

  expect(Object.keys(files).sort()).toEqual([
    '2012.html',
    '2013.html',
    'assets/archive.css',
    'assets/archive.js',
    'assets/search-index.js',
    'direct-messages.html',
    'index.html',
    'mentions.html',
  ])
  expect(files['index.html']).toContain('<a href="2013.html">2013 年</a>')
  expect(files['2012.html']).toContain('id="s-a"')
  expect(files['2013.html']).toContain('id="s-b"')
})

test('mentions have their own overview and yearly pages with the same safe renderer', () => {
  const files = buildArchiveHtml({
    meta: {
      ...meta,
      counts: { statuses: 2, mentions: 1 },
      watermark: { statuses: { reachedFirstEver: true }, mentions: { reachedFirstEver: true } },
    },
    statuses: [],
    mentions: [ status({ id: 'mention-xss', text: '<script>alert(1)</script>' }) ],
  })

  expect(files['index.html']).toContain('<a href="mentions.html">收到的提及</a>')
  expect(files['mentions.html']).toContain('<a href="mentions-2012.html">2012 年</a>')
  expect(files['mentions-2012.html']).toContain('id="s-mention-xss"')
  expect(files['mentions-2012.html']).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  expect(files['mentions-2012.html']).toContain(
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; style-src 'self'; script-src 'self'">`,
  )
})

test('direct messages have an offline-only reader with the same escaping rules', () => {
  const files = buildArchiveHtml({
    meta: { ...meta, counts: { statuses: 0, directMessages: 1 } },
    statuses: [],
    directMessages: [ status({
      id: 'dm-1',
      text: '<script>alert(1)</script>',
      sender: { id: 'alice', name: 'Alice' },
      _archive: { createdAtISO: '2012-06-30T15:12:03.000Z' },
    }) ],
  })

  expect(files['index.html']).toContain('<a href="direct-messages.html">私信</a>')
  expect(files['direct-messages.html']).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  expect(files['direct-messages.html']).not.toContain('statuses/dm-1')
})

test('a month boundary follows the archive timezone, not UTC', () => {
  // 2012-12-31T16:30Z 在东八区已经是 2013-01-01。
  const files = build([ status({
    id: 'edge',
    _archive: { createdAtISO: '2012-12-31T16:30:00.000Z' },
  }) ])

  expect(files['2013.html']).toContain('id="m-2013-01"')
  expect(files['2012.html']).toBeUndefined()
})

test('every page declares the offline CSP and loads only same-folder assets', () => {
  const files = build([ status() ])

  for (const name of [ 'index.html', '2012.html' ]) {
    expect(files[name]).toContain(
      `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; style-src 'self'; script-src 'self'">`,
    )
    expect(files[name]).toContain('<link rel="stylesheet" href="assets/archive.css">')
    expect(files[name]).not.toMatch(/src="https?:\/\//)
  }
})

describe('XSS: archive content must never become executable', () => {
  const payloads = {
    text: '<script>alert(1)</script> 和 <img src=x onerror="alert(2)"> 还有 javascript:alert(3)',
    userName: '断电模式"><script>alert(4)</script>',
    location: "'><svg onload=alert(5)>",
    source: '<a href="javascript:alert(6)">恶意客户端</a>',
  }

  const files = build([ status({
    id: 'xss',
    text: payloads.text,
    user: { id: 'kiruoto', name: payloads.userName },
    location: payloads.location,
    source: payloads.source,
    photo: { url: 'javascript:alert(7)', largeurl: 'https://s3-img.meituan.net/x.jpg' },
  }) ])
  const page = files['2012.html']

  test('no real tag carries an event handler or a javascript: url', () => {
    // 关键是「可执行形式」，不是字符串是否出现：`onerror=` 作为转义后的正文文本
    // 出现是正确的，它只有落在真实标签里才危险。这里逐个检查真实标签。
    const tags = page.match(/<[a-zA-Z][^>]*>/g) || []
    const dangerous = tags.filter(tag => /\son\w+\s*=/i.test(tag) || /javascript:/i.test(tag))

    expect(dangerous).toEqual([])
    expect(page).not.toContain('<script>alert')
    expect(page).not.toContain('<svg')
    // 只有我们自己那一个 <script src> 标签
    expect(page.match(/<script/g)).toEqual([ '<script' ])
  })

  test('payloads are still visible to the reader as plain text', () => {
    expect(page).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(page).toContain('断电模式&quot;&gt;&lt;script&gt;')
  })

  test('a javascript: photo url is never turned into a link', () => {
    expect(page).toContain('（配图未下载到本地）')
    expect(page).not.toContain('javascript:alert(7)')
  })

  test('a quote-closing username cannot break out of the alt attribute', () => {
    const withAvatar = build(
      [ status({ user: { id: 'kiruoto', name: payloads.userName } }) ],
      new Map([ [ 'avatars/kiruoto', 'avatars/kiruoto.jpg' ] ]),
    )['2012.html']

    expect(withAvatar).toContain('<img class="avatar" src="avatars/kiruoto.jpg"')
    expect(withAvatar).not.toContain('"><script>')
  })
})

test('bare http links become anchors but the surrounding text stays escaped', () => {
  const files = build([ status({
    text: '看这个 http://is.gd/0eTSJy <b>粗体</b>',
  }) ])

  expect(files['2012.html']).toContain(
    '<a href="http://is.gd/0eTSJy" rel="noreferrer">http://is.gd/0eTSJy</a>',
  )
  expect(files['2012.html']).toContain('&lt;b&gt;粗体&lt;/b&gt;')
})

test('a photo renders as an image only when the file is really on disk', () => {
  const withPhoto = status({
    photo: { url: 'http://fanfou.com/photo/x', largeurl: 'https://s3-img.meituan.net/x.jpg' },
  })

  const missing = build([ withPhoto ])['2012.html']
  expect(missing).toContain('配图未下载到本地')
  expect(missing).toContain('<a href="http://fanfou.com/photo/x"')

  const present = build(
    [ withPhoto ],
    new Map([ [ 'photos/2012-06/abc', 'photos/2012-06/abc.jpg' ] ]),
  )['2012.html']
  expect(present).toContain('<img src="photos/2012-06/abc.jpg" alt="配图" loading="lazy">')
  expect(present).not.toContain('配图未下载到本地')
})

test('the search index escapes anything that could close its own script tag', () => {
  const files = build([ status({ text: '</script><script>alert(1)</script>' }) ])
  const indexFile = files['assets/search-index.js']

  expect(indexFile).not.toContain('</script>')
  expect(indexFile).toContain('\\u003c/script\\u003e')
  expect(JSON.parse(indexFile.replace(/^window\.SF_INDEX = /, '').replace(/;\n$/, ''))).toEqual([ {
    i: 'abc',
    y: '2012',
    m: '2012-06',
    t: '</script><script>alert(1)</script>',
  } ])
})

test('escapeHtml covers every character that can break out of markup', () => {
  expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;')
  expect(escapeHtml(null)).toBe('')
  expect(escapeHtml(undefined)).toBe('')
  expect(escapeHtml(0)).toBe('0')
})

test('toScriptSafeJson neutralizes line separators that would break parsing', () => {
  expect(toScriptSafeJson('a\u2028b\u2029c')).toBe('"a\\u2028b\\u2029c"')
})

test('an empty archive still produces a usable index', () => {
  const files = buildArchiveHtml({ meta: { ...meta, counts: { statuses: 0 } }, statuses: [] })

  expect(Object.keys(files).sort()).toEqual([
    'assets/archive.css',
    'assets/archive.js',
    'assets/search-index.js',
    'direct-messages.html',
    'index.html',
    'mentions.html',
  ])
  expect(files['assets/search-index.js']).toBe('window.SF_INDEX = [];\n')
})
