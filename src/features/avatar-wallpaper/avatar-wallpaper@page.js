import parseHTML from '@libs/parseHTML'
import getLoggedInUserId from '@libs/getLoggedInUserId'
import { isTimelinePage } from '@libs/pageDetect'

const STORAGE_KEY_CACHE = 'avatar-wallpaper/cache'
const STORAGE_AREA = 'local'
const CACHE_SCHEMA_VERSION = 1
const CONTAINER_ID = 'sf-avatar-wallpaper'
const BODY_CLASSNAME = 'sf-avatar-wallpaper-enabled'
const DEFAULT_OPACITY = 0.22
const DEFAULT_BACKGROUND_PRESET = 2
const DEFAULT_REFRESH_INTERVAL_DAYS = 7
const MAX_RENDER_AVATARS = 520
const MAX_API_PAGES = 8
const MAX_WEB_PAGES = 8
const API_URL = 'https://api.fanfou.com/users/friends.json'
const BACKGROUND_PRESETS = [ {
  id: 1,
  background: 'linear-gradient(140deg, #f3f8ff 0%, #e6f0ff 45%, #d8e7ff 100%)',
}, {
  id: 2,
  background: 'linear-gradient(140deg, #edf5ff 0%, #dbe9ff 45%, #c8ddff 100%)',
}, {
  id: 3,
  background: 'linear-gradient(145deg, #dde9ff 0%, #c8dcff 45%, #b1cfff 100%)',
}, {
  id: 4,
  background: 'linear-gradient(140deg, #e6f7ff 0%, #d5eeff 45%, #bee3ff 100%)',
}, {
  id: 5,
  background: 'linear-gradient(145deg, #d9e7ff 0%, #bfd6ff 45%, #9fc2ff 100%)',
} ]

function toNumberOrDefault(value, defaultValue) {
  return Number.isFinite(value)
    ? value
    : defaultValue
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }

  return array
}

function normalizeAvatarUrl(url = '') {
  let normalized = String(url).trim()
  if (!normalized) return ''

  if (normalized.startsWith('//')) {
    normalized = `${window.location.protocol}${normalized}`
  }

  normalized = normalized
    .replace('/s0/', '/l0/')
    .replace('/s1/', '/l1/')
    .replace('/m0/', '/l0/')
    .replace('/m1/', '/l1/')

  return normalized
}

function dedupeAndNormalize(urls) {
  const set = new Set()

  for (const url of urls) {
    const normalized = normalizeAvatarUrl(url)
    if (normalized) set.add(normalized)
  }

  return [ ...set ]
}

function parseAvatarUrlsFromHtmlDocument(document) {
  const images = document.querySelectorAll([
    '#stream li .avatar img',
    '#friends li .avatar img',
    '#friends li img',
    '.users li .avatar img',
  ].join(', '))
  const urls = [ ...images ].map(image => (
    image.getAttribute('src') || image.getAttribute('data-src') || ''
  ))

  return dedupeAndNormalize(urls)
}

function buildPageUrlCandidates() {
  const userId = getLoggedInUserId()

  if (!userId) {
    return [
      'https://fanfou.com/friends',
    ]
  }

  const encodedUserId = encodeURIComponent(userId)

  return [
    `https://fanfou.com/friends/${encodedUserId}`,
    'https://fanfou.com/friends',
  ]
}

function createPageUrl(baseUrl, page) {
  return page === 1
    ? baseUrl
    : `${baseUrl.replace(/\/+$/, '')}/p.${page}`
}

async function fetchHtml(proxiedFetch, url) {
  const { error, responseText } = await proxiedFetch.get({ url })
  if (error || typeof responseText !== 'string') return ''

  return responseText
}

async function fetchAvatarUrlsFromWebPages(proxiedFetch) {
  for (const baseUrl of buildPageUrlCandidates()) {
    const avatars = []

    for (let page = 1; page <= MAX_WEB_PAGES; page++) {
      const pageUrl = createPageUrl(baseUrl, page)
      const html = await fetchHtml(proxiedFetch, pageUrl)

      if (!html) {
        if (page === 1) {
          avatars.length = 0
        }
        break
      }

      const document = parseHTML(html)
      const pageAvatarUrls = parseAvatarUrlsFromHtmlDocument(document)

      if (!pageAvatarUrls.length) {
        break
      }

      avatars.push(...pageAvatarUrls)
    }

    if (avatars.length) {
      return dedupeAndNormalize(avatars)
    }
  }

  return []
}

async function fetchAvatarUrlsFromApi(fanfouOAuth) {
  const avatars = []

  for (let page = 1; page <= MAX_API_PAGES; page++) {
    const { error, responseJSON } = await fanfouOAuth.request({
      url: API_URL,
      query: {
        count: 100,
        page,
      },
      responseType: 'json',
    })

    if (error) {
      throw new Error(error)
    }

    if (!Array.isArray(responseJSON) || responseJSON.length === 0) {
      break
    }

    for (const user of responseJSON) {
      avatars.push(user?.profile_image_url)
    }

    if (responseJSON.length < 100) {
      break
    }
  }

  return dedupeAndNormalize(avatars)
}

function isCacheFresh(cache, refreshIntervalDays) {
  if (!cache || cache.version !== CACHE_SCHEMA_VERSION) return false
  if (!Array.isArray(cache.avatars) || cache.avatars.length === 0) return false
  if (!cache.updatedAt) return false

  const ttl = refreshIntervalDays * 24 * 60 * 60 * 1000

  return Date.now() - cache.updatedAt < ttl
}

