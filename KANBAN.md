# KANBAN — 当前项目状态

> 本文件是唯一的短期状态面板。只在方向、门禁或用户决定改变时更新；短任务由代码、验证和提交本身留痕。

## 当前方向

个人归档 P0 与 P1 第一刀已合入 `2026.8`。用户于 2026-08-13 报告已在真实 Windows Chrome
完成大号验收；原始备份目录含私密数据，不进入仓库，也不以本地读回替代该报告。

下一方向是本地「饭否怀旧馆」：把自己的消息、收藏、收到的提及和私信，
做成可断网浏览的个人历史，而不是联网复刻饭否。详情见长任务卡
[`tasks/card-local-nostalgia-hall.md`](tasks/card-local-nostalgia-hall.md)。

## 下一步

已实现「收到的提及」、收藏和私信的本地归档与离线入口，代码、测试和生产构建均已完成。私信接口检查
保留为无写入诊断，不再阻止用户已授权的正式备份；下一步只是在真实 Windows Chrome 验收 OAuth 返回、
目录落盘和离线页面。

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
