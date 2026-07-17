# CLAUDE.md / AGENTS.md 过时性审计与修订指令

- executor: claude (Fable 5)
- run_id: docs-audit-20260717
- timestamp: 2026-07-17
- 目的: 供下一个 agent（Codex）据此修订两份文档。所有结论均已在 2026-07-17 用命令实测核验，非凭记忆推断。

## 核验基准（2026-07-17 实测）

- 当前分支: `2026.8`（`git branch --show-current`）
- 工作区: 干净（`git status --short` 无输出）
- `static/manifest.json`: `"manifest_version": 3`
- package.json: webpack `^4.29.6`、preact `^10.0.0`；scripts 含 test / lint / lint:js / lint:css / unit / unit:dev / cleanup / dev / build / pack / release
- `src/entries/`: background-content-page.js、offscreen.js、settings.js 三个入口均存在
- CLAUDE.md 举例的功能模块均存在且文件名相符：`src/features/auto-pager/{metadata.js,@page.js}`、`src/features/notifications/{metadata.js,service@background.js,update-details@background.js}`、`src/features/floating-status-form/`（含 replay-and-repost@page.js/.less）
- `docs/architecture.md`、`docs/publish.md`、`docs/contributing.md` 均存在
- `tests/playwright/` 存在 5 个 spec：extension-smoke / fanfou-auth-and-features / oauth-options / probe / status-form
- `tasks/` 现有控制面板结构：STATUS.md（驾驶舱，2026-07-13 更新）、todo.md、problems.md、logic.md、lessons.md、journal.md、handoffs/
- `docs/project-status.md`: 快照停留在 2026-02-26，写的分支是 `2026.2`
- `Claudeupdate.md`: 不存在（AGENTS.md 引用时带了"仅当存在时"限定，不算错误）

## 结论

1. **CLAUDE.md 基本不过时**：所有事实性描述（MV3、技术栈、命令、目录约定、文件名约定、引用文档）逐条核验均成立。问题是"缺内容"而非"写错"。
2. **AGENTS.md 核心段落已失效**："Current Project Reality" 一节把 2026 年 2 月的临时状态写死进了文档，与现状冲突。

## AGENTS.md 具体失效点

| 位置 | 文档所写 | 实际现状 |
|---|---|---|
| L23-24 | 当前分支是 `2026.2` | 当前分支是 `2026.8` |
| L25-31 | avatar-wallpaper / status-form-enhancements / status-form.spec.ts / tasks/* 有"在途未提交改动，勿回滚" | 工作区干净，该批工作早已提交，警告已无对象 |
| L22 | `docs/project-status.md` 最后更新 2026-02-23 | 实际该文件写的是 2026-02-26；且整个文件是五个月前的过期快照 |
| L14 | 引用 `PROJECT-STATUS-20260225.md` 作为参考 | 同为二月历史件，仅有历史价值 |

病根：把易变状态（分支号、在途文件清单、快照日期）硬编码进长期文档，必然随时间腐烂。AGENTS.md 自己 L20 就写着 "must re-check each task"，原则正确，写法自相矛盾。

## 修订指令

### AGENTS.md（必改）

1. **删除整个 "Current Project Reality" 一节**（L20-32），替换为一段不含任何具体分支号/文件清单/日期的常青文字，要点：
   - 实时状态一律以命令为准：`git branch --show-current`、`git status --short`
   - 项目驾驶舱是 `tasks/STATUS.md`；会话开始按顺序读 `tasks/{STATUS,todo,problems,logic,lessons}.md`
   - 状态快照类文档（`docs/project-status.md`、`PROJECT-STATUS-*.md`）一律视为历史参考，禁止据其行动
2. "Source of Truth" 优先级列表（L8-15）相应简化：保留 CLAUDE.md → live repo state 两级，把快照文档降级为"历史参考"，删除对 `Claudeupdate.md` 的引用（文件不存在，条目无意义）。
3. 其余部分（Mandatory Agent Workflow、Command Output Discipline、Practical Guardrails）内容仍然有效，**保留不动**。

### CLAUDE.md（补充，不改已有内容）

1. 在 Task Management 或 Reference Docs 附近补一小节：`tasks/` 控制面板结构（STATUS.md 驾驶舱、todo/problems/logic/lessons、handoffs/ 交接目录）及会话起始读序。
2. Testing 部分补一句：端到端测试用 Playwright，spec 在 `tests/playwright/`，运行方式为 `npx playwright test`（如需可先核实 playwright.config.ts 中的实际配置再写）。

### 约束

- 只改上述两个文件，diff 最小化；不要顺手"美化"其他段落。
- 不要在文档中引入新的具体分支号、日期、HEAD 哈希等易变信息。
- 修订完成后自查：文档中不应再出现 `2026.2`、在途文件清单、`Claudeupdate.md`。
- 本次修订不涉及提交；改完停在工作区待人工 review。
