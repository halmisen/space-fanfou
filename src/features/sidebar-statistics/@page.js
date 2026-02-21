/* eslint-disable camelcase */
import { h, Component } from 'preact'
import select from 'select-dom'
import cx from 'classnames'
import clamp from 'just-clamp'
import Tooltip from '@libs/Tooltip'
import { isUserProfilePage, isLoggedInUserProfilePage } from '@libs/pageDetect'
import preactRender from '@libs/preactRender'
import formatDate from '@libs/formatDate'
import jsonp from '@libs/jsonp'

// 通过 JSONP 从 api.fanfou.com 获取用户 created_at（需要登录 cookie）
async function fetchCreatedAtViaJSONP(userId) {
  try {
    const data = await jsonp('//api.fanfou.com/users/show.json', {
      params: { id: userId },
      timeout: 10000,
    })
    return data && data.created_at ? data.created_at : null
  } catch {
    return null
  }
}

// 从 m.fanfou.com 抓取最早消息时间（仅对自己的页面有效，他人页面受移动站限制只显示近期内容）
async function fetchOldestStatusDate(userId, lastPage, proxiedFetch) {
  for (let page = lastPage; page >= Math.max(1, lastPage - 2); page--) {
    const url = `https://m.fanfou.com/${encodeURIComponent(userId)}/p.${page}`
    const { error, responseText: html } = await proxiedFetch.get({ url })
    if (error || !html) continue

    // m.fanfou.com 消息时间格式：YYYY-MM-DD HH:MM
    const dates = html.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/g)
    if (dates && dates.length > 0) {
      return dates[dates.length - 1]  // 页面最后一条 = 最早的
    }
  }
  return null
}

class SidebarStatistics extends Component {
  constructor(...args) {
    super(...args)

    this.state = {
      isProtected: false,
      registerDateText: '……',
      registerDurationText: '……',
      registerDurationProgress: 0,
      statusFrequencyText: '……',
      statusFrequencyProgress: 0,
      influenceIndexText: '……',
      influenceIndexProgress: 0,
      backgroundImageUrl: null,
    }
  }

  async componentWillMount() {
    try {
      const userProfile = await this.fetchUserProfileData()
      this.processData(userProfile)
    } catch (error) {
      this.setState({ registerDateText: '暂无数据' })
    }
  }

  getUserId() {
    // 优先从 meta[name=author] 提取（格式：名字(userId)）
    // 该 meta 标签只在页面所有者自己访问时存在，他人页面可能为 null
    const meta = select('meta[name=author]')
    if (meta) {
      const match = meta.content.match(/\(([^)]+)\)$/)
      if (match) return match[1]
    }

