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

### 10.5 羊了个羊规则表达优化（2026-03-16）
- [x] 去掉数字/颜色提示，改为仅通过“相同头像”作为配对线索
- [x] 强化 match3 模式中可点牌与被遮挡牌的视觉区分
- [x] 保持消除逻辑不变，仅优化规则表达与交互理解
- [x] 运行验证（eslint / stylelint / build）

### 10.5 Review 结果（2026-03-16）
- 关键改动：
  - `src/features/avatar-wallpaper/avatar-wallpaper@page.js`
    - 羊了个羊模式不再渲染类型数字徽章
    - 点击牌、槽位牌、飞行动画牌都只保留头像本身作为配对线索
  - `src/features/avatar-wallpaper/avatar-wallpaper@page.less`
    - 移除按类型着色的 match3 边框与编号样式
    - 强化 blocked 牌的压暗效果，突出可点牌 hover 态
- 验证：
  - `npx eslint src/features/avatar-wallpaper/avatar-wallpaper@page.js src/features/avatar-wallpaper/metadata.js babel.config.js build/webpack.js.config.js`
  - `npx stylelint src/features/avatar-wallpaper/avatar-wallpaper@page.less`
  - `npm run build`
- 结果：
  - 自动化验证通过
  - 真实 Chrome / 饭否页面的人工视觉验收尚未在此 CLI 环境执行

### 10.6 羊了个羊可读性增强（2026-03-16）
- [x] 让“被遮挡牌”和“灰色但可点牌”的视觉区分不依赖头像内容本身
- [x] 将剩余总牌数与槽位占用拆成更清晰的状态展示
- [x] 保持现有三消规则不变，仅增强反馈表达
- [x] 运行验证（eslint / stylelint / build）

### 10.6 Review 结果（2026-03-16）
- 关键改动：
  - `src/features/avatar-wallpaper/avatar-wallpaper@page.js`
    - 羊了个羊托盘状态拆成“剩余牌”与“槽位”两个独立状态块
    - 保持三消规则不变，仅增强状态反馈表达
  - `src/features/avatar-wallpaper/avatar-wallpaper@page.less`
    - 给 blocked 牌增加独立遮挡层，避免灰头像被误判为不可点
    - 强化可点牌亮边，托盘状态改为更高可见度的双标签
- 验证：
  - `npx eslint src/features/avatar-wallpaper/avatar-wallpaper@page.js src/features/avatar-wallpaper/metadata.js babel.config.js build/webpack.js.config.js`
  - `npx stylelint src/features/avatar-wallpaper/avatar-wallpaper@page.less`
  - `npm run build`
- 结果：
  - 自动化验证通过
  - 真实 Chrome / 饭否页面的人工视觉验收尚未在此 CLI 环境执行

### 10.7 更新分支项目状态文档（2026-03-16）
- [x] 将 `docs/project-status.md` 从旧的 `2026.2 / 2b5e5a8` 状态刷新到当前分支现实
- [x] 记录 `feat/avatar-wallpaper / 06fd403`、最近一轮羊了个羊改动方向、当前未提交文件与验证结果
- [x] 为后续继续工作补一段“从文档恢复上下文”的起点说明

### 10.7 Review 结果（2026-03-16）
- 关键改动：
  - `docs/project-status.md`
    - 更新分支、HEAD、当前工作线与最近一轮羊了个羊模式进展
    - 记录当前未提交文件、自动化验证状态与下一步人工验收建议
- 验证：
  - 文档更新基于当前 `git status --short --branch`、`git rev-parse --short HEAD` 与最近验证记录完成，无额外代码构建变更
- 结果：
  - 项目状态文档已可作为下次继续工作的入口

### 10.8 羊了个羊传统布局补完（2026-03-18）
- [x] 为“传统中置布局”补一个明确的“重开”入口
- [x] 让传统布局按视口自动缩小牌面，避免窄屏下棋盘被裁切
- [x] 微调传统布局 HUD 的小屏尺寸，保证托盘与顶角按钮仍可用
- [x] 运行验证（eslint / stylelint / build）

