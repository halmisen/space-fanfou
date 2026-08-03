import { h } from 'dom-chef'
import select from 'select-dom'
import {
  SUMMARY_STORAGE_KEY,
  SUMMARY_STORAGE_AREA,
  formatSummaryText,
} from './archiveSummary'
import { isHomePage } from '@libs/pageDetect'
import { STORAGE_CHANGED } from '@constants'

// 饭否侧栏那块 <div class="sect"><h2>邀请朋友加入</h2>…</div> 没有 id，
// 只能按标题文字认。文字对不上时不动它——宁可入口出现在侧栏末尾，也不要误伤别的面板。
const INVITE_PANEL_HEADING = '邀请朋友加入'
const CLASSNAME_HIDDEN = 'sf-personal-archive-replaced'
const SETTINGS_PATH = 'settings.html#personal-archive'

// 这个面板只有一行文字会变，用 dom-chef 直接建真实 DOM；
// 引入 Preact 组件运行时会把 page.js 顶过 848 KiB 的构建门禁。
function findInvitePanel(sidebar) {
  return select.all('.sect', sidebar).find(sect => (
    select('h2', sect)?.textContent.trim() === INVITE_PANEL_HEADING
  ))
}

export default context => {
  const {
    requireModules,
    registerBroadcastListener,
    unregisterBroadcastListener,
    elementCollection,
  } = context
  const { storage, proxiedCreateTab } = requireModules([ 'storage', 'proxiedCreateTab' ])

  let panel = null
  let summaryElement = null
  let linkElement = null
  let hiddenPanel = null

  elementCollection.add({
    sidebar: '#sidebar',
  })

  function onClickOpenSettings(event) {
    event.preventDefault()

    // 页面层拿不到 chrome.runtime，扩展页地址由 background 用 getURL 解析。
    proxiedCreateTab.create({ extensionPath: SETTINGS_PATH })
  }

  function applySummary(summary) {
    if (!summaryElement) return

    summaryElement.textContent = formatSummaryText(summary)
    linkElement.textContent = summary ? '打开备份设置' : '设置备份文件夹'
  }

  // 设置页写完摘要后，已经打开的首页要跟着变，不必刷新页面。
  function onStorageChange(message) {
    if (
      message.action !== STORAGE_CHANGED ||
      message.payload?.key !== SUMMARY_STORAGE_KEY
    ) return

    applySummary(message.payload.newValue)
  }

  function createPanel() {
    summaryElement = <p className="sf-personal-archive-entry__summary">正在读取备份状态…</p>
    linkElement = <a href="#" onClick={onClickOpenSettings}>设置备份文件夹</a>

    return (
      <div id="sf-personal-archive-entry" className="sect">
        <h2>本地备份</h2>
        { summaryElement }
        <p>{ linkElement }</p>
        <p className="formtip">消息与图片只写进你自己选的本地文件夹，不上传任何服务器。</p>
      </div>
    )
  }

  return {
    applyWhen: () => isHomePage(),

    waitReady: () => elementCollection.ready('sidebar'),

    async onLoad() {
      const sidebar = elementCollection.get('sidebar')
      if (!sidebar) return

      panel = createPanel()
      const invitePanel = findInvitePanel(sidebar)

      if (invitePanel) {
        // 只隐藏不删除：关掉这个功能时要能把饭否原本的面板还回去。
        invitePanel.classList.add(CLASSNAME_HIDDEN)
        hiddenPanel = invitePanel
        invitePanel.after(panel)
      } else {
        sidebar.append(panel)
      }

      registerBroadcastListener(onStorageChange)
      applySummary(await storage.read(SUMMARY_STORAGE_KEY, SUMMARY_STORAGE_AREA))
    },

    onUnload() {
      unregisterBroadcastListener(onStorageChange)

      if (hiddenPanel) {
        hiddenPanel.classList.remove(CLASSNAME_HIDDEN)
        hiddenPanel = null
      }

      if (panel) {
        panel.remove()
        panel = summaryElement = linkElement = null
      }
    },
  }
}
