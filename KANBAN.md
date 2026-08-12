# KANBAN — 当前项目状态

> 本文件是唯一的短期状态面板。只在方向、门禁或用户决定改变时更新；短任务由代码、验证和提交本身留痕。

## 当前方向

个人归档 P0 与 P1 第一刀已合入 `2026.8`。真实 Windows Chrome 小号已跑通图片下载和离线页面。
用户 2026-08-07 反馈大号全量同步停在 5700/23281 条。根因已定案：在饭否页面点扩展图标打开的
设置页是 browser action popup，失焦即关，同步循环随上下文一起销毁。详见长任务卡
[`tasks/card-archive-reliability.md`](tasks/card-archive-reliability.md)。

## 下一步

在真实 Windows Chrome 重装扩展后验证两件事：一是从扩展图标进入「个人归档」只看到跳转提示、
看不到任何操作按钮；二是从首页侧栏「本地备份」进入的独立标签页里跑完大号全量同步，
核对 23281 条的去重数、首尾 ID、月份分片和 `meta.json`。最后断网打开 `index.html`，
确认 Network 面板零请求。

## 边界与门禁

- 目录句柄、OAuth、Cookie、`.env`、账号和验收截图不得进入 Git。
- File System Access 目录选择与 Chrome 重启后的权限保持，不能用临时 profile 的 `agent-browser` 证明，必须用真实桌面 Chrome 验收。
- 扩展没有固定 `key`；跨目录或跨版本分发前，必须先解决本地数据迁移或稳定扩展 ID。
- `origin/simplify` 是独立重写线，除非用户明确要求，否则不得修改或合并。

## Parked

- 归档页新样式和首页「本地备份」入口的真机核对。
- Chrome Web Store 路线：先移除或替换 MV3 禁止的远程 Google Analytics 代码。
- `docs/spec-undo-status.md` 与 `docs/spec-annual-report.md` 的后续实现。

## 记录规则

- 长期决定见 `reference/logic.md`；开放风险见 `reference/risks.md`；防错规则见 `lessons.md`。
- 旧 `tasks/` 控制面已退出使用；历史状态和流水保留在 `reference/project-history.md` 与 `archive/task-journal.md`，Git 历史继续保存原貌。
