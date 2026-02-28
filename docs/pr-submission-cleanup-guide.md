# PR 提交清理对比指南 (2026.2 vs fix-space-fanfou)

为了保持向上游提交 Pull Request 的整洁性，我们在提交 `fix-space-fanfou` (针对 main 仓库合并) 时，相对于日常开发分支 `2026.2` 进行了大量的文件清理。

本对比文档旨在作为未来再次向主仓库提交 PR 时的操作指南，防止将我们本地开发的“脚手架”及内部记录文件推送到上游。

## 分支定位差异

- **`2026.2` (日常开发分支)**：
  存放了开发和调试过程中的各种中间产物，包含测试文件（如 `test-features.js`）、规划文档（`docs/plans/`）、项目状态记录、归档的分析报告等。这是一个“验证驱动 (Verification Before Done)”的完备分支。
  
- **`fix-space-fanfou` (向外提交专用分支)**：
  它是在开发修复完成后，专门拉取并清理出的“纯净版”分支。它移除了约 6350 行代码，主要删除了对于上游项目维护者来说不必要的个人文档与测试配置。

## 处理方式清单 (在提交 PR 前需清理的项目)

如果在未来需要再次向 main 提交更改，请以 `2026.2` (或当时新的开发分支) 为基础检出新的 `fix-*` 分支，并执行以下清理动作：

### 1. 移除中间文档与存档文件
在提交给上游的 PR 中，不应包含我们的本地规划与分析日志。
- `docs/archive-2025/` 目录下的所有文件（各种分析总结与旧报告）
- `docs/plans/` 目录下的所有本地任务执行计划
- `docs/` 下的单点分析文件（如 `bugfix-*.md`, `*-investigation.md`, `project-status.md` 等）
- `tasks/` 目录下的任务记录，如 `oauth-status-report.md`, `popupbox-wallpaper-context.md` 等

### 2. 移除本地测试脚本
- `test-features.js` (或者其他个人测试文件)，保留项目原本标准的测试结构。

### 3. README 和文档的精简 (可选/看情况)
在 `fix-space-fanfou` 分支中，有几个 Commit 专门调整了 `README.md`，加入了 fork 的安装说明并移除了内部安装繁重的流程。
如果是针对上游的 PR：
- 我们应该确保 `README.md` 尊重并符合上游的原始格式，或者如果是发布 Release 版本时，仅提供最极简的安装引导。
- 梳理增加了 `docs/fork-differences.md` 等文件来单独解释 Fork 版特性。

## 未来操作建议的工作流

1. **日常开发与测试**： 坚持在 `2026.2` 等主分支开发。
2. **准备 PR 提交**： `git checkout -b fix-your-feature-name` (基于开发完毕的分支)
3. **执行清理**： 批量删除无关的 `docs/` 内容与测试探针。
4. **提交并 Push**： 提交一段如 `chore: trim branch layout for neat PR` 的 commit，再推送到远端并发起 PR。

保持整洁与单一职责！
