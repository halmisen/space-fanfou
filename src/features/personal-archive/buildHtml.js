/* eslint camelcase: off */

import { ARCHIVE_TIMEZONE, getStatusMonth } from './statusRecords'
// 必须与下载器用同一个消毒函数，否则 HTML 引用的路径会和磁盘上的文件名对不上。
import { sanitizePathSegment } from './mediaUrls'

/**
 * 生成可脱网浏览的归档页面。纯函数：只产出 { 相对路径: 文本内容 }，写盘由调用方负责。
 *
 * 安全前提（spec 7.2）：归档正文是饭否上的任意用户内容，直接拼进 HTML 就是存储型 XSS，
 * 且会落在用户本地文件里。本模块所有来自 API 的字段一律先经 escapeHtml，链接化只在
 * 已转义的文本上进行。
 */

const CSP = "default-src 'none'; img-src 'self' data:; style-src 'self'; script-src 'self'"

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/[&<>"']/g, character => HTML_ESCAPES[character])
}

/**
 * 把 JSON 安全地嵌进 <script> 文件。`</script>` 与行分隔符会破坏解析，必须转成转义序列。
 */
export function toScriptSafeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

const URL_PATTERN = /https?:\/\/[^\s<>"']+/g

/**
 * 在**已转义**的文本上把裸链接变成 <a>。顺序不可颠倒：先转义再匹配，
 * 保证匹配到的内容里不可能含有未转义的尖括号或引号。
 *
 * 只认 http/https，`javascript:` 之类根本不会被这个正则匹配到。
 * `@提及` 与 `#话题#` 不做链接——API 的 text 只有显示名，拿不到可靠的用户 id。
 */
function linkifyEscaped(escapedText) {
  return escapedText.replace(URL_PATTERN, match => (
    `<a href="${match}" rel="noreferrer">${match}</a>`
  ))
}

function formatDateTime(isoString, timeZone) {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''

  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = type => parts.find(part => part.type === type)?.value || ''

  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}

function statusUrl(status) {
  const id = status?.rawid || status?.id
  return id ? `http://fanfou.com/statuses/${encodeURIComponent(id)}` : ''
}

function userUrl(userId) {
  return userId ? `http://fanfou.com/${encodeURIComponent(userId)}` : ''
}

function renderAvatar(user, availableMedia) {
  const path = availableMedia.get(`avatars/${sanitizePathSegment(user?.id || '')}`)
  if (!path) return '<span class="avatar avatar--missing" aria-hidden="true"></span>'

  return `<img class="avatar" src="${escapeHtml(path)}" alt="${escapeHtml(user?.name || user?.id || '')}" loading="lazy">`
}

function renderPhoto(status, availableMedia, mediaKey) {
  if (!status?.photo) return ''

  const path = availableMedia.get(mediaKey)
  if (path) {
    return `<figure class="photo"><img src="${escapeHtml(path)}" alt="配图" loading="lazy"></figure>`
  }

  // 图片还没下到本地（或下载失败）时降级为回饭否原页的链接，页面不会出现坏图。
  const { url } = status.photo
  if (!url || !/^https?:\/\//.test(url)) return '<p class="photo photo--missing">（配图未下载到本地）</p>'
  return `<p class="photo photo--missing">配图未下载到本地，<a href="${escapeHtml(url)}" rel="noreferrer">在饭否查看</a></p>`
}

function renderRelation(status) {
  if (status.repost_status_id) {
    return `<p class="relation">转自 <a href="${escapeHtml(userUrl(status.repost_user_id))}" rel="noreferrer">@${escapeHtml(status.repost_screen_name || status.repost_user_id || '')}</a></p>`
  }
  if (status.in_reply_to_status_id) {
    return `<p class="relation">回复 <a href="${escapeHtml(userUrl(status.in_reply_to_user_id))}" rel="noreferrer">@${escapeHtml(status.in_reply_to_screen_name || status.in_reply_to_user_id || '')}</a></p>`
  }
  return ''
}

function renderStatus(status, { availableMedia, timeZone }) {
  const statusId = sanitizePathSegment(status.id)
  const month = getStatusMonth(status, timeZone)
  const mediaKey = `photos/${month}/${statusId}`
  const createdAt = status._archive?.createdAtISO || status.created_at
  const permalink = statusUrl(status)

  // 头像是 .status 的直接子元素，才能被 grid 放进左栏并跨行。
  return [
    `<article class="status" id="s-${escapeHtml(statusId)}">`,
    renderAvatar(status.user, availableMedia),
    '<header>',
    `<span class="name">${escapeHtml(status.user?.name || status.user?.id || '')}</span>`,
    `<time datetime="${escapeHtml(createdAt)}">${escapeHtml(formatDateTime(createdAt, timeZone))}</time>`,
    '</header>',
    `<p class="text">${linkifyEscaped(escapeHtml(status.text || ''))}</p>`,
    renderPhoto(status, availableMedia, mediaKey),
    renderRelation(status),
    '<footer>',
    status.location ? `<span class="location">${escapeHtml(status.location)}</span>` : '',
    status.source ? `<span class="source">来自 ${escapeHtml(stripTags(status.source))}</span>` : '',
    permalink ? `<a class="permalink" href="${escapeHtml(permalink)}" rel="noreferrer">原文</a>` : '',
    '</footer>',
    '</article>',
  ].filter(Boolean).join('\n')
}

// source 字段有时是一段 HTML（`<a href="...">客户端</a>`）。这里取纯文本，
// 再交给 escapeHtml——两道处理都在，任何一道单独也足以挡住注入。
function stripTags(value) {
  return String(value).replace(/<[^>]*>/g, '').trim()
}

function page({ title, bodyClass, main, extraScript = '' }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="assets/archive.css">
</head>
<body class="${escapeHtml(bodyClass)}">
${main}
<footer class="page-footer">由太空饭否在你的浏览器本地生成，数据不上传任何服务器。</footer>
${extraScript}
<script src="assets/archive.js"></script>
</body>
</html>
`
}

function groupByYear(statuses, timeZone) {
  const years = new Map()

  for (const status of statuses || []) {
    const month = getStatusMonth(status, timeZone)
    if (!month) continue
    const year = month.slice(0, 4)

    if (!years.has(year)) years.set(year, new Map())
    const months = years.get(year)
    if (!months.has(month)) months.set(month, [])
    months.get(month).push(status)
  }

  return years
}

function compareNewestFirst(a, b) {
  const aTime = Date.parse(a?._archive?.createdAtISO || a?.created_at || '') || 0
  const bTime = Date.parse(b?._archive?.createdAtISO || b?.created_at || '') || 0
  if (aTime !== bTime) return bTime - aTime
  return String(b.id).localeCompare(String(a.id))
}

/**
 * 总是按年分卷：index.html 是概览与跨年搜索，YYYY.html 是该年全部消息。
 * 不设体积阈值——两万条以上的单页在任何阈值下都不成立，分卷是唯一稳定形态。
 */
export default function buildArchiveHtml({
  meta,
  statuses,
  mentions = [],
  availableMedia = new Map(),
}) {
  const timeZone = meta?.archiveTimezone || ARCHIVE_TIMEZONE
  const years = groupByYear(statuses, timeZone)
  const sortedYears = [ ...years.keys() ].sort().reverse()
  const files = {}
  const searchIndex = []

  for (const year of sortedYears) {
    const months = years.get(year)
    const sortedMonths = [ ...months.keys() ].sort().reverse()
    const sections = []

    for (const month of sortedMonths) {
      const monthStatuses = months.get(month).slice().sort(compareNewestFirst)

      for (const status of monthStatuses) {
        searchIndex.push({
          i: sanitizePathSegment(status.id),
          y: year,
          m: month,
          t: status.text || '',
        })
      }

      sections.push([
        `<section class="month" id="m-${escapeHtml(month)}">`,
        `<h2>${escapeHtml(month)}<span class="count">${monthStatuses.length} 条</span></h2>`,
        monthStatuses.map(status => renderStatus(status, { availableMedia, timeZone })).join('\n'),
        '</section>',
      ].join('\n'))
    }

    const total = sortedMonths.reduce((sum, month) => sum + months.get(month).length, 0)
    const monthNav = sortedMonths
      .map(month => `<a href="#m-${escapeHtml(month)}">${escapeHtml(month)}</a>`)
      .join('\n')

    files[`${year}.html`] = page({
      title: `${year} 年 · 饭否归档`,
      bodyClass: 'year-page',
      main: [
        '<header class="page-header">',
        `<h1>${escapeHtml(year)} 年</h1>`,
        `<p class="summary">共 ${total} 条 · <a href="index.html">返回总览</a></p>`,
        `<nav class="month-nav">${monthNav}</nav>`,
        '</header>',
        '<main>',
        sections.join('\n'),
        '</main>',
      ].join('\n'),
    })
  }

  const account = meta?.account || {}
  const watermark = meta?.watermark?.statuses || {}
  const yearRows = sortedYears.map(year => {
    const months = years.get(year)
    const total = [ ...months.values() ].reduce((sum, list) => sum + list.length, 0)
    return `<li><a href="${escapeHtml(year)}.html">${escapeHtml(year)} 年</a><span class="count">${total} 条</span></li>`
  }).join('\n')

  files['index.html'] = page({
    title: `${account.name || account.id || '饭否'} 的归档`,
    bodyClass: 'index-page',
    main: [
      '<header class="page-header">',
      `<h1>${escapeHtml(account.name || account.id || '饭否归档')}</h1>`,
      `<p class="summary">共 ${meta?.counts?.statuses || 0} 条消息 · 最近同步 ${escapeHtml(formatDateTime(meta?.lastSyncedAt, timeZone) || '尚未完成')}</p>`,
      watermark.reachedFirstEver ? '<p class="summary">已回填到账号第一条消息。</p>' : '',
      '</header>',
      '<main>',
      '<section class="search">',
      '<label for="q">搜索全部消息</label>',
      '<input id="q" type="search" placeholder="输入关键词，回车或直接输入即可" autocomplete="off">',
      '<p id="search-status" class="search-status"></p>',
      '<ol id="results" class="results"></ol>',
      '</section>',
      '<section class="years">',
      '<h2>按年浏览</h2>',
      `<ul class="year-list">${yearRows}</ul>`,
      '</section>',
      '<section class="years">',
      '<h2>其他归档</h2>',
      `<ul class="year-list"><li><a href="mentions.html">收到的提及</a><span class="count">${meta?.counts?.mentions || 0} 条</span></li></ul>`,
      '</section>',
      '</main>',
    ].filter(Boolean).join('\n'),
    extraScript: '<script src="assets/search-index.js"></script>',
  })

  const mentionYears = groupByYear(mentions, timeZone)
  const sortedMentionYears = [ ...mentionYears.keys() ].sort().reverse()
  const mentionWatermark = meta?.watermark?.mentions || {}
  const mentionRows = sortedMentionYears.map(year => {
    const months = mentionYears.get(year)
    const total = [ ...months.values() ].reduce((sum, list) => sum + list.length, 0)
    return `<li><a href="mentions-${escapeHtml(year)}.html">${escapeHtml(year)} 年</a><span class="count">${total} 条</span></li>`
  }).join('\n')

  for (const year of sortedMentionYears) {
    const months = mentionYears.get(year)
    const sortedMonths = [ ...months.keys() ].sort().reverse()
    const sections = sortedMonths.map(month => {
      const monthStatuses = months.get(month).slice().sort(compareNewestFirst)
      return [
        `<section class="month" id="m-${escapeHtml(month)}">`,
        `<h2>${escapeHtml(month)}<span class="count">${monthStatuses.length} 条</span></h2>`,
        monthStatuses.map(status => renderStatus(status, { availableMedia, timeZone })).join('\n'),
        '</section>',
      ].join('\n')
    })
    const total = sortedMonths.reduce((sum, month) => sum + months.get(month).length, 0)
    const monthNav = sortedMonths
      .map(month => `<a href="#m-${escapeHtml(month)}">${escapeHtml(month)}</a>`)
      .join('\n')

    files[`mentions-${year}.html`] = page({
      title: `${year} 年收到的提及 · 饭否归档`,
      bodyClass: 'year-page',
      main: [
        '<header class="page-header">',
        `<h1>${escapeHtml(year)} 年收到的提及</h1>`,
        `<p class="summary">共 ${total} 条 · <a href="mentions.html">返回提及总览</a></p>`,
        `<nav class="month-nav">${monthNav}</nav>`,
        '</header>',
        `<main>${sections.join('\n')}</main>`,
      ].join('\n'),
    })
  }

  files['mentions.html'] = page({
    title: '收到的提及 · 饭否归档',
    bodyClass: 'index-page',
    main: [
      '<header class="page-header">',
      '<h1>收到的提及</h1>',
      `<p class="summary">共 ${meta?.counts?.mentions || 0} 条</p>`,
      mentionWatermark.reachedFirstEver ? '<p class="summary">已回填到最早可获取的提及。</p>' : '<p class="summary">尚未完成完整同步。</p>',
      '<p class="summary"><a href="index.html">返回消息总览</a></p>',
      '</header>',
      `<main><section class="years"><h2>按年浏览</h2><ul class="year-list">${mentionRows}</ul></section></main>`,
    ].filter(Boolean).join('\n'),
  })

  files['assets/search-index.js'] = `window.SF_INDEX = ${toScriptSafeJson(searchIndex)};\n`
  files['assets/archive.css'] = ARCHIVE_CSS
  files['assets/archive.js'] = ARCHIVE_JS

  return files
}

/*
 * 归档页的视觉基准是 `design-sync/bundle/pages/design-spec.html`——2026-07-13 在插件生效状态下
 * 从真实饭否页面量出来的《太空饭否当前设计规格》。数值（#336 / #933 / #999、12px 基准、
 * 14px/22.4px 正文、775px 容器、48px 方形头像、字体族）一律以那张表为准，不要改成设置页的 token：
 * 设置页是插件自有页面，饭否本体是另一套配色，归档页属于后者。
 */
const ARCHIVE_CSS = `:root {
  --fg: #336;
  --link: #933;
  --muted: #999;
  --line: #eee;
  --page: #fff;
  --container: 775px;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 0 16px 64px;
  background: var(--page);
  color: var(--fg);
  font: normal 12px/18px "Segoe UI Emoji", "Avenir Next", Avenir, "Segoe UI", "Helvetica Neue", Helvetica, sans-serif;
}
a { color: var(--link); text-decoration: none; }
a:hover { text-decoration: underline; }

.page-header, main > section, .search, .page-footer {
  max-width: var(--container); margin-left: auto; margin-right: auto;
}

.page-header { padding: 28px 0 14px; border-bottom: 1px solid var(--line); margin-bottom: 18px; }
.page-header h1 { margin: 0 0 6px; font-size: 24px; font-weight: bold; color: var(--fg); }
.summary { margin: 2px 0; color: var(--muted); font-size: 12px; line-height: 18px; }
.month-nav { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 12px;
  font-size: 14px; line-height: 25px; }

.search { margin-bottom: 24px; }
.search label { display: block; font-size: 14px; font-weight: bold; color: var(--fg); margin-bottom: 8px; }
.search input {
  width: 100%; padding: 6px 8px; font-size: 14px; line-height: 16.8px; font-family: inherit;
  border: 1px solid #ccc; background: #fff; color: #000;
}
.search input:focus { outline: none; border-color: #999; }
.search-status { font-size: 12px; color: var(--muted); min-height: 18px; margin: 10px 0 0; }
.results { list-style: none; padding: 0; margin: 8px 0 0; }
.results li { border-top: 1px solid var(--line); padding: 8px 0; font-size: 14px; line-height: 22.4px; }
.results .meta { color: var(--muted); font-size: 12px; margin-right: 10px; }

.years, .month { margin-bottom: 24px; }
.years h2, .month h2 {
  margin: 0; padding: 10px 0 8px; font-size: 14px; line-height: 18px; font-weight: bold;
  color: var(--fg); border-bottom: 1px solid var(--line);
}
.count { color: var(--muted); font-size: 12px; font-weight: normal; margin-left: 8px; }
.year-list { list-style: none; padding: 0; margin: 0; }
.year-list li { display: flex; justify-content: space-between; align-items: baseline;
  padding: 7px 0; border-bottom: 1px solid var(--line); font-size: 14px; line-height: 25px; }
.year-list li:last-child { border-bottom: none; }

/* 一条消息：左 48px 方形头像，右作者 / 正文 / 元信息，与饭否时间线同构 */
.status { display: grid; grid-template-columns: 48px 1fr; gap: 0 10px;
  padding: 12px 0; border-bottom: 1px solid var(--line); }
.status:last-child { border-bottom: none; }
.status header { grid-column: 2; display: flex; align-items: baseline; gap: 8px; margin-bottom: 2px; }
.avatar { grid-row: 1 / span 4; grid-column: 1;
  width: 48px; height: 48px; object-fit: cover; }
.avatar--missing { background: var(--line); display: block; }
.status .name { font-weight: bold; color: var(--link); font-size: 14px; }
.status time { color: var(--muted); font-size: 12px; margin-left: auto; white-space: nowrap; }
.text { grid-column: 2; margin: 0; color: var(--fg); font-size: 14px; line-height: 22.4px;
  word-wrap: break-word; overflow-wrap: anywhere; }
.photo { grid-column: 2; margin: 8px 0 0; }
.photo img { max-width: 100%; max-height: 420px; height: auto; display: block; }
.photo--missing { font-size: 12px; color: var(--muted); }
.relation { grid-column: 2; margin: 5px 0 0; padding-left: 10px;
  border-left: 3px solid var(--line); font-size: 14px; line-height: 22.4px; color: var(--muted); }
.status footer { grid-column: 2; margin-top: 4px; font-size: 12px; line-height: 18px; color: var(--muted);
  display: flex; flex-wrap: wrap; gap: 12px; }

.page-footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--line);
  font-size: 12px; color: var(--muted); text-align: center; }

@media (max-width: 800px) {
  body { padding: 0 12px 48px; }
  .status { grid-template-columns: 36px 1fr; gap: 0 10px; }
  .avatar { width: 36px; height: 36px; }
}
`

const ARCHIVE_JS = `(function () {
  'use strict';
  var input = document.getElementById('q');
  if (!input || !window.SF_INDEX) return;

  var results = document.getElementById('results');
  var statusLine = document.getElementById('search-status');
  var LIMIT = 200;

  function render(keyword) {
    results.textContent = '';
    if (!keyword) {
      statusLine.textContent = '';
      return;
    }

    var needle = keyword.toLowerCase();
    var matches = [];
    for (var i = 0; i < window.SF_INDEX.length && matches.length < LIMIT; i++) {
      var item = window.SF_INDEX[i];
      if (item.t.toLowerCase().indexOf(needle) !== -1) matches.push(item);
    }

    var total = 0;
    for (var j = 0; j < window.SF_INDEX.length; j++) {
      if (window.SF_INDEX[j].t.toLowerCase().indexOf(needle) !== -1) total++;
    }

    statusLine.textContent = total
      ? '找到 ' + total + ' 条' + (total > LIMIT ? '，显示前 ' + LIMIT + ' 条' : '')
      : '没有找到包含「' + keyword + '」的消息';

    var fragment = document.createDocumentFragment();
    matches.forEach(function (item) {
      var li = document.createElement('li');
      var meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = item.m;
      var link = document.createElement('a');
      link.href = item.y + '.html#s-' + item.i;
      // textContent 而非 innerHTML：归档正文永远只作为文本节点插入。
      link.textContent = item.t;
      li.appendChild(meta);
      li.appendChild(link);
      fragment.appendChild(li);
    });
    results.appendChild(fragment);
  }

  var timer = null;
  input.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { render(input.value.trim()); }, 120);
  });
})();
`
