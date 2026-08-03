import { toSummary, formatSummaryText } from './archiveSummary'

const META = {
  counts: { statuses: 23281 },
  lastSyncedAt: '2026-07-31T07:40:00.000Z',
  watermark: { statuses: { reachedFirstEver: true, oldestId: 'abc' } },
}

describe('toSummary', () => {
  test('没有 meta 时返回 null，首页据此显示「还没有备份过」', () => {
    expect(toSummary(null)).toBeNull()
    expect(toSummary(undefined)).toBeNull()
  })

  test('只提取首页要用的字段', () => {
    expect(toSummary(META, { directoryName: '饭否备份' })).toEqual({
      statuses: 23281,
      lastSyncedAt: '2026-07-31T07:40:00.000Z',
      reachedFirstEver: true,
      hasUnfinishedRun: false,
      directoryName: '饭否备份',
      hasOfflinePages: false,
    })
  })

  test('不泄漏 meta 里的其它字段（备份目录路径、账号信息等不进侧栏）', () => {
    const summary = toSummary({
      ...META,
      account: { id: 'someone', name: '某人' },
      directoryPath: '/home/someone/Documents',
    })

    expect(Object.keys(summary).sort()).toEqual([
      'directoryName',
      'hasOfflinePages',
      'hasUnfinishedRun',
      'lastSyncedAt',
      'reachedFirstEver',
      'statuses',
    ])
  })

  test('存在未完成的同步时置位 hasUnfinishedRun', () => {
    const summary = toSummary({ ...META, activeRun: { nextMaxId: 'x' } })

    expect(summary.hasUnfinishedRun).toBe(true)
  })

  test('计数缺失时归零而不是 undefined', () => {
    expect(toSummary({}).statuses).toBe(0)
  })
})

describe('formatSummaryText', () => {
  test('没有摘要时提示还没备份过', () => {
    expect(formatSummaryText(null)).toBe('还没有备份过')
  })

  test('未完成的同步优先于日期显示', () => {
    const text = formatSummaryText(toSummary({ ...META, activeRun: {} }))

    expect(text).toBe('已备份 23281 条，还有未完成的同步')
  })

  test('正常情况显示条数与日期', () => {
    const text = formatSummaryText({
      statuses: 1483,
      lastSyncedAt: '2026-07-31T07:40:00.000Z',
      hasUnfinishedRun: false,
    })

    expect(text).toMatch(/^已备份 1483 条 · 2026-07-3[01]$/)
  })

  test('时间戳不可解析时退回只显示条数', () => {
    expect(formatSummaryText({ statuses: 10, lastSyncedAt: '不是时间' }))
      .toBe('已备份 10 条')
    expect(formatSummaryText({ statuses: 10, lastSyncedAt: null }))
      .toBe('已备份 10 条')
  })
})
