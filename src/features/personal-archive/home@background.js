import createNostalgiaCache from './nostalgiaCache'
import { buildYearView } from './nostalgiaView'
import messaging from '@background/environment/messaging'
import { PERSONAL_ARCHIVE_READ_YEAR } from '@constants'

const cache = createNostalgiaCache(indexedDB)

export default {
  onLoad() {
    messaging.registerHandler(PERSONAL_ARCHIVE_READ_YEAR, async ({ year }) => {
      if (!/^\d{4}$/.test(String(year))) return { error: '年份无效' }

      const statuses = await cache.readYear(String(year))
      if (!statuses.length) {
        return { error: '这个年份尚未建立首页怀旧索引，请在「本地备份」设置页点击「建立首页怀旧索引」。' }
      }

      return { view: buildYearView(year, statuses) }
    })
  },

  onUnload() {
    messaging.unregisterHandler(PERSONAL_ARCHIVE_READ_YEAR)
  },
}
