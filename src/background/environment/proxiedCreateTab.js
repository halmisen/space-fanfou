// 把原本在 page script 的 window.open() 放到 background script
// 避免被 Chrome 当成恶意弹窗屏蔽掉

import messaging from './messaging'
import { PROXIED_CREATE_TAB } from '@constants'

function registerHandler() {
  messaging.registerHandler(PROXIED_CREATE_TAB, payload => {
    const { url, extensionPath, openInBackgroundTab = false } = payload

    chrome.tabs.create({
      // 页面层没有 chrome.runtime，扩展页地址只能在这里解析成完整 URL
      url: extensionPath ? chrome.runtime.getURL(extensionPath) : url,
      active: !openInBackgroundTab,
    })
  })
}

export default {
  install() {
    registerHandler()
  },
}
