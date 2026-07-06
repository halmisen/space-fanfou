import { h, Component } from 'preact'
import messaging from '../messaging'
import {
  FANFOU_OAUTH_API_REQUEST,
  FANFOU_OAUTH_GET_STATUS,
  PERSONAL_ARCHIVE_DOWNLOAD_IMAGES,
} from '@constants'
import {
  buildExportPayload,
  buildFavoritesMarkdown,
  computePastYearStats,
  computeTopInteractions,
  computeTopKeywords,
  createArchive,
  getPhotoUrlsFromStatuses,
  getStatusList,
  mergeStatuses,
} from '@features/personal-archive/archiveLogic'

const STORAGE_KEY = 'personal-archive/data'
const PAGE_SIZE = 60
const MAX_FULL_SYNC_PAGES = 500

function chromeGet(key) {
  return new Promise(resolve => {
    chrome.storage.local.get(key, values => resolve(values[key]))
  })
}

function chromeSet(key, value) {
  return new Promise(resolve => {
    chrome.storage.local.set({ [key]: value }, resolve)
  })
}

function chromeRemove(key) {
  return new Promise(resolve => {
    chrome.storage.local.remove(key, resolve)
  })
}

function downloadText(filename, text, type = 'text/plain') {
  const blob = new Blob([ text ], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  anchor.click()

  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.addEventListener('load', () => resolve(reader.result))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsText(file)
  })
}

function getAccountFromStatus(status) {
  return {
    id: status?.userId || '',
    screenName: status?.screenName || status?.userId || '',
  }
}

function isOlderThan(status, cutoffDate) {
  const createdAt = status?.created_at || status?.createdAtISO
  const date = createdAt ? new Date(createdAt) : null

  return date && !Number.isNaN(date.getTime()) && date < cutoffDate
}

export default class PersonalArchivePanel extends Component {
  state = {
    loading: true,
    working: false,
    message: '',
    error: '',
    oauthStatus: null,
    archive: null,
  }

  componentDidMount() {
    this.refresh()
  }

  async refresh() {
    this.setState({ loading: true, error: '' })

    try {
      const [ archive, oauthResponse ] = await Promise.all([
        chromeGet(STORAGE_KEY),
        messaging.postMessage({ action: FANFOU_OAUTH_GET_STATUS }),
      ])

      this.setState({
        loading: false,
        archive: archive || createArchive(),
        oauthStatus: oauthResponse?.status || null,
      })
    } catch (error) {
      this.setState({
        loading: false,
        error: error.message || String(error),
      })
    }
  }

  async apiRequest(url, query = {}) {
    const response = await messaging.postMessage({
      action: FANFOU_OAUTH_API_REQUEST,
      payload: {
        url,
        query,
        responseType: 'json',
      },
    })

    if (response?.error) throw new Error(response.error)

    return Array.isArray(response?.responseJSON) ? response.responseJSON : []
  }

  async fetchPagedStatuses({ url, sourceName, recentYearOnly = false }) {
    const cutoffDate = new Date()
    const allStatuses = []
    const maxPages = recentYearOnly ? 30 : MAX_FULL_SYNC_PAGES

    cutoffDate.setDate(cutoffDate.getDate() - 365)

    for (let page = 1; page <= maxPages; page++) {
      this.setState({ message: `同步 ${sourceName} 第 ${page} 页…` })

      const statuses = await this.apiRequest(url, {
        count: PAGE_SIZE,
        page,
        mode: 'lite',
      })

      if (!statuses.length) break

      allStatuses.push(...statuses)

      if (recentYearOnly && statuses.some(status => isOlderThan(status, cutoffDate))) {
        break
      }

      if (statuses.length < PAGE_SIZE) break
    }

    return recentYearOnly
      ? allStatuses.filter(status => !isOlderThan(status, cutoffDate))
      : allStatuses
  }

  runJob = async job => {
    this.setState({ working: true, error: '', message: '' })

    try {
      await job()
      this.setState({ working: false })
    } catch (error) {
      this.setState({
        working: false,
        error: error.message || String(error),
      })
    }
  }

