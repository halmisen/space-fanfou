import { h } from 'dom-chef'
import select from 'select-dom'
import {
  SUMMARY_STORAGE_KEY,
  SUMMARY_STORAGE_AREA,
  formatSummaryText,
} from './archiveSummary'
import { isHomePage } from '@libs/pageDetect'
import bridge from '@page/environment/bridge'
import { PERSONAL_ARCHIVE_READ_YEAR, STORAGE_CHANGED } from '@constants'

// 饭否侧栏那块 <div class="sect"><h2>邀请朋友加入</h2>…</div> 没有 id，
// 只能按标题文字认。文字对不上时不动它——宁可入口出现在侧栏末尾，也不要误伤别的面板。
const INVITE_PANEL_HEADING = '邀请朋友加入'
const CLASSNAME_HIDDEN = 'sf-personal-archive-replaced'
const SETTINGS_PATH = 'settings.html#personal-archive'
// 备份进行中时，设置页每几秒写一次摘要，这边靠广播跟着更新。
// 但备份标签页被关掉就不会再有广播了，所以显示「进行中」期间要自己定期重算，
// 让这行字能自动退回「有未完成的同步」，而不是永远停在进行中。
const RUNNING_RECHECK_MS = 15000

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
  let stream = null
  let nostalgiaTimeline = null
  let yearsElement = null
  let nostalgiaNotice = null
  let latestSummary = null
  let recheckTimer = null

  elementCollection.add({
    sidebar: '#sidebar',
  })

  function onClickOpenSettings(event) {
    event.preventDefault()

    // 页面层拿不到 chrome.runtime，扩展页地址由 background 用 getURL 解析。
    proxiedCreateTab.create({ extensionPath: SETTINGS_PATH })
  }

  function restoreLiveTimeline(event) {
    if (event) event.preventDefault()
    if (stream) stream.style.display = ''
    if (nostalgiaTimeline) nostalgiaTimeline.remove()
    nostalgiaTimeline = null
  }

  function formatStatusDate(status) {
    const value = status?._archive?.createdAtISO || status?.created_at
    const date = new Date(value || '')
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  }

  function onClickNostalgiaPage(event) {
    event.preventDefault()
    const { year, page } = event.currentTarget.dataset
    openYear(year, Number(page))
  }

  function renderNostalgiaTimeline(view) {
    if (!stream) return
    restoreLiveTimeline()

    const statusNodes = view.statuses.map(status => (
      <li className="sf-nostalgia-timeline__status" key={status.id}>
        <p className="sf-nostalgia-timeline__meta">
          { status.user?.name || status.user?.screen_name || '饭否用户' } · { formatStatusDate(status) }
        </p>
        <p>{ status.text || '' }</p>
      </li>
    ))
    const keywordText = view.stats.keywords.length
      ? view.stats.keywords.map(item => `${item.word} ${item.count}`).join(' · ')
      : '这一年没有足够的文本生成关键词'
    const mentionedUserText = view.stats.mentionedUsers.length
      ? view.stats.mentionedUsers.map(item => `@${item.name} ${item.count}`).join(' · ')
      : '这一年没有可统计的提及'
    const deletedNotice = view.stats.excludedDeleted
      ? ` · 已略过 ${view.stats.excludedDeleted} 条原消息已删除的占位`
      : ''
    const pager = view.pagination.totalPages > 1 && (
      <p className="sf-nostalgia-timeline__pager">
        { view.pagination.page > 1 && (
          <a href="#" data-year={view.year} data-page={view.pagination.page - 1} onClick={onClickNostalgiaPage}>← 更新的消息</a>
        ) }
        <span>第 { view.pagination.page } / { view.pagination.totalPages } 页</span>
        { view.pagination.page < view.pagination.totalPages && (
          <a href="#" data-year={view.year} data-page={view.pagination.page + 1} onClick={onClickNostalgiaPage}>更早 →</a>
        ) }
      </p>
    )
    nostalgiaTimeline = (
      <section id="sf-nostalgia-timeline" className="sf-nostalgia-timeline">
        <header>
          <h1>{ view.year } 年的饭否</h1>
          <p>历史快照 · { view.stats.total } 条消息 · 最常发言时段 { view.stats.peakHour == null ? '—' : `${view.stats.peakHour}:00` }{ deletedNotice }</p>
          <p className="sf-nostalgia-timeline__keywords">年度十大关键词：{ keywordText }</p>
          <p className="sf-nostalgia-timeline__keywords">年度最常提到的饭友：{ mentionedUserText }</p>
          <p><a href="#" onClick={restoreLiveTimeline}>← 回到现在</a></p>
        </header>
        <ol>{ statusNodes }</ol>
        { pager }
      </section>
    )
    stream.style.display = 'none'
    stream.before(nostalgiaTimeline)
  }

  async function openYear(year, page = 1) {
    if (!year || !nostalgiaNotice) return
    nostalgiaNotice.textContent = `正在打开 ${year} 年${page > 1 ? `（第 ${page} 页）` : ''}…`
    try {
      const result = await bridge.postMessage({
        action: PERSONAL_ARCHIVE_READ_YEAR,
        payload: { year, page },
      })

      if (result?.__isError || result?.error) {
        nostalgiaNotice.textContent = result?.error || result?.message || '历史归档暂时无法打开'
        return
      }

      if (!result?.view) {
        nostalgiaNotice.textContent = '历史归档暂时无法打开'
        return
      }

      renderNostalgiaTimeline(result.view)
      nostalgiaNotice.textContent = ''
    } catch (error) {
      nostalgiaNotice.textContent = error?.message || '历史归档暂时无法打开'
    }
  }

  function onClickYear(event) {
    event.preventDefault()
    openYear(event.currentTarget.dataset.year)
  }

  function renderYears() {
    if (!yearsElement) return
    yearsElement.replaceChildren()
    const years = latestSummary?.years || []
    if (!years.length) {
      yearsElement.append(<li>完成一次消息备份后，这里会出现年份。</li>)
      return
    }
    for (const year of years) {
      yearsElement.append(<li><a href="#" data-year={year} onClick={onClickYear}>{ year } 年</a></li>)
    }
  }

  function renderSummary() {
    if (!summaryElement) return

    summaryElement.textContent = formatSummaryText(latestSummary)
    linkElement.textContent = latestSummary ? '打开备份设置' : '设置备份文件夹'

    clearTimeout(recheckTimer)
    if (latestSummary?.isRunning) {
      recheckTimer = setTimeout(renderSummary, RUNNING_RECHECK_MS)
    }
  }

  function applySummary(summary) {
    latestSummary = summary
    renderSummary()
    renderYears()
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
    yearsElement = <ul className="sf-personal-archive-entry__years" />
    nostalgiaNotice = <p className="sf-personal-archive-entry__notice" />

    return (
      <div id="sf-personal-archive-entry" className="sect">
        <h2>本地备份</h2>
        { summaryElement }
        <p>{ linkElement }</p>
        <p className="formtip">消息与图片只写进你自己选的本地文件夹，不上传任何服务器。</p>
        <h2>穿越时间</h2>
        <p className="formtip">首页默认仍是现在；选择一年后才切到本地历史快照。</p>
        { yearsElement }
        { nostalgiaNotice }
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
      stream = select('#stream')
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
      clearTimeout(recheckTimer)
      recheckTimer = null
      latestSummary = null
      restoreLiveTimeline()
      stream = null

      if (hiddenPanel) {
        hiddenPanel.classList.remove(CLASSNAME_HIDDEN)
        hiddenPanel = null
      }

      if (panel) {
        panel.remove()
        panel = summaryElement = linkElement = yearsElement = nostalgiaNotice = null
      }
    },
  }
}
