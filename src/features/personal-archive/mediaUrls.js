/* eslint camelcase: off */

import { getStatusMonth } from './statusRecords'

/**
 * 饭否的图床与头像早已迁到美团 S3，不在 `*.fanfou.com` 下。
 * 这份白名单必须与 `static/manifest.json` 的 `host_permissions` 保持一致，
 * 否则 fetch 会被 CORS 挡死；`mediaUrls.test.js` 有一致性断言防止两边漂移。
 */
export const ALLOWED_MEDIA_HOSTS = [
  's3-img.meituan.net',
  's3.meituan.net',
]

function getHost(url) {
  try {
    return new URL(url).host
  } catch (_) {
    return null
  }
}

/**
 * 用作文件名的 id 全部来自 API，这里只允许安全字符，避免 `../` 之类穿出备份目录。
 *
 * 不能简单地把不安全字符替换成 `_`——饭否存在中文用户 id（实测有「鱼小颜」「瓦上霜」
 * 这样的账号），一律换成 `_` 会让不同的人碰撞到同一个头像文件名。这里改为把每个
 * 不安全字符编码成 `_<码点十六进制>_`，结尾的分隔符保证变长的十六进制不会产生歧义。
 */
export function sanitizePathSegment(value) {
  return String(value).replace(
    /[^A-Za-z0-9.-]/gu,
    character => `_${character.codePointAt(0).toString(16)}_`,
  )
}

/**
 * 一条待下载的媒体。`relativePath` 不带扩展名——真实扩展名由 `Content-Type` 决定，
 * 见 `mediaDownloader.js`。
 */
function target(kind, sourceUrl, relativePathWithoutExtension) {
  return { kind, sourceUrl, relativePathWithoutExtension }
}

function collectFromPhoto(photo, month, basename, results) {
  // largeurl 是 API 给出的最大尺寸（596w），只下这一份，列表页用 CSS 限制显示尺寸。
  const sourceUrl = photo?.largeurl || photo?.imageurl || photo?.thumburl
  if (!sourceUrl) return

  const host = getHost(sourceUrl)
  if (!host) return
  if (!ALLOWED_MEDIA_HOSTS.includes(host)) {
    results.skipped.push({ host, sourceUrl })
    return
  }

  results.targets.push(target('photo', sourceUrl, `photos/${month}/${basename}`))
}

function collectFromUser(user, results) {
  const sourceUrl = user?.profile_image_url
  if (!sourceUrl || !user?.id) return

  const host = getHost(sourceUrl)
  if (!host) return
  if (!ALLOWED_MEDIA_HOSTS.includes(host)) {
    results.skipped.push({ host, sourceUrl })
    return
  }

  // 按 userId 落盘，天然去重：同一个人在几千条消息里只下一次头像。
  results.targets.push(target('avatar', sourceUrl, `avatars/${sanitizePathSegment(user.id)}`))
}

/**
 * 从一条 status 收集全部待下载媒体，含嵌套的 `repost_status`（转发原文）。
 * 返回 `{ targets, skipped }`；`skipped` 是域名不在白名单的项，由调用方统计后展示给用户。
 */
export function collectMediaTargets(status, timeZone) {
  const results = { targets: [], skipped: [] }
  if (!status?.id) return results

  const month = getStatusMonth(status, timeZone)
  if (!month) return results

  const statusId = sanitizePathSegment(status.id)

  collectFromPhoto(status.photo, month, statusId, results)
  collectFromUser(status.user, results)

  if (status.repost_status) {
    // 转发原文的配图与作者头像同样属于「这条消息的完整样貌」，一起存。
    collectFromPhoto(status.repost_status.photo, month, `${statusId}-repost`, results)
    collectFromUser(status.repost_status.user, results)
  }

  return results
}

/**
 * 对整份归档做一次收集，按 `relativePathWithoutExtension` 去重。
 */
export function collectAllMediaTargets(statuses, timeZone) {
  const targetsByPath = new Map()
  const skippedByHost = {}

  for (const status of statuses || []) {
    const { targets, skipped } = collectMediaTargets(status, timeZone)

    for (const item of targets) {
      if (!targetsByPath.has(item.relativePathWithoutExtension)) {
        targetsByPath.set(item.relativePathWithoutExtension, item)
      }
    }
    for (const item of skipped) {
      skippedByHost[item.host] = (skippedByHost[item.host] || 0) + 1
    }
  }

  return {
    targets: [ ...targetsByPath.values() ],
    skippedByHost,
  }
}