  syncOwnTimeline = recentYearOnly => this.runJob(async () => {
    const { archive, oauthStatus } = this.state
    const account = getAccountFromStatus(oauthStatus)
    const statuses = await this.fetchPagedStatuses({
      url: 'https://api.fanfou.com/statuses/user_timeline.json',
      sourceName: recentYearOnly ? '最近一年饭否消息' : '全部饭否消息',
      recentYearOnly,
    })
    const result = mergeStatuses(archive, 'ownTimeline', statuses, account)

    await chromeSet(STORAGE_KEY, result.archive)

    this.setState({
      archive: result.archive,
      message: `已同步 ${result.importedCount} 条新消息，本地共 ${result.totalCount} 条。`,
    })
  })

  syncFavorites = () => this.runJob(async () => {
    const { archive, oauthStatus } = this.state
    const account = getAccountFromStatus(oauthStatus)
    const userId = account.id || account.screenName

    if (!userId) throw new Error('无法确定当前账号，请先完成 OAuth 授权。')

    const statuses = await this.fetchPagedStatuses({
      url: `https://api.fanfou.com/favorites/${encodeURIComponent(userId)}.json`,
      sourceName: '收藏',
    })
    const result = mergeStatuses(archive, 'favorites', statuses, account)

    await chromeSet(STORAGE_KEY, result.archive)

    this.setState({
      archive: result.archive,
      message: `已同步 ${result.importedCount} 条新收藏，本地共 ${result.totalCount} 条。`,
    })
  })

  syncInteractions = () => this.runJob(async () => {
    const { archive, oauthStatus } = this.state
    const account = getAccountFromStatus(oauthStatus)
    const mentions = await this.fetchPagedStatuses({
      url: 'https://api.fanfou.com/statuses/mentions.json',
      sourceName: '提到我的消息',
      recentYearOnly: true,
    })
    const replies = await this.fetchPagedStatuses({
      url: 'https://api.fanfou.com/statuses/replies.json',
      sourceName: '回复我的消息',
      recentYearOnly: true,
    })
    const withMentions = mergeStatuses(archive, 'mentions', mentions, account)
    const withReplies = mergeStatuses(withMentions.archive, 'replies', replies, account)

    await chromeSet(STORAGE_KEY, withReplies.archive)

    this.setState({
      archive: withReplies.archive,
      message: `已同步 ${mentions.length} 条提到我的消息、${replies.length} 条回复。`,
    })
  })

  exportArchive = () => {
    const payload = buildExportPayload(this.state.archive)
    const filename = `space-fanfou-archive-${new Date().toISOString().slice(0, 10)}.json`

    downloadText(filename, JSON.stringify(payload, null, 2), 'application/json')
  }

  exportFavoritesMarkdown = () => {
    const markdown = buildFavoritesMarkdown(this.state.archive)
    const filename = `space-fanfou-favorites-${new Date().toISOString().slice(0, 10)}.md`

    downloadText(filename, markdown, 'text/markdown')
  }

  downloadFavoriteImages = () => this.runJob(async () => {
    const favorites = getStatusList(this.state.archive, 'favorites')
    const items = getPhotoUrlsFromStatuses(favorites)

    if (!items.length) {
      this.setState({ message: '收藏归档里暂时没有可下载的图片。' })
      return
    }

    const response = await messaging.postMessage({
      action: PERSONAL_ARCHIVE_DOWNLOAD_IMAGES,
      payload: {
        items,
        folder: `space-fanfou-favorites-${new Date().toISOString().slice(0, 10)}`,
      },
    })
    const failed = (response?.results || []).filter(item => item.error).length

    this.setState({
      message: `已提交 ${items.length} 张收藏图片下载${failed ? `，其中 ${failed} 张失败` : ''}。`,
    })
  })

  importArchive = async event => {
    const file = event.target.files?.[0]

    if (!file) return

    await this.runJob(async () => {
      const text = await readFile(file)
      const payload = JSON.parse(text)
      const archive = payload.archive || payload

      if (!archive?.schemaVersion) throw new Error('导入文件不是有效的太空饭否归档。')

      await chromeSet(STORAGE_KEY, archive)

      this.setState({
        archive,
        message: '归档已导入。',
      })
    })

    event.target.value = ''
  }

  clearArchive = () => this.runJob(async () => {
    await chromeRemove(STORAGE_KEY)

    this.setState({
      archive: createArchive(),
      message: '本地归档已删除。',
    })
  })

