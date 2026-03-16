# TODO

## 1. 提交当前工作区 (Commit current workspace)
- [x] 提交 `.gitignore` 的改动（新增 e2e 忽略规则）
- [x] 提交 `CLAUDE.md` 的重构内容
- [x] 提交 `jest.config.js` 的修改
- [x] 处理未跟踪的文件（`docs/plans/`, `docs/project-status.md`, `GEMINI.md`, `tasks/`）
- [x] 清理不必要的临时文件 (`CLAUDE copy.md`, `fanfou账号`, `image copy 3.png`, `img/`)

## 2. 验证与优化 sidebar-statistics
- [x] 构建项目 `npm run build`
- [x] 在真实 Chrome 环境中验证 `gemini/fix-mv3` 的 OAuth 方案（已由 481924b 实现）
- [x] 结合 `claude` 分支的 DOM 抓取方案作为 OAuth 的 fallback（提高首屏加载速度）
- [x] 引入 `claude` 分支的 `m.fanfou.com` 抓取最早消息时间逻辑（作为自己页面的 fallback）
- [x] 决定最终采用哪种修法 (已决定：组合方案)

## 3. 整合决策 (Integration decision)
- [x] Cherry-pick `claude` 分支的 `check-friendship` 修复（支持双向关系检查，且逻辑更稳健）
- [x] 确保 `proxiedFetch` 在 `gemini` 分支中也是可用的（或改用 `fanfouOAuth.request` 封装）
- [ ] 合并或关闭实验性分支

## 4. modernization 分支评估
- [ ] 检查 `modernization` 分支的当前状态
- [ ] 决定是继续推进构建系统现代化还是放弃

## 5. 其他
- [ ] 记录学习到的教训到 `tasks/lessons.md`

## 6. 分支比较与分析
- [x] 确立比较范围：关注 `gemini/fix-mv3` 与 `claude/fix-sidebar-friendship-e2e` 关于他人页面 sidebar 统计/注册时间/关系状态的差异
- [ ] 收集关键提交（`git log`/`git show`）并列出涉及的核心文件
- [ ] 记录问题列表（按严重级别）并判断哪个分支更稳妥，准备合并策略

## 7. 诊断与修复：注册时间与好友关系 (基于审核报告与竞品分析)
- [x] **Research (`nofan` 竞品方案对比)**
  - 调研结论: `nofan` 属于完全授权的 CLI 工具，它获取用户必须在使用前通过命令行的提示输入真实密码来换取 OAuth Token 授权。因为浏览器插件不应该去要求用户明文输入密码以防安全泄漏且不符合"免配置"的易用性场景，所以我们不应直接效仿它目前的做法。我们要回归依靠 Web 会话自身特权的思路。
- [x] **Research (验证 JSONP 的可行性)**
  - 调研结论: 饭否官方已经彻底封锁了对 `/users/show.json` 的无状态匿名访问（包含 JSONP）。在没有严格 OAuth 签名或有效的特定 Session 的情况下，会直接返回 **401 参数错误**。因此，恢复原版的 JSONP 获取注册时间路线**走不通**。
  - **最终破局点**: 我们决定直接在插件的 OAuth 流程中内置 `nofan` 开源的 Consumer Key 和 Secret。让用户不仅不需要去查找和输入那些晦涩的 Key，直接一键点击“前往官网授权”完成 OAuth 的闭环！
- [x] **Implementation (`sidebar-statistics` 与 OAuth 完美闭环)**
  - [x] 修改 `src/settings/components/OAuthPanel.js` 等面板代码，内置 `nofan` 的 Consumer Key 和 Secret，降低用户的登录门槛。
  - [x] (根据 Claude 反馈) 在 `src/background/environment/fanfouOAuth.js` 的 `handleAuthorize()` 中移除对 `enabled` 状态的强校验（由于内置 Key 永远有 Credential，不应因为没打开设置页开关而拦截用户的授权操作）。
- [x] **Implementation (`check-friendship`)**
  - [x] 抛弃不稳定的 `friends?u=目标用户` 页面匹配方案。
  - [x] 删除对自身 ID 强解析行为 (`getLoggedInUserId` / `normalizeUserId`) 带来的脆点。
  - [x] 收敛查询逻辑，变回仅向 `m.fanfou.com/followers/p.N` 发起请求并查找页面目标 ID。
  - [x] 修复当查询失败或遇到异常时死锁的缺陷，使检查行为可重试 (`hasChecked = false`)。
- [x] **Verification**
  - [x] 在真实 Chrome 环境及 Playwright E2E 中跑通 OAuth 授权链路和 `check-friendship` 流程。

## 8. 修复互相关注功能与桥接层异常
- [ ] 修复 `src/content/environment/bridge.js`，增加 try-catch 避免 SW 休眠导致的 postMessage 报错造成死锁
- [ ] 修复 `src/features/check-friendship/@page.js` 的 `hasChecked` 重置逻辑，确保成功和失败路径均能清空改标志以便下一次点击正常工作
- [x] 跑通端到端测试验证以上两处修复

