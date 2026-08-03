# Space Fanfou Status

Updated: 2026-08-03T09:35:00+08:00
Executor: claude
Status: active cockpit

## Source Order

1. `CLAUDE.md`
2. Live git state and files on disk
3. `AGENTS.md`
4. `tasks/STATUS.md`
5. `tasks/todo.md`
6. `tasks/logic.md`
7. `tasks/problems.md`
8. `tasks/journal.md`
9. `docs/project-status.md`

`docs/project-status.md` is a dated snapshot and may lag behind current branch state.

## Current Branch

- Active branch: `2026.8`
- Tracking: `origin/2026.8`
- `origin/simplify` is intentionally kept as a separate worktree/rewrite branch and should not be touched unless the user asks.

## Current Feature State

- Extension icon action (2026-07-13): dynamic per-tab behavior — on fanfou.com tabs the icon opens the settings popup (`settings.html`); on other tabs it opens or focuses `https://fanfou.com/home`. Popup click itself still needs the user's manual confirmation once.
- Mute fanfouers (`mute-fanfouers`, 2026-07-12): timeline mute with conversation matching, sidebar 「无爱饭友」 management panel (below 我关注的人), profile-page 静音此人 link placed inline with the native ops link row (2026-07-13). Fully verified logged-in.
- Unify sidebar panels (`unify-sidebar-panels`, 2026-07-13): optional (default off) grid/list layout unification for 有爱饭友 / 我关注的人 / 无爱饭友. CSS-only via body classes. Verified logged-in, both modes (pic/13~16).
- Fanfou font preset feature: implemented as a user-selectable setting.
- Avatar match3 local records: implemented with `chrome.storage.local`; records are backend-free.

Last full verification (2026-07-13): `npm test` (14 suites / 34 tests) passed, `npm run build` passed (page.js 842 KiB, limit 848), agent-browser logged-in acceptance with screenshots.

## Current Work

- 个人归档 P0（自有消息全量同步、按月分片、`meta.json` 水位、断点续传）与 P1 第一刀
  （图片下载 + 离线 HTML）代码均已完成，`npm test` 24 suites / 85 tests 通过，生产构建通过。
- File System Access 地基已完整验收：真实目录选择、刷新后句柄恢复、Chrome 整体重启后句柄仍在、
  `prompt → granted` 授权、重启后再次写入，五项都有 Windows 磁盘文件为证。
- API 探针已完成并回填 spec：`user_timeline` 390 页/23281 条，favorites 43 页/2471 条，
  mentions 242 页/14085 条，均到空页且无重复。P0 使用已验证的排除式 `max_id`；
  收藏资料计数比 API 可枚举数多 29，留作 P1 口径限制。
- 用户已在真实 Windows Chrome 上用小号（1483 条）跑通「下载图片 → 生成离线页面」，
  图片显示、按年分卷与跨年搜索均可用。剩下的是大号全量同步对账与断网核对。
- 2026-08-03：归档页视觉基准从「设置页 token」改为 `design-sync/bundle/pages/design-spec.html`
  的《太空饭否当前设计规格》；新增饭否首页侧栏「本地备份」入口，替换失效的「邀请朋友加入」。
  完整备份流程仍留在设置页——目录句柄按 origin 存放、多页站点导航会中断长同步、
  `http://fanfou.com` 不是安全上下文，三条约束写在 `tasks/todo.md` 的 2026-08-03 小节。

## Pending

- `docs/spec-undo-status.md`: 30s undo for just-posted statuses (~0.5 day). 不依赖 OAuth（走网页会话），
  是唯一不受 personal-archive 地基实测结果影响的待办。
- `docs/spec-annual-report.md`: 其「存储瘦身（不持久化原文）」一节已被 `spec-personal-archive.md` 取代；
  其余部分（API 分页、关键词算法、收藏口径、报告页版式）继续有效。
- 大号（23281 条）的全量同步、中断续传与磁盘对账仍未做——这是个人归档唯一的 open 项。
- 断网双击 `index.html` 的零请求核对未做。
- 归档页新样式与首页入口未经真机核对（需重装扩展）。
- `2026.8` 上自 `8167ea9` 起的工作仍未提交；本轮改动在分支 `worktree-archive-home-entry` 上，
  用户的工作副本未被触碰。

## Test Automation Channel

- Credentials in repo-root `.env` (gitignored, chmod 600) — do not ask the user again.
- Flow: `agent-browser --extension <repo>/dist --session sf-test open https://fanfou.com/login` → `set viewport 1440 900` (narrow default viewport hides the sidebar) → fill from `.env` → one-click OAuth via settings page (开始授权 → 同意). Details in project memory `fanfou-test-account`.
- **能力边界（2026-07-31 实测）**：agent-browser 无法拦截系统原生文件选择对话框（CDP 的 `Page.fileChooserOpened` 只覆盖 `<input type=file>`），凡依赖 File System Access 目录选择的验证在本机跑不通；且每次 session 使用全新临时 `--user-data-dir`，不是持久 profile，「重启 Chrome 后权限是否保留」这类断言无法用它验证。这类项必须人工在真实桌面 Chrome 上做。

## Distribution Decision

The original Chrome Web Store listing was removed after its manifest was not updated in time. The repository maintainer who accepted the Manifest V3 pull request is not Fanfou official and does not control that listing.

Current practical distribution path: prepare both an independent Chrome Web Store route and a free route (unpacked full extension plus a narrowly scoped userscript), without maintaining two complete products.

Current Web Store blocker: the production build loads remote Google Analytics JavaScript, which is prohibited for Manifest V3 store submissions and must be removed or replaced before submission.

Risk: the current manifest has no fixed `key`, so loading a new folder can produce a different extension ID. Local `chrome.storage.local` records, including avatar match3 results, may not migrate automatically.

Decision guide: `docs/distribution-decision-guide.md`

## Harness Integration

- Global project index: `/home/fiver/projects/harness/projects.md`
- Local cockpit: `tasks/STATUS.md`
- Local task list: `tasks/todo.md`
- Local decisions: `tasks/logic.md`
- Local risks/problems: `tasks/problems.md`
- Local continuity log: `tasks/journal.md`
- Future handoffs root: `tasks/handoffs/`

This is a lightweight harness integration: enough for the next agent to find current state and continuation notes, without imposing a full reviewer workflow until the project needs it.

## Next Suggested Work

不要重做已关闭的 API/FSA 地基；`/tmp/space-fanfou-claude-handoff-2026-07-31.md` 已随机器清理消失，
其内容在 `tasks/todo.md` 的 2026-07-31 小节有备份。

1. 重新构建并重装扩展，核对饭否首页侧栏出现「本地备份」面板、点击能直达设置页个人归档标签。
2. 重新生成离线页面，核对样式与饭否本体一致（白底 775px 单列、`#336` 正文、`#933` 链接）。
3. 用大号在「个人归档」面板选目录，启动全量同步，至少提交 2 页后暂停并核对页级水位。
4. 点击「继续上次同步」跑完全量；核对去重数 23281、首尾 id、月份分片计数之和与 `meta.json`。
5. 断网双击 `index.html`，确认 Network 面板零请求。

## Task Record Files

- `tasks/README.md`: how to read and maintain task records.
- `tasks/todo.md`: plans, acceptance criteria, and review/results.
- `tasks/logic.md`: durable decisions and reasoning.
- `tasks/problems.md`: active risks and blockers.
- `tasks/lessons.md`: prevention rules learned from prior mistakes.
- `tasks/journal.md`: chronological continuity.
