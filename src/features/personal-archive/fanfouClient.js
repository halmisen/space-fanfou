import {
  FANFOU_OAUTH_API_REQUEST,
  FANFOU_OAUTH_GET_STATUS,
} from '@constants/action-types'

const API_HOST = 'https://api.fanfou.com'

function assertResponse(response) {
  if (response?.error) {
    // 带上 HTTP 状态码，同步循环据此判断这次失败值不值得重试。
    const error = new Error(response.error)
    error.status = response.status || null
    throw error
  }
  if (!response || !Object.prototype.hasOwnProperty.call(response, 'responseJSON')) {
    throw new Error('饭否 API 没有返回 JSON 数据')
  }
  return response.responseJSON
}

export default function createFanfouClient(messaging) {
  async function apiGet(path, query) {
    const response = await messaging.postMessage({
      action: FANFOU_OAUTH_API_REQUEST,
      payload: {
        url: `${API_HOST}${path}`,
        method: 'GET',
        query,
        responseType: 'json',
      },
    })

    return assertResponse(response)
  }

  return {
    /**
     * 只读 OAuth 授权状态，不打 API。
     * 备份的是「授权的那个账号」，不是网页当前登录的账号——多账号用户容易搞混，
     * 面板需要在同步之前就把这个账号显示出来。
     */
    async fetchAuthorizationStatus() {
      const response = await messaging.postMessage({
        action: FANFOU_OAUTH_GET_STATUS,
        payload: {},
      })

      return response?.status || null
    },

    async fetchCurrentAccount() {
      const response = await messaging.postMessage({
        action: FANFOU_OAUTH_GET_STATUS,
        payload: {},
      })
      const status = response?.status
      if (!status?.hasTokens) {
        throw new Error('请先在上方完成饭否 OAuth 授权')
      }

      return apiGet('/users/show.json', status.userId ? { id: status.userId } : {})
    },

    async fetchOwnTimeline(query) {
      const page = await apiGet('/statuses/user_timeline.json', query)
      if (!Array.isArray(page)) throw new TypeError('饭否时间线 API 返回格式不正确')
      return page
    },

    async fetchMentions(query) {
      const page = await apiGet('/statuses/mentions.json', query)
      if (!Array.isArray(page)) throw new TypeError('饭否提及 API 返回格式不正确')
      return page
    },
  }
}
