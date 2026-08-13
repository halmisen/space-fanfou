import createHomeBackground from './home@background'
import createNostalgiaCache from './nostalgiaCache'
import { buildYearView } from './nostalgiaView'
import messaging from '@background/environment/messaging'
import { PERSONAL_ARCHIVE_READ_YEAR } from '@constants/action-types'

jest.mock('./nostalgiaCache')
jest.mock('./nostalgiaView')
jest.mock('@background/environment/messaging', () => ({
  __esModule: true,
  default: {
    registerHandler: jest.fn(),
    unregisterHandler: jest.fn(),
  },
}))

describe('首页怀旧后台处理器', () => {
  beforeEach(() => {
    global.indexedDB = {}
    jest.clearAllMocks()
  })

  test('以 feature 工厂形式注册按年读取处理器', async () => {
    const statuses = [ { id: '1' } ]
    const cache = { readYear: jest.fn().mockResolvedValue(statuses) }
    createNostalgiaCache.mockReturnValue(cache)
    buildYearView.mockReturnValue({ year: '2026', statuses })

    const feature = createHomeBackground()
    feature.onLoad()

    expect(messaging.registerHandler).toHaveBeenCalledWith(
      PERSONAL_ARCHIVE_READ_YEAR,
      expect.any(Function),
    )
    const handler = messaging.registerHandler.mock.calls[0][1]
    await expect(handler({ year: '2026' })).resolves.toEqual({
      view: { year: '2026', statuses },
    })
    expect(cache.readYear).toHaveBeenCalledWith('2026')

    feature.onUnload()
    expect(messaging.unregisterHandler).toHaveBeenCalledWith(PERSONAL_ARCHIVE_READ_YEAR)
  })
})