## 9. 接手 avatar-wallpaper 分支修复与 MVP 落地（2026-02-25）
- [x] 接手并评估 `feat/avatar-wallpaper`（保留分支历史，不重建 worktree）
- [x] 定位设置页白屏高风险点并修复（移除不符合 subfeature 约定的 background/content 实现）
- [x] 重构为单一 `@page` 方案：自动抓取关注头像 + 本地缓存 + 网格壁纸渲染
- [x] 保留设置项（开关/透明度/刷新周期）并维持 settings 接入
- [x] 运行 lint/build 验证并通过
- [ ] 继续扩展：支持手动触发刷新与导出壁纸图片

### 9.1 Review 结果（2026-02-25）
- 关键改动：
  - 删除：
    - `src/features/avatar-wallpaper/apply-wallpaper@content.js`
    - `src/features/avatar-wallpaper/fetch-avatars@background.js`
    - `src/features/avatar-wallpaper/avatar-wallpaper.css`
  - 新增：
    - `src/features/avatar-wallpaper/avatar-wallpaper@page.js`
    - `src/features/avatar-wallpaper/avatar-wallpaper@page.less`
  - 更新：
    - `src/features/avatar-wallpaper/metadata.js`
- 验证：
  - `npx eslint src/features/avatar-wallpaper/avatar-wallpaper@page.js src/features/avatar-wallpaper/metadata.js src/settings/getTabDefs.js`
  - `npx stylelint src/features/avatar-wallpaper/avatar-wallpaper@page.less`
  - `npm run build`
- 结果：通过

## 10. Avatar Wallpaper 视觉优化（2026-02-25）
- [x] 移除“为铺满而重复头像”的策略，优先每个头像只渲染一次
- [x] 头像尺寸改为按总人数自适应（优先更大尺寸，解决“看起来太小”）
- [x] 新增“蓝色背景方案”设置项（至少 5 种），支持页面实时切换
- [x] 优化整体排版（居中、间距、阴影）提升美观度
- [x] 运行 lint/build 验证并提交

### 10.1 Review 结果（2026-02-25）
- 关键改动：
  - `avatar-wallpaper@page.js`
    - 去除重复平铺逻辑，改为唯一头像优先渲染（最多 520）
    - 新增按头像数量自适应尺寸（72/64/56/52/48）
    - 新增 5 套蓝色背景预设（settings 可选）
  - `avatar-wallpaper@page.less`
    - 网格布局居中 + 间距与阴影优化，减少“头像太小”体感
  - `metadata.js`
    - 新增 `backgroundPreset` 选项
- 验证：
  - `eslint` / `stylelint` / `npm run build` 通过

### 10.2 用户反馈后增强（2026-02-25）
- [x] 新增选项：`prioritizeFavoriteFanfouers`（有爱饭友优先）
- [x] 读取 `favorite-fanfouers/friendsData`，将星标头像排在渲染序列前部
- [x] 头像墙布局改为“左右两栏”，中间留白不再放头像
- [x] 验证（eslint/stylelint/build）通过

### 10.3 用户反馈后增强（2026-02-25）
- [x] 扩展蓝色背景预设：5 -> 10
- [x] 新增选项：`fillBlueOnlyInGaps`（蓝色仅填充头像间隙）
- [x] 壁纸渲染支持两种模式：
  - 间隙填充模式：蓝色只出现在头像空隙，不覆盖头像
  - 全局背景模式：蓝色铺在页面背景层
- [x] 验证（eslint/stylelint/build）通过

### 10.4 同步 2026.2 并修复羊了个羊模式（2026-03-16）
- [x] 将 `2026.2` 的最新更新合入 `feat/avatar-wallpaper`
- [x] 以 `2026.2` 已有的 `match3Mode` 为基线继续修复，而不是在旧分支上另起一套模式
- [x] 将羊了个羊模式的点击牌、槽位牌和飞行动画牌改为“麻将牌底 + 头像贴片”的矩形样式
- [x] 保持普通头像墙模式不变，只修改 `match3Mode`
- [x] 运行验证（eslint / stylelint / build）

### 10.4 Review 结果（2026-03-16）
- 关键改动：
  - 合入 `2026.2` 后，恢复 `metadata.js` 中已有的 `match3Mode`（“羊了个羊模式（实验）”）入口
  - `src/features/avatar-wallpaper/avatar-wallpaper@page.js`
    - 新增 match3 牌面尺寸与头像贴片指标
    - 将点击牌、槽位牌、飞行动画牌统一改为通过 `--sf-match3-avatar-image` 渲染矩形牌面
  - `src/features/avatar-wallpaper/avatar-wallpaper@page.less`
    - 将 match3 的牌堆、槽位与飞行动画从圆头像改为麻将牌风格矩形卡面
    - 普通头像墙样式保持不变
- 验证：
  - `npx eslint src/features/avatar-wallpaper/avatar-wallpaper@page.js src/features/avatar-wallpaper/metadata.js babel.config.js build/webpack.js.config.js`
  - `npx stylelint src/features/avatar-wallpaper/avatar-wallpaper@page.less`
  - `npm run build`
- 结果：
  - 自动化验证通过
  - 真实 Chrome / 饭否页面的人工视觉验收尚未在此 CLI 环境执行
