import { useState, useEffect, useCallback } from 'react'
import { init } from './lib/messaging'
import { readAllSettings, writeAllSettings, getOptionDefs } from './lib/settings'

/* ── Tab 定义（与旧版 getTabDefs.js 对应一致） ── */
const TAB_LAYOUT = [
  {
    title: '页面功能',
    sections: [
      { title: 'Timeline 时间线', options: ['show-contextual-statuses', 'enrich-statuses', 'auto-pager', 'process-unread-statuses'] },
      { title: '输入框', options: ['floating-status-form'] },
      { title: '侧栏', options: ['favorite-fanfouers', 'check-saved-searches'] },
      { title: '批量管理', options: ['batch-remove-statuses', 'batch-remove-private-messages', 'batch-manage-relationships'] },
      { title: '其他', options: ['check-friendship'] },
    ],
  },
  {
    title: '页面外观',
    sections: [
      { title: '功能', options: ['remove-personalized-theme', 'remove-app-recommendations'] },
      { title: '细节', options: ['translucent-sidebar', 'box-shadows', 'remove-logo-beta', 'avatar-wallpaper'] },
    ],
  },
  {
    title: '工具',
    sections: [
      { title: '桌面通知', options: ['notifications'] },
      { title: '右键菜单', options: ['share-to-fanfou'] },
      { title: 'API 接入', options: ['fanfou-oauth'] },
    ],
  },
  { title: '帮助与支持', sections: [] },
  { title: '更新历史', sections: [] },
]

const LAST_TAB_KEY = 'settings/lastTabId'

/* ━━━━━━━━━━━━━━━━━━━━ Component ━━━━━━━━━━━━━━━━━━━━ */

export default function App() {
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState(0)
  const [values, setValues] = useState<Record<string, any>>({})
  const [defs, setDefs] = useState<Record<string, any>>({})

  /* ── init ── */
  useEffect(() => {
    init()
    ;(async () => {
      const hash = window.location.hash
      const savedTab = hash === '#version-history'
        ? 4
        : Number(localStorage.getItem(LAST_TAB_KEY) || '0')

      const [optVals, optDefs] = await Promise.all([readAllSettings(), getOptionDefs()])
      setValues(optVals)
      setDefs(optDefs)
      setTab(savedTab)
      setReady(true)
    })()
  }, [])

  /* ── persist last tab ── */
  useEffect(() => {
    if (ready) localStorage.setItem(LAST_TAB_KEY, String(tab))
  }, [tab, ready])

  /* ── save ── */
  const save = useCallback(async (next: Record<string, any>) => {
    setValues(next)
    await writeAllSettings(next)
  }, [])

  const toggle = useCallback((key: string, checked: boolean) => {
    save({ ...values, [key]: checked })
  }, [values, save])

  const changeValue = useCallback((key: string, val: any) => {
    save({ ...values, [key]: val })
  }, [values, save])

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-pulse text-gray-400 text-lg">加载中…</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50 text-gray-700 font-sans antialiased">
      {/* ── 左侧导航 ── */}
      <nav className="w-48 shrink-0 border-r border-gray-200 bg-white/80 backdrop-blur-lg flex flex-col pt-6">
        <h1 className="px-6 mb-6 text-xl font-semibold tracking-tight text-gray-900">太空饭否</h1>
        <ul className="space-y-0.5 px-2">
          {TAB_LAYOUT.map((t, i) => (
            <li key={i}>
              <button
                onClick={() => setTab(i)}
                className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-all duration-150
                  ${tab === i
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
              >
                {t.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── 右侧内容 ── */}
      <main className="flex-1 overflow-y-auto px-10 py-8">
        {TAB_LAYOUT.map((tabDef, tabIdx) => (
          tabIdx === tab && (
            <div key={tabIdx}>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">{tabDef.title}</h2>

              {tabDef.sections.length === 0 && (
                <p className="text-gray-400 text-sm">该分区暂未迁移至新版界面。</p>
              )}

              {tabDef.sections.map((sec, si) => (
                <section key={si} className="mb-8">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{sec.title}</h3>
                  <div className="space-y-2">
                    {sec.options.map(optKey => {
                      const def = defs[optKey]
                      if (!def) return null

                      const isSubOption = def.isSubOption
                      const parentHidden = isSubOption && !values[def.parentKey]

                      if (parentHidden) return null

                      return (
                        <div key={def.key} className={`flex items-start gap-3 p-3 rounded-xl transition-colors hover:bg-white ${isSubOption ? 'ml-8' : ''}`}>
                          {def.type === 'checkbox' && (
                            <>
                              <input
                                id={def.key}
                                type="checkbox"
                                checked={!!values[def.key]}
                                disabled={def.isSoldered}
                                onChange={e => toggle(def.key, e.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer disabled:opacity-50"
                              />
                              <label htmlFor={def.key} className={`text-sm leading-snug cursor-pointer select-none ${def.isSoldered ? 'text-gray-400' : 'text-gray-700'}`}>
                                {def.label}
                                {def.comment && <span className="block text-xs text-gray-400 mt-1">{def.comment}</span>}
                              </label>
                            </>
                          )}

                          {def.type === 'number' && (
                            <label className="text-sm text-gray-700 flex items-center gap-2">
                              {def.label?.split?.('{}')[0]}
                              <input
                                type="number"
                                value={values[def.key] ?? ''}
                                onChange={e => changeValue(def.key, e.target.valueAsNumber)}
                                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                                {...(def.controlOptions || {})}
                              />
                              {def.label?.split?.('{}')[1]}
                            </label>
                          )}

                          {def.type === 'text' && (
                            <label className="text-sm text-gray-700 w-full">
                              <span className="block mb-1">{def.label}</span>
                              <input
                                type="text"
                                value={values[def.key] ?? ''}
                                onChange={e => changeValue(def.key, e.target.value)}
                                className="w-full max-w-md px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                              />
                            </label>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )
        ))}
      </main>
    </div>
  )
}
