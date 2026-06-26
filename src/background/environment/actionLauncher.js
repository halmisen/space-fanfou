const FANFOU_HOME_URL = 'https://fanfou.com/home'
const FANFOU_TAB_URL_PATTERNS = [
  'https://fanfou.com/*',
  'http://fanfou.com/*',
]
let actionClickHandlerInstalled = false

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
  },
}
