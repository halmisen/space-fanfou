/**
 * 判断设置页是不是以 browser action popup 打开的。
 *
 * 在饭否标签页上点扩展图标时，设置页是 popup（见
 * background/environment/actionLauncher.js 的 setPopup）。popup 一失焦就关闭，
 * 里面正在跑的个人归档同步会连同整个 JS 上下文一起消失，20 分钟级的全量备份必然跑不完。
 *
 * popup 里 chrome.tabs.getCurrent() 拿不到标签页，独立标签页里能拿到——
 * 这是区分两种上下文最直接、不依赖窗口尺寸猜测的信号。
 */
export default async function isPopupContext(tabs = chrome.tabs) {
  try {
    return !await tabs.getCurrent()
  } catch (error) {
    // 拿不准时按标签页处理：错判成 popup 会把功能整个挡住，代价更大。
    return false
  }
}
