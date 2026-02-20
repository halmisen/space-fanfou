import simpleMemoize from 'just-once'
import { isUserProfilePage } from '@libs/pageDetect'

// 获取当前页面所有者的 ID（默认当前页面为用户页面）
export default simpleMemoize(async () => {
  const splitPathname = window.location.pathname.split('/')

  // decodeURIComponent：用户 ID 可能是中文（如 鱼小颜），URL 中以 %E9%B1%BC... 形式存储
  const raw = await isUserProfilePage()
    ? splitPathname[1] // fanfou.com/<userid>
    : splitPathname[2] // fanfou.com/album/<userid>

  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
})
