import messaging from '@background/environment/messaging'
import { PERSONAL_ARCHIVE_DOWNLOAD_IMAGES } from '@constants'

function getExtension(url) {
  const { pathname } = new URL(url)
  const match = pathname.match(/\.(jpe?g|png|gif|bmp|webp)$/i)

  return match ? match[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg'
}

function download(url, filename) {
  return new Promise(resolve => {
    chrome.downloads.download({
      url,
      filename,
      conflictAction: 'uniquify',
      saveAs: false,
    }, downloadId => {
      resolve({
        url,
        filename,
        downloadId: downloadId || null,
        error: chrome.runtime.lastError?.message || null,
      })
    })
  })
}

export default () => {
  return {
    onLoad() {
      messaging.registerHandler(PERSONAL_ARCHIVE_DOWNLOAD_IMAGES, async payload => {
        const items = Array.isArray(payload?.items) ? payload.items : []
        const folder = payload?.folder || 'space-fanfou-archive/images'
        const results = []

        for (const item of items) {
          if (!item?.url) continue

          const statusId = item.statusId || `image-${results.length + 1}`
          const ext = getExtension(item.url)
          const filename = `${folder}/${statusId}.${ext}`

          results.push(await download(item.url, filename))
        }

        return { results }
      })
    },

    onUnload() {
      messaging.unregisterHandler(PERSONAL_ARCHIVE_DOWNLOAD_IMAGES)
    },
  }
}
