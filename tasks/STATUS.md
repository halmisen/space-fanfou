# Space Fanfou Status

Updated: 2026-07-31T15:25:59+08:00
Executor: codex → claude handoff
Status: active cockpit, handoff ready

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

- `docs/spec-personal-archive.md`: 用户已确认以现有公开 nofan OAuth consumer key 为前提启动 P0。
  当前 active 范围仅含自有消息全量同步、按月分片、`meta.json` 水位和断点续传；收藏与离线浏览
  属 P1，mentions 与年度报告属 P2。
- File System Access 仍是 P0 主路径。真实 Windows Chrome 已完成首次目录选择、文件落盘，
  以及刷新后从 IndexedDB 取回真实目录句柄并再次落盘；两个探针文件均通过磁盘核对。
  Chrome 整体重启后句柄仍可取回，权限实测从 `prompt` 经真实点击变为 `granted`。
  重启后的第三个文件 round trip 也已通过磁盘核对，File System Access 地基验收完成。
- 临时 spike 已完成使命并从源码、静态资源、构建入口和 `dist` 清理；正式面板权限状态保留中文化。
- API 探针已在保留的 `sf-fsa` session 中严格串行完成并回填 spec：`user_timeline`
  390 页/23281 条，favorites 43 页/2471 条，mentions 242 页/14085 条，均到空页且无重复。
  P0 使用已验证的排除式 `max_id`；收藏资料计数比 API 可枚举数多 29，留作 P1 口径限制。

## Pending

- `docs/spec-undo-status.md`: 30s undo for just-posted statuses (~0.5 day). 不依赖 OAuth（走网页会话），
  是唯一不受 personal-archive 地基实测结果影响的待办。
- `docs/spec-annual-report.md`: 其「存储瘦身（不持久化原文）」一节已被 `spec-personal-archive.md` 取代；
  其余部分（API 分页、关键词算法、收藏口径、报告页版式）继续有效。
- All work since the last commit is uncommitted on `2026.8` (mute-fanfouers, unify-sidebar-panels, action popup, specs).
- **工作树当前不干净**：个人归档 P0 实现与既有功能/文档改动仍未提交，但已无 spike 临时文件。

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

1. 读取 `/tmp/space-fanfou-claude-handoff-2026-07-31.md`；不要重做已关闭的 API/FSA 地基。
2. 正式设置页已打开。让用户在「个人归档」面板再选一次目录，启动真实全量同步，至少提交 2 页后
   暂停并核对页级水位。
3. 点击「继续上次同步」跑完全量；核对去重数 23281、首尾 id、月份分片计数之和与 `meta.json`。

## Task Record Files

- `tasks/README.md`: how to read and maintain task records.
- `tasks/todo.md`: plans, acceptance criteria, and review/results.
- `tasks/logic.md`: durable decisions and reasoning.
- `tasks/problems.md`: active risks and blockers.
- `tasks/lessons.md`: prevention rules learned from prior mistakes.
- `tasks/journal.md`: chronological continuity.
