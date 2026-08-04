# Space Fanfou worktrees

主 checkout 是 `2026.8`。功能分支的 checkout 放在仓库外的隐藏目录
`../.worktrees/space-fanfou/`，这样项目根目录只保留主 checkout，同时 Git
仍然把每个分支当作独立 worktree 管理。

| 目录 | 分支 | 用途 |
|---|---|---|
| `avatar-wallpaper/` | `feat/avatar-wallpaper` | 头像墙 / 壁纸功能线 |
| `beautify/` | `feat/beautify-plan` | 界面美化方案线 |
| `fix-space-pr/` | `fix-space-fanfou` | Space Fanfou 修复线 |
| `personal-archive/` | `feature/personal-archive` | 个人归档功能线 |

查看实时路径、HEAD 和分支关系：

```bash
git worktree list
```

不要直接删除这些目录；先用 `git worktree remove`，或用
`git worktree move` 将它们迁到其他位置。
