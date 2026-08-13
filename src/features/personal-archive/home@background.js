import createNostalgiaCache from './nostalgiaCache'
import { buildYearView } from './nostalgiaView'
import messaging from '@background/environment/messaging'
import { PERSONAL_ARCHIVE_READ_YEAR } from '@constants/action-types'

// 所有 feature script 都由 Subfeature 以 script(context) 调用；
// 后台没有页面上下文，但仍必须导出工厂函数，否则整个子特性不会被创建。
export default () => ({
  onLoad() {
    const cache = createNostalgiaCache(indexedDB)
    messaging.registerHandler(PERSONAL_ARCHIVE_READ_YEAR, async ({ year, page }) => {
      if (!/^\d{4}$/.test(String(year))) return { error: '年份无效' }
      if (page != null && (!Number.isInteger(page) || page < 1)) return { error: '页码无效' }

      const statuses = await cache.readYear(String(year))
      if (!statuses.length) {
        return { error: '这个年份尚未建立首页怀旧索引，请在「本地备份」设置页点击「建立首页怀旧索引」。' }
      }

      return { view: buildYearView(year, statuses, { page }) }
    })
  },

  onUnload() {
    messaging.unregisterHandler(PERSONAL_ARCHIVE_READ_YEAR)
  },
})