    // 回退：从 URL 路径提取（fanfou.com/<userId>），需 decode 中文 ID
    const raw = window.location.pathname.split('/').filter(Boolean)[0] || ''
    try { return decodeURIComponent(raw) } catch { return raw }
  }

  async fetchUserProfileData() {
    const userId = this.getUserId()
    const { proxiedFetch } = this.props
    const userProfile = {}

    // 1. 从页面 DOM 提取各项计数
    // 计数 widget 固定在 #user_stats 容器内，精确限定范围避免误匹配页面其他区域
    const userStats = select('#user_stats') || document
    const getCount = href => {
      const el = select(`a[href="${href}"] .count`, userStats)

      return el ? parseInt(el.textContent.replace(/\D/g, ''), 10) : 0
    }

    userProfile.statuses_count = getCount(`/${userId}`)
    userProfile.friends_count = getCount(`/friends/${userId}`)
    userProfile.followers_count = getCount(`/followers/${userId}`)

    // 2. 背景图：从 body 的计算样式提取 URL
    const bgImage = getComputedStyle(document.body).backgroundImage
    if (bgImage && bgImage !== 'none') {
      userProfile.profile_background_image_url = bgImage.replace(/^url\(["']?|["']?\)$/g, '')
    }

    // 3. 加锁状态：检查页面是否有私密账号标志
    userProfile.protected = select.exists('.locked, .private-icon, [class*="private"]')

    // 4. 注册时间：自己页面用 m.fanfou.com 抓最早消息；他人页面尝试 JSONP
    if (isLoggedInUserProfilePage() && userProfile.statuses_count > 0 && proxiedFetch) {
      const lastPage = Math.ceil(userProfile.statuses_count / 30)
      const oldestDate = await fetchOldestStatusDate(userId, lastPage, proxiedFetch)
      if (oldestDate) userProfile.created_at = oldestDate
    } else {
      const createdAt = await fetchCreatedAtViaJSONP(userId)
      if (createdAt) userProfile.created_at = createdAt
    }

    return userProfile
  }

  processData(userProfile) {
    // 是否加锁
    const isProtected = userProfile.protected

    // 注册时间不可获取（他人页面 m.fanfou.com 仅开放近期消息，无法确定注册时间）
    if (!userProfile.created_at) {
      const bgImage = userProfile.profile_background_image_url
      const isBackgroundImageDisabled = getComputedStyle(document.body).backgroundImage === 'none'

      this.setState({
        isProtected,
        registerDateText: '不可获取',
        registerDurationText: '—',
        statusFrequencyText: `共 ${userProfile.statuses_count || 0} 条消息`,
        statusFrequencyProgress: 0,
        influenceIndexText: '—',
        influenceIndexProgress: 0,
        backgroundImageUrl: isBackgroundImageDisabled ? null : bgImage,
      })
      return
    }

    // 注册时间（来自最早消息，为近似值）
    const registerDate = new Date(userProfile.created_at)
    const registerDateText = `约 ${formatDate(registerDate)}`

    // 注册时长
    const registerDays = Math.floor((new Date() - registerDate) /
                   (1000 * 3600 * 24))
    const registerYears = Math.floor(registerDays / 365.2425)
    const registerMonths = Math.floor(
      (registerDays - registerYears * 365.2425) / 30.4369)
    const registerDuration = (registerYears > 0 || registerMonths > 0 ? '约 ' : '') +
      (registerYears > 0 ? registerYears + ' 年' +
       (registerMonths > 0 ? '零 ' + registerMonths + ' 个月' : '') :
        registerMonths > 0 ? registerMonths + ' 个月' :
          registerDays >= 7 ? '不足一个月' :
            registerDays > 0 ? '不足一周' : '刚来不到一天')
    const registerDurationText = `${registerDuration}（${registerDays} 天）`

    const actualRegisterDays = registerDate < new Date(2009, 6, 8)
      ? registerDays - 505
      : registerDays
    const daysSinceFanfouStart = Math.round(
      (new Date() - new Date(2007, 4, 12)) /
         (1000 * 3600 * 24))
    const registerDurationProgress = registerDays / daysSinceFanfouStart

    // 消息频率
    const statusFrequency = actualRegisterDays < 1
      ? userProfile.statuses_count
      : (userProfile.statuses_count / actualRegisterDays).toFixed(2)
    const statusFrequencyText = `平均 ${statusFrequency} 条消息 / 天`
    const statusFrequencyProgress = statusFrequency / 50

    // 影响力
    // 算法参见：https://spacekid.me/spacefanfou/
    let actionIndex = ((40 * statusFrequency) - (statusFrequency ** 2)) / 400
    if (statusFrequency > 20) actionIndex = 1
    if (isProtected) actionIndex = actionIndex * 0.75
    const influenceIndex = (
      (10 * Math.sqrt(userProfile.followers_count) / Math.log(registerDays + 100)) +
       ((userProfile.followers_count / 100) + (registerDays / 100)) * actionIndex
    ).toFixed(0)
    const influenceIndexText = `${influenceIndex} 公里`
    const influenceIndexProgress = influenceIndex / 100

    // 背景图片
    const backgroundImageUrl = userProfile.profile_background_image_url
    // 需要检测用户是否在「设置 → 模板」中选择了「不要背景图片」
    const isBackgroundImageDisabled = getComputedStyle(document.body).backgroundImage === 'none'

    this.setState({
      isProtected,
      registerDateText,
      registerDurationText,
      registerDurationProgress,
      statusFrequencyText,
      statusFrequencyProgress,
      influenceIndexText,
      influenceIndexProgress,
      backgroundImageUrl: isBackgroundImageDisabled ? null : backgroundImageUrl,
    })
  }

  render() {
    const {
      isProtected,
      registerDateText,
      registerDurationText, registerDurationProgress,
      statusFrequencyText, statusFrequencyProgress,
      influenceIndexText, influenceIndexProgress,
      backgroundImageUrl,
    } = this.state

    return (
      <div class="stabs sf-sidebar-statistics">
        <h2>统计信息</h2>
        <ul>
          <StatisticItem extraClassNames={cx({ 'sf-is-protected': isProtected })} text={`注册于 ${registerDateText}`} />
          <StatisticItem text={`饭龄：${registerDurationText}`} tip="注册时长" enableProgressBar progress={registerDurationProgress} progressBarColor="red" />
          <StatisticItem text={`饭量：${statusFrequencyText}`} tip="消息频率" enableProgressBar progress={statusFrequencyProgress} progressBarColor="green" />
          <StatisticItem text={`饭香：${influenceIndexText}`} tip="影响力" enableProgressBar progress={influenceIndexProgress} progressBarColor="blue" />
          { backgroundImageUrl && <StatisticItem text="» 查看背景图片" url={backgroundImageUrl} /> }
        </ul>
      </div>
    )
  }
}

class StatisticItem extends Component {
  render() {
    const { text, url, extraClassNames } = this.props
    const classnames = cx('sf-sidebar-statistics-item', extraClassNames)

    return (
      <li className={classnames}>
        { url ? <a href={url}>{ text }</a> : text }
        { this.renderTip() }
        { this.renderProgressBar() }
      </li>
    )
  }

  renderTip() {
    const { tip } = this.props
    const tooltipProps = {
      className: 'sf-tip',
      content: tip,
      distance: 0,
    }

    return tip && (
      <Tooltip {...tooltipProps}>?</Tooltip>
    )
  }

  renderProgressBar() {
    const { enableProgressBar, progressBarColor, progress } = this.props

    if (enableProgressBar) return (
      <div className={`sf-sidebar-statistics-progressbar sf-${progressBarColor}`}>
        <span style={{ width: (clamp(0, progress, 1) * 100) + '%' }} />
      </div>
    )
  }
}

export default context => {
  const { elementCollection, requireModules } = context
  const { proxiedFetch } = requireModules([ 'proxiedFetch' ])

  let unmount

  elementCollection.add({
    stabs: '.stabs',
  })

  return {
    applyWhen: () => isUserProfilePage(),

    waitReady: () => elementCollection.ready('stabs'),

    onLoad() {
      unmount = preactRender(<SidebarStatistics proxiedFetch={proxiedFetch} />, rendered => {
        elementCollection.get('stabs').after(rendered)
      })
    },

    onUnload() {
      unmount()
    },
  }
}
