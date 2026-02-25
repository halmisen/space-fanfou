import elementReady from 'element-ready'
import css from './avatar-wallpaper.css'

const CACHE_KEY = 'avatarWallpaperData'
const CONTAINER_ID = 'space-fanfou-wallpaper-container'

export default async function () {
  const options = await new Promise(resolve => {
    chrome.storage.local.get([ 'options', CACHE_KEY ], resolve)
  })

  // Only proceed if feature is enabled
  if (options.options['avatar-wallpaper'] === false) {
    return
  }

  const { [CACHE_KEY]: cache, options: config } = options

  if (!cache || !cache.avatars || cache.avatars.length === 0) {
    // eslint-disable-next-line no-console
    console.log('[AvatarWallpaper] No avatars available yet.')
    return
  }

  // Ensure body is ready
  await elementReady('body')

  // Inject styles
  const styleEl = document.createElement('style')
  styleEl.textContent = css
  document.head.append(styleEl)

  // Avoid duplicates
  if (document.getElementById(CONTAINER_ID)) {
    return
  }

  // Create wallpaper container
  const container = document.createElement('div')
  container.id = CONTAINER_ID

  // Apply opacity from settings (fallback to 0.15)
  const opacity = config['avatar-wallpaper_opacity'] || 0.15
  container.style.opacity = parseFloat(opacity).toString()

  // Shuffle array for random layout
  const shuffledAvatars = [ ...cache.avatars ].sort(() => 0.5 - Math.random())

  // Create fragments for better performance
  const fragment = document.createDocumentFragment()

  // Create an avatar element for each URL
  shuffledAvatars.forEach(url => {
    // Some urls might be default or invalid
    if (!url || typeof url !== 'string') return

    // Convert to larger avatar version if possible by replacing specific suffix
    // e.g. https://.../s0/xx.jpg -> https://.../m0/xx.jpg
    const hdUrl = url.replace('/s0/', '/m0/')

    const avatarEl = document.createElement('div')
    avatarEl.className = 'sf-wallpaper-avatar'
    avatarEl.style.backgroundImage = `url("${hdUrl}")`
    fragment.append(avatarEl)
  })

  container.append(fragment)
  document.body.prepend(container)
}
