/* eslint camelcase: off */

import manifest from '../../../static/manifest.json'
import {
  ALLOWED_MEDIA_HOSTS,
  collectAllMediaTargets,
  collectMediaTargets,
} from './mediaUrls'

function photo(host) {
  return {
    url: 'http://fanfou.com/photo/kMXL8LtnlEc',
    imageurl: `https://${host}/x/eg_73115.jpg@200w_200h_1l.jpg`,
    thumburl: `https://${host}/x/eg_73115.jpg@120w_120h_1l.jpg`,
    largeurl: `https://${host}/x/eg_73115.jpg@596w_1l.jpg`,
  }
}

function status(overrides = {}) {
  return {
    id: 'abc',
    created_at: 'Sat Jun 30 15:12:03 +0000 2012',
    text: '正文',
    user: {
      id: 'kiruoto',
      name: '断电模式',
      profile_image_url: 'https://s3.meituan.net/v1/avatar/s0/8p.jpg?1566815876',
    },
    ...overrides,
  }
}

test('manifest host_permissions stays in sync with the media host allowlist', () => {
  const declaredMeituanHosts = manifest.host_permissions
    .map(pattern => {
      try {
        return new URL(pattern).host
      } catch (_) {
        return null
      }
    })
    .filter(host => host && host.endsWith('meituan.net'))
    .sort()

  expect(declaredMeituanHosts).toEqual([ ...ALLOWED_MEDIA_HOSTS ].sort())
})

test('a status contributes its photo and avatar under month and user paths', () => {
  const { targets, skipped } = collectMediaTargets(status({
    photo: photo('s3-img.meituan.net'),
  }))

  expect(skipped).toEqual([])
  expect(targets).toEqual([
    {
      kind: 'photo',
      sourceUrl: 'https://s3-img.meituan.net/x/eg_73115.jpg@596w_1l.jpg',
      relativePathWithoutExtension: 'photos/2012-06/abc',
    },
    {
      kind: 'avatar',
      sourceUrl: 'https://s3.meituan.net/v1/avatar/s0/8p.jpg?1566815876',
      relativePathWithoutExtension: 'avatars/kiruoto',
    },
  ])
})

test('a nested repost contributes its own photo and the original author avatar', () => {
  const { targets } = collectMediaTargets(status({
    repost_status: {
      id: 'z0Mm9jtZTTE',
      photo: photo('s3-img.meituan.net'),
      user: {
        id: 'gnagoul',
        name: '尚飯',
        profile_image_url: 'https://s3.meituan.net/v1/avatar/s0/other.jpg',
      },
    },
  }))

  expect(targets.map(item => item.relativePathWithoutExtension)).toEqual([
    'avatars/kiruoto',
    'photos/2012-06/abc-repost',
    'avatars/gnagoul',
  ])
})

test('an unlisted host is reported instead of fetched', () => {
  const { targets, skipped } = collectMediaTargets(status({
    photo: photo('cdn.example.com'),
  }))

  expect(targets.map(item => item.kind)).toEqual([ 'avatar' ])
  expect(skipped).toEqual([ {
    host: 'cdn.example.com',
    sourceUrl: 'https://cdn.example.com/x/eg_73115.jpg@596w_1l.jpg',
  } ])
})

test('collecting a whole archive dedupes shared avatars and tallies skipped hosts', () => {
  const { targets, skippedByHost } = collectAllMediaTargets([
    status({ id: 'a', photo: photo('s3-img.meituan.net') }),
    status({ id: 'b', photo: photo('s3-img.meituan.net') }),
    status({ id: 'c', photo: photo('old.fanfou.com') }),
    status({ id: 'd', photo: photo('old.fanfou.com') }),
  ])

  expect(targets.map(item => item.relativePathWithoutExtension)).toEqual([
    'photos/2012-06/a',
    'avatars/kiruoto',
    'photos/2012-06/b',
  ])
  expect(skippedByHost).toEqual({ 'old.fanfou.com': 2 })
})

test('a status id can never escape the backup directory', () => {
  const { targets } = collectMediaTargets(status({
    id: '../../evil',
    photo: photo('s3-img.meituan.net'),
  }))

  expect(targets[0].relativePathWithoutExtension).toBe('photos/2012-06/.._2f_.._2f_evil')
})

test('distinct non-ascii user ids never collide on the same avatar file', () => {
  // 饭否存在中文 id（实测有「鱼小颜」「瓦上霜」这样的账号）。把不安全字符一律换成 `_`
  // 会让这两个同为三字的 id 都变成 `___`，两个人共用一张头像。
  const paths = [ '鱼小颜', '瓦上霜', '爱自', '路边小西' ].map(id => (
    collectMediaTargets(status({ user: {
      id,
      name: id,
      profile_image_url: `https://s3.meituan.net/v1/avatar/${encodeURIComponent(id)}.jpg`,
    } })).targets[0].relativePathWithoutExtension
  ))

  expect(new Set(paths).size).toBe(4)
  expect(paths[0]).toBe('avatars/_9c7c__5c0f__989c_')
})

test('a status with an unparseable creation time yields nothing instead of throwing', () => {
  const { targets, skipped } = collectMediaTargets(status({
    created_at: 'not-a-date',
    photo: photo('s3-img.meituan.net'),
  }))

  expect(targets).toEqual([])
  expect(skipped).toEqual([])
})
