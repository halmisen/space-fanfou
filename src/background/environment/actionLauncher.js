const FANFOU_HOME_URL = 'https://fanfou.com/home'
const FANFOU_TAB_URL_PATTERNS = [
  'https://fanfou.com/*',
  'http://fanfou.com/*',
]
// MV3 里 default_popup 与 onClicked 互斥，所以 popup 按标签页动态挂载：
// 饭否标签页弹出设置弹窗（旧版 default_popup 行为），其他标签页走跳转
const SETTINGS_POPUP_URL = 'settings.html'
const POPUP_TITLE = '太空饭否'
let actionClickHandlerInstalled = false

function isFanfouTabUrl(url) {
  return /^https?:\/\/fanfou\.com\//.test(url || '')
}

async function syncActionForTab(tabId, url) {
  const isFanfou = isFanfouTabUrl(url)

  try {
    await chrome.action.setPopup({ tabId, popup: isFanfou ? SETTINGS_POPUP_URL : '' })

    if (isFanfou) {
      await chrome.action.setTitle({ tabId, title: POPUP_TITLE })
    }
  } catch (error) {
    // 标签页可能已关闭
  }
}

async function syncActionForAllFanfouTabs() {
  const tabs = await chrome.tabs.query({
    url: FANFOU_TAB_URL_PATTERNS,
  })

  await Promise.all(tabs.map(tab => syncActionForTab(tab.id, tab.url)))
}

function registerPopupSync() {
  // 页面导航会清掉 per-tab popup，靠 onUpdated 重新同步
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.status === 'loading') {
      syncActionForTab(tabId, tab.url)
    }
  })

  // Service Worker 每次启动时为已打开的饭否标签页补挂 popup
  syncActionForAllFanfouTabs().catch(error => {
    console.error('[SpaceFanfou] Failed to sync action popup:', error)
  })
}

async function focusTab(tab) {
  if (!tab || !tab.id) return false

  if (tab.windowId) {
    await chrome.windows.update(tab.windowId, { focused: true })
  }

  await chrome.tabs.update(tab.id, { active: true })
  return true
}

async function openOrFocusFanfouHome() {
  const tabs = await chrome.tabs.query({
    url: FANFOU_TAB_URL_PATTERNS,
  })
  const activeTab = tabs.find(tab => tab.active)
  const targetTab = activeTab || tabs[0]

  if (await focusTab(targetTab)) return

  await chrome.tabs.create({
    url: FANFOU_HOME_URL,
    active: true,
  })
}

function registerActionClickHandler() {
  if (actionClickHandlerInstalled) return

  chrome.action.onClicked.addListener(() => {
    openOrFocusFanfouHome().catch(error => {
      console.error('[SpaceFanfou] Failed to open fanfou home:', error)
    })
  })

  actionClickHandlerInstalled = true
}

export default {
  install() {
    registerActionClickHandler()
    registerPopupSync()
  },
}