  render() {
    const { archive, error, loading, message, oauthStatus, working } = this.state
    const canWork = !!oauthStatus?.hasTokens && !working
    const stats = computePastYearStats(archive)
    const keywords = computeTopKeywords(archive)
    const interactions = computeTopInteractions(archive)

    return (
      <div className="sf-personal-archive-panel">
        <h4>个人归档</h4>
        { loading && <p>正在读取本地归档…</p> }
        { !loading && this.renderSummary(archive, oauthStatus) }
        <div className="sf-personal-archive-panel__actions">
          <button type="button" disabled={!canWork} onClick={() => this.syncOwnTimeline(true)}>同步最近一年</button>
          <button type="button" disabled={!canWork} onClick={() => this.syncOwnTimeline(false)}>同步全部消息</button>
          <button type="button" disabled={!canWork} onClick={this.syncFavorites}>同步收藏</button>
          <button type="button" disabled={!canWork} onClick={this.syncInteractions}>同步互动线索</button>
          <button type="button" disabled={working} onClick={this.exportArchive}>导出归档 JSON</button>
          <label className="sf-personal-archive-panel__import">
            导入归档 JSON
            <input type="file" accept="application/json,.json" disabled={working} onChange={this.importArchive} />
          </label>
          <button type="button" disabled={working} onClick={this.exportFavoritesMarkdown}>导出收藏 Markdown</button>
          <button type="button" disabled={!canWork} onClick={this.downloadFavoriteImages}>下载收藏图片</button>
          <button type="button" disabled={working} onClick={this.clearArchive}>删除本地归档</button>
        </div>
        { message && <p className="sf-personal-archive-panel__message">{ message }</p> }
        { error && <p className="sf-personal-archive-panel__error">{ error }</p> }
        { this.renderStats(stats) }
        { this.renderKeywords(keywords) }
        { this.renderInteractions(interactions) }
      </div>
    )
  }

  renderSummary(archive, oauthStatus) {
    const counts = {
      statuses: getStatusList(archive).length,
      favorites: getStatusList(archive, 'favorites').length,
      mentions: getStatusList(archive, 'mentions').length,
      replies: getStatusList(archive, 'replies').length,
    }

    return (
      <ul className="sf-personal-archive-panel__summary">
        <li>OAuth：{ oauthStatus?.hasTokens ? `已授权 ${oauthStatus.screenName || oauthStatus.userId}` : '未授权' }</li>
        <li>消息：{ counts.statuses } 条；收藏：{ counts.favorites } 条；提及：{ counts.mentions } 条；回复：{ counts.replies } 条</li>
      </ul>
    )
  }

  renderStats(stats) {
    return (
      <div className="sf-personal-archive-panel__block">
        <h5>最近一年</h5>
        <p>
          共 { stats.total } 条；纯文字 { stats.textOnly } 条；图片 { stats.photo } 条；
          回复 { stats.replies } 条；转发 { stats.reposts } 条。
        </p>
        <ol className="sf-personal-archive-panel__compact-list">
          { Object.entries(stats.monthlyCounts).sort().map(([ month, count ]) => (
            <li key={month}>{ month }：{ count } 条</li>
          )) }
        </ol>
      </div>
    )
  }

  renderKeywords(result) {
    return (
      <div className="sf-personal-archive-panel__block">
        <h5>关键词</h5>
        <ol className="sf-personal-archive-panel__compact-list">
          { result.keywords.map(item => (
            <li key={item.keyword}>{ item.keyword }：{ item.count }</li>
          )) }
        </ol>
      </div>
    )
  }

  renderInteractions(interactions) {
    return (
      <div className="sf-personal-archive-panel__block">
        <h5>互动估算 Top 10</h5>
        <ol className="sf-personal-archive-panel__interaction-list">
          { interactions.map(item => (
            <li key={item.user.id}>
              <strong>@{ item.user.screen_name || item.user.id }</strong>
              <span>分数 { item.score }</span>
              <small>
                回复我 { item.signals.repliesToMe }，
                提到我 { item.signals.mentionsMe }，
                我回复 { item.signals.repliesByMe }，
                我转发 { item.signals.repostsByMe }，
                我收藏 { item.signals.favoritesByMe }
              </small>
            </li>
          )) }
        </ol>
      </div>
    )
  }
}
