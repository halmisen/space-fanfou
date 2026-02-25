import OAuthOptions from '../../background/environment/fanfouOAuth'

// Wait before executing to avoid immediate API blast on startup
const STARTUP_DELAY = 10 * 1000 // 10 seconds

const CACHE_KEY = 'avatarWallpaperData'
const DEFAULT_FETCH_INTERVAL_DAYS = 7
const MS_PER_DAY = 24 * 60 * 60 * 1000

// We will export a function that can be triggered to force refresh
// eslint-disable-next-line import/prefer-default-export
export async function refreshAvatarWallpaperData() {
  try {
    const friendAvatars = await fetchAllFriendAvatars()
    const now = Date.now()

    await new Promise(resolve => {
      chrome.storage.local.set({
        [CACHE_KEY]: {
          timestamp: now,
          avatars: friendAvatars,
        },
      }, resolve)
    })

    return friendAvatars
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[AvatarWallpaper] Error fetching friend avatars:', err)
    throw err
  }
}

async function fetchAllFriendAvatars(cursor = -1, accumulatedAvatars = [], page = 1) {
  // To avoid hitting API limits hard, we limit to max 3 pages (around 300+ friends usually returned per page in some old APIs, or 100 per page)
  const MAX_PAGES = 3

  if (page > MAX_PAGES) {
    return accumulatedAvatars
  }

  // Need to use the proper Fanfou OAuth token
  // Let's get the token using the OAuth utility
  const url = `http://api.fanfou.com/friendships/friends.json?cursor=${cursor}`

  // Note: We need OAuth signature here.
  // The global window.client or similar might not be easily accessible in isolated background script
  // if it doesn't import the full client.
  // We will build the request manually via the environment OAuth helper

  const token = await OAuthOptions.getToken()
  if (!token || !token.oauthToken || !token.oauthTokenSecret) {
    // eslint-disable-next-line no-console
    console.log('[AvatarWallpaper] No valid OAuth token found. Skipping avatar fetch.')
    return accumulatedAvatars
  }

  const oauth = OAuthOptions.getOAuth()

  const requestData = {
    url,
    method: 'GET',
    data: {},
  }

  const authorizedData = oauth.authorize(requestData, {
    key: token.oauthToken,
    secret: token.oauthTokenSecret,
  })

  // Convert authorized data into headers
  const headers = oauth.toHeader(authorizedData)

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })

  if (!response.ok) {
    // eslint-disable-next-line no-console
    console.error(`[AvatarWallpaper] API returned ${response.status}`)
    return accumulatedAvatars
  }

  const data = await response.json()

  // Array of friend objects
  if (Array.isArray(data)) {
    // some endpoints return array directly
    data.forEach(user => {
      if (user && user.profile_image_url) {
        accumulatedAvatars.push(user.profile_image_url)
      }
    })
    // No cursor in simple array response
    return accumulatedAvatars
  } else if (data && data.users) {
    // Standard cursored response structure
    data.users.forEach(user => {
      if (user && user.profile_image_url) {
        accumulatedAvatars.push(user.profile_image_url)
      }
    })

    if (data.next_cursor && data.next_cursor !== 0 && data.next_cursor !== '0') {
      return fetchAllFriendAvatars(data.next_cursor, accumulatedAvatars, page + 1)
    }
  }

  return accumulatedAvatars
}

async function checkAndRefreshIfNeeded() {
  const data = await new Promise(resolve => {
    chrome.storage.local.get([ CACHE_KEY, 'options' ], resolve)
  })

  const cache = data[CACHE_KEY]
  const options = data.options || {}

  // Skip if feature is disabled
  if (options['avatar-wallpaper'] === false) {
    return
  }

  const intervalDays = options['avatar-wallpaper_fetchIntervalDays'] || DEFAULT_FETCH_INTERVAL_DAYS
  const intervalMs = intervalDays * MS_PER_DAY

  const now = Date.now()

  if (!cache || !cache.timestamp || !cache.avatars || (now - cache.timestamp > intervalMs)) {
    // eslint-disable-next-line no-console
    console.log('[AvatarWallpaper] Cache expired or missing, fetching new avatars...')
    await refreshAvatarWallpaperData()
  } else {
    // eslint-disable-next-line no-console
    console.log('[AvatarWallpaper] Using cached avatars. Next refresh in', Math.round((intervalMs - (now - cache.timestamp)) / 1000 / 60 / 60), 'hours.')
  }
}

// Automatically check when feature loads
setTimeout(checkAndRefreshIfNeeded, STARTUP_DELAY)

// Expose to messages for manual refresh via settings page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'REFRESH_AVATAR_WALLPAPER') {
    refreshAvatarWallpaperData()
      .then(avatars => {
        sendResponse({ success: true, count: avatars.length })
      })
      .catch(err => {
        sendResponse({ success: false, error: err.toString() })
      })
    return true // indicates asynchronous response
  }
})
