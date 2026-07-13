# Space Fanfou Journal

## 2026-06-08 Harness status and distribution/storage decision

Executor: codex
Timestamp: 2026-06-08T15:38:08+08:00

### Context

The user asked to record the current thinking and check whether this project is connected to `/home/fiver/projects/harness` status tracking.

### Findings

- `/home/fiver/projects/harness/projects.md` already listed `space-fanfou` with its path and domain.
- The local project did not yet have a harness-style cockpit file (`tasks/STATUS.md`) or continuity log (`tasks/journal.md`).
- `docs/project-status.md` exists, but it is a historical snapshot and should not be treated as current cockpit state.

### Records Added

- `docs/distribution-and-devmode-storage.md`: distribution and local-storage decision note.
- `docs/publish.md`: updated to point to the current distribution reality.
- `tasks/STATUS.md`: current local cockpit.
- `tasks/journal.md`: continuity log.
- `tasks/handoffs/.gitkeep`: reserved handoff root for future multi-role work.
- `/home/fiver/projects/harness/projects.md`: updated so the global index points to this project's local status records.

### Decision

Current release path is developer-mode folder distribution. Before wider user-facing updates, add export/import for safe local extension data because a new folder may create a new extension ID and lose `chrome.storage.local` records.

## 2026-06-08 Task record file set expanded

Executor: codex
Timestamp: 2026-06-08T15:47:47+08:00

### Context

The user confirmed that task-series files should be supplemented so TODO and status records are clear.

### Records Added

- `tasks/README.md`: read order and file responsibilities.
- `tasks/logic.md`: durable product/technical decisions.
- `tasks/problems.md`: active risks and mitigations.

### Status Update

`tasks/STATUS.md` now lists the full task-record file set, so future agents can start from the project-local status surface instead of relying on dated snapshots or chat history.

## 2026-07-13 三项体验改进 + 测试通道全自动化

Executor: claude
Timestamp: 2026-07-13T10:05:00+08:00

### Context

用户加载 2026.8 dist 手测 mute-fanfouers 后提出三点反馈；讨论定稿后一次交付。

### Changes

- 动态弹出菜单：`actionLauncher.js` 按标签页 setPopup——饭否标签页弹设置弹窗（恢复旧 default_popup 体验），其他标签页跳转饭否；onUpdated 重挂 + SW 启动全量扫描。
- 静音链接归位：个人页「静音此人」插入原生「他关注的消息 和他的对话 检查与他的关系」链接排末尾（文本正则定位，找不到回退 #info 底部）。
- 新功能 `unify-sidebar-panels`（默认关）：统一三个侧栏饭友面板为网格或列表；纯 CSS（body 类），设置页「侧栏」区注册。
- 修复过程教训（lessons.md #26）：原生 `.alist a` 是 float:left + 固定 48px 宽，语义猜测 DOM 导致列表模式首版失败，登录抓 computed style 后一轮修复。

### Infrastructure

- 测试凭据固化到 repo `.env`（gitignored，600），用户明确要求不再每次索要。
- OAuth 一键授权已验证可自动化：设置页「开始授权」→ 授权页「同意」，统计信息出真实数据（pic/17）。
- agent-browser 坑位记录：默认视口过窄会隐藏侧栏（需 set viewport 1440 900）；重建 dist 后需 close --all 再带 --extension 重启（残留守护进程会复用无扩展的浏览器）。

### Verification

npm test 14 suites / 34 tests 过；build 过（page.js 842 KiB / 上限 848）；登录实测截图 pic/13~17；控制台无本插件报错。弹窗点击行为留用户人工验收。