### 10.8 Review 结果（2026-03-18）
- 关键改动：
  - `src/features/avatar-wallpaper/avatar-wallpaper@page.js`
    - 传统中置布局改为按视口动态选择牌尺寸，优先保证棋盘完整落入可视区
    - 传统布局右上角增加独立“重开”按钮，复用现有 restart 逻辑形成完整闭环
  - `src/features/avatar-wallpaper/avatar-wallpaper@page.less`
    - 传统布局顶角按钮改为可并排/换行显示
    - 调整传统布局托盘 slot 尺寸与小屏 padding，降低窄屏溢出风险
  - `docs/project-status.md`
    - 同步记录传统中置布局已落地、当前风险与下一步人工验收重点
- 验证：
  - `npx eslint src/features/avatar-wallpaper/avatar-wallpaper@page.js src/features/avatar-wallpaper/metadata.js`
  - `npx stylelint src/features/avatar-wallpaper/avatar-wallpaper@page.less`
  - `npm run build`
- 结果：
  - 自动化验证通过
  - 真实 Chrome / 饭否页面中的桌面/窄屏人工验收仍待执行

### 10.9 羊了个羊传统布局重排（2026-03-18）
- [x] 让传统布局的最小化状态在同标签页切换页面后保持
- [x] 修正传统布局棋盘的中心对齐逻辑，避免二次偏移
- [x] 将中心主牌阵改为“饭否”字形，并移除破坏中心感的散落独立牌堆
- [x] 统一侧边牌堆/盲盒牌堆的堆叠方向表达
- [x] 运行验证（eslint / stylelint / build）

### 10.9 Review 结果（2026-03-18）
- 关键改动：
  - `src/features/avatar-wallpaper/avatar-wallpaper@page.js`
    - 新增传统布局最小化状态的 `sessionStorage` 保持逻辑
    - 传统主牌阵改为基于“饭否”字形采样生成，并缓存采样结果避免重复扫描
    - 传统棋盘坐标改为先归一化再整体居中，修复视觉中心偏移
    - 砍掉传统布局里分散的独立小牌堆，只保留更统一的左右牌堆与底部盲盒堆
  - `src/features/avatar-wallpaper/avatar-wallpaper@page.less`
    - 新增舞台背景“饭否”字样，强化字形主牌阵的视觉中心
    - 传统主牌阵预览层进一步减弱，避免把字形轮廓糊脏
- 验证：
  - `npx eslint src/features/avatar-wallpaper/avatar-wallpaper@page.js src/features/avatar-wallpaper/metadata.js`
  - `npx stylelint src/features/avatar-wallpaper/avatar-wallpaper@page.less`
  - `npm run build`
- 结果：
  - 自动化验证通过
  - 真实 Chrome / 饭否页面中的最终视觉验收仍待执行

### 10.10 羊了个羊传统字形修订（2026-03-18）
- [x] 放弃系统字体采样，改用固定“饭否”字模控制传统主牌阵轮廓
- [x] 降低中心覆盖层数量，优先保留字形可读性
- [x] 拉大传统主牌阵横纵步距，并把左右牌堆再往外退一点
- [x] 运行验证（eslint / build）

### 10.10 Review 结果（2026-03-18）
- 关键改动：
  - `src/features/avatar-wallpaper/avatar-wallpaper@page.js`
    - 传统主牌阵改为读取固定 10x20 `#` 字模，不再受浏览器字体渲染影响
    - 传统主牌阵改成“顶层 36 张牌负责写字，下面两层只做支撑”的分层策略
    - 托盘失败判定收紧到 `7/7` 满槽即结束，并为失败态挂上独立状态特效
    - 传统字形的横纵步距和左右辅牌堆间距同步拉大，缓解“两团牌糊在一起”的问题
  - `src/features/avatar-wallpaper/avatar-wallpaper@page.less`
    - 传统主牌阵的被遮挡支撑层改成近乎隐形，避免继续污染“饭否”顶层轮廓
    - 失败态新增居中“游戏结束”字标和 tray / controls / stage 联动震动特效
- 验证：
  - `npx eslint src/features/avatar-wallpaper/avatar-wallpaper@page.js src/features/avatar-wallpaper/metadata.js`
  - `npx stylelint src/features/avatar-wallpaper/avatar-wallpaper@page.less`
  - `npm run build`
- 结果：
  - 自动化验证通过
  - 真实 Chrome / 饭否页面中的最终视觉验收仍待执行