function readCache(storage) {
  return storage.read(STORAGE_KEY_CACHE, STORAGE_AREA)
}

function writeCache(storage, avatars) {
  return storage.write(STORAGE_KEY_CACHE, {
    version: CACHE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    avatars,
  }, STORAGE_AREA)
}

function resolveLayout(avatarCount) {
  if (avatarCount <= 110) {
    return { tileSize: 72, tileGap: 8 }
  }

  if (avatarCount <= 180) {
    return { tileSize: 64, tileGap: 6 }
  }

  if (avatarCount <= 280) {
    return { tileSize: 56, tileGap: 5 }
  }

  if (avatarCount <= 420) {
    return { tileSize: 52, tileGap: 4 }
  }

  return { tileSize: 48, tileGap: 3 }
}

function getBackgroundPreset(rawPresetId) {
  const presetId = clamp(
    toNumberOrDefault(rawPresetId, DEFAULT_BACKGROUND_PRESET),
    1,
    BACKGROUND_PRESETS.length,
  )

  return BACKGROUND_PRESETS[presetId - 1]
}

function getRenderAvatarUrls(avatars) {
  if (!avatars.length) return []

  return shuffle([ ...avatars ])
    .slice(0, MAX_RENDER_AVATARS)
}

function removeWallpaperContainer() {
  const existing = document.getElementById(CONTAINER_ID)

  if (existing) {
    existing.remove()
  }

  document.body.classList.remove(BODY_CLASSNAME)
}

function renderWallpaper({
  avatars,
  opacity,
  backgroundPreset,
}) {
  removeWallpaperContainer()

  if (!avatars.length) return

  const renderUrls = getRenderAvatarUrls(avatars)
  if (!renderUrls.length) return
  const { tileSize, tileGap } = resolveLayout(renderUrls.length)

  const container = document.createElement('div')
  const fragment = document.createDocumentFragment()

  container.id = CONTAINER_ID
  container.style.opacity = String(opacity)
  container.style.background = backgroundPreset.background
  container.style.setProperty('--sf-avatar-wallpaper-tile-size', `${tileSize}px`)
  container.style.setProperty('--sf-avatar-wallpaper-tile-gap', `${tileGap}px`)

  for (const url of renderUrls) {
    const tile = document.createElement('span')
    tile.className = 'sf-avatar-wallpaper-tile'
    tile.style.backgroundImage = `url("${url}")`
    fragment.append(tile)
  }

  container.append(fragment)
  document.body.prepend(container)
  document.body.classList.add(BODY_CLASSNAME)
}

export default context => {
  const {
    requireModules,
    readOptionValue,
  } = context
  const {
    storage,
    fanfouOAuth,
    proxiedFetch,
  } = requireModules([ 'storage', 'fanfouOAuth', 'proxiedFetch' ])

  let activeAvatarUrls = []
  let activeOpacity = DEFAULT_OPACITY
  let activeBackgroundPreset = BACKGROUND_PRESETS[DEFAULT_BACKGROUND_PRESET - 1]
  let resizeTimer = null

  async function fetchAvatarUrls() {
    try {
      const avatarsFromApi = await fetchAvatarUrlsFromApi(fanfouOAuth)

      if (avatarsFromApi.length) {
        return avatarsFromApi
      }
    } catch (error) {
      // OAuth 未配置或请求失败时，回退到页面抓取方案
    }

    return fetchAvatarUrlsFromWebPages(proxiedFetch)
  }

  async function ensureAvatarCache() {
    const refreshIntervalDays = clamp(
      toNumberOrDefault(readOptionValue('fetchIntervalDays'), DEFAULT_REFRESH_INTERVAL_DAYS),
      1,
      30,
    )
    const cache = await readCache(storage)

    if (isCacheFresh(cache, refreshIntervalDays)) {
      return cache.avatars
    }

    const fetchedUrls = await fetchAvatarUrls()

    if (fetchedUrls.length) {
      await writeCache(storage, fetchedUrls)
      return fetchedUrls
    }

    return Array.isArray(cache?.avatars)
      ? cache.avatars
      : []
  }

  function renderUsingActiveState() {
    renderWallpaper({
      avatars: activeAvatarUrls,
      opacity: activeOpacity,
      backgroundPreset: activeBackgroundPreset,
    })
  }

  async function initWallpaper() {
    activeOpacity = clamp(
      toNumberOrDefault(readOptionValue('opacity'), DEFAULT_OPACITY),
      0.08,
      0.65,
    )
    activeBackgroundPreset = getBackgroundPreset(
      readOptionValue('backgroundPreset'),
    )
    activeAvatarUrls = await ensureAvatarCache()

    renderUsingActiveState()
  }

  function handleResize() {
    if (!activeAvatarUrls.length) return

    if (resizeTimer) {
      clearTimeout(resizeTimer)
    }

    resizeTimer = setTimeout(() => {
      renderUsingActiveState()
      resizeTimer = null
    }, 180)
  }

  return {
    applyWhen: () => isTimelinePage(),

    async onLoad() {
      await initWallpaper()
      window.addEventListener('resize', handleResize)
    },

    onSettingsChange() {
      initWallpaper()
    },

    onUnload() {
      window.removeEventListener('resize', handleResize)
      if (resizeTimer) {
        clearTimeout(resizeTimer)
        resizeTimer = null
      }
      removeWallpaperContainer()
    },
  }
}
