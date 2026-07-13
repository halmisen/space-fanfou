# Spec: 个人年度报告（annual-report）

Updated: 2026-07-12
Executor: claude
Status: spec 已确认需求，待排期实现
前置调研: `docs/fanfou-ecosystem-feature-spec.md`（2026-06-08，personal-archive 方向）

## 已确认的产品决策（2026-07-12 用户拍板）

1. **统计范围：自然年**。默认当前年（2026），可切换查看往年
2. **呈现方式：独立扩展页面**，完全本地实现——数据不出浏览器，无服务器
3. **报告内容**：发言总数与时间分布、高频关键词、互动排行榜、图片与收藏统计、被 @ 次数

## 背景与目标

饭否用户的数据只存在于饭否；本插件已有 OAuth 通道（`fanfou-oauth` 一键授权）。
目标：点一个按钮，把自己该年的全部消息同步到本地，生成一张排版精致、适合截图分享的年度报告页。

用户视角的完整流程：
设置页点「生成年度报告」→（未授权则先一键授权）→ 进度条同步数据 → 新标签页打开报告。

## 非目标

- 不做云端存储/分享链接（截图即分享）
- 不用 AI/联网做关键词——本地确定性算法
- MVP 不做导出图片文件（页面本身排版即截图友好）
- 不统计他人数据，仅当前授权账号自己的内容

## 已验证的技术前提

- OAuth 桥：`fanfouOAuth.request(...)` 已可从页面/扩展页发起签名请求（仅限 `api.fanfou.com`）；
  token 存 `chrome.storage.local`（`fanfou-oauth/tokens`）
- API（`FanfouAPI/FanFouAPIDoc` wiki 已核实，`count` 上限均为 60）：
  - `GET /statuses/user_timeline.json`：支持 `max_id`/`since_id`/`count`/`page`
  - `GET /statuses/mentions.json`：同上分页参数
  - `GET /favorites/id.json`：支持 `count`/`page`
- 先例：`sidebar-statistics` 已用 OAuth 拉用户数据；`avatar-wallpaper` 已在
  `chrome.storage.local` 存大记录并带 `CACHE_SCHEMA_VERSION`

## 技术方案

新建 `src/features/annual-report/` + 一个新的扩展页面入口：

```
annual-report/
├── metadata.js               # 主开关（默认开），设置页入口按钮挂靠
├── sync.js                   # 数据同步器（纯逻辑，可单测）
├── aggregate.js              # 统计聚合（纯函数，可单测）
├── keywords.js               # 本地关键词提取（纯函数，可单测）
└── report/                   # 报告页 Preact 组件
src/entries/annual-report.js  # 新 webpack entry（仿 settings.js）
static/annual-report.html     # 页面骨架
```

构建改动：`build/` 增加 entry + HtmlWebpackPlugin 输出 `annual-report.html`（照 settings 抄）。
入口：设置页「工具」区新增按钮「生成年度报告」，`chrome.tabs.create` 打开扩展页
（P1 再加首页侧栏入口）。

### 数据同步器（sync.js）

- **抓取自己的消息**：`user_timeline` 以 `max_id` 向历史翻页，直到
  `created_at` 早于目标年 1 月 1 日或返回空页
- **节流**：串行请求 + 每次间隔 500ms，进度条显示「已同步 N 条 / 正在获取 YYYY-MM」
- **断点续传**：同步游标存 `annual-report/syncState/<userId>`
  （`{ oldestId, newestId, year, updatedAt }`），中断后可继续；再次生成时用
  `since_id` 增量补新
- **存储瘦身（关键设计）**：**不持久化消息原文**。同步过程中流式完成两件事：
  1. 抽取轻量记录存入 `annual-report/statuses/<userId>/<year>`：
     `{ id, t(时间戳), len(字数), hasPhoto, replyToUser, repostUser, atUsers[] }`
     （约 100B/条，1 万条 ≈ 1MB，storage.local 10MB 限额内安全）
  2. 关键词词频在内存中增量累加，同步结束只存 top 200 词频表，原文即弃
- **被 @ 数据**：`mentions` 时间线按同样方式翻到年初；饭否 API 翻页深度可能有上限，
  若提前截断，报告中标注「至少 N 次」——诚实呈现而不是编造精确值
- **收藏口径限制**：饭否 API 不返回「收藏动作的时间」，只有被收藏消息本身的发表时间。
  统计口径定为：**当前收藏中、发表于该年的消息数** + 收藏总数，报告中注明口径

### 统计聚合（aggregate.js，全部纯函数）

| 指标 | 来源 |
| --- | --- |
| 年度消息总数 / 总字数 / 发图数 | 轻量记录 |
| 月度分布柱状图 | `t` 按月分桶 |
| 24 小时时段分布（几点最活跃） | `t` 按小时分桶 |
| 最长连续发言天数 / 发言天数 | `t` 按天去重 |
| 互动榜·我发出的 top10 | `replyToUser`/`repostUser`/`atUsers` 合并计数 |
| 互动榜·谁 @ 我最多 top10 | mentions 数据的作者计数 |
| 被 @ 总次数 | mentions 计数（可能为下限值） |
| 高频关键词 top N | keywords.js 词频表 |

### 关键词提取（keywords.js，本地确定性）

- 中文：2~4 字 n-gram 词频统计 + 子串折叠（「年度报告」出现时不再重复计「报告」）
- 英文/数字：按词切分
- 内置停用词表（的/了/是/我/就… + @用户名 + URL + 转发标记）
- 无外部依赖、无分词库、无网络请求——结果可复现

### 报告页（report/）

- Preact + LESS，固定内容宽度 ~720px 居中，纵向长页，**截图友好**
- 顶部：年份切换器（有数据的年份）+「重新同步」按钮
- 区块顺序：大数字总览（消息/字数/图片/被@/收藏）→ 月度柱状图（纯 SVG，本地绘制）→
  时段分布 → 连续发言 → 关键词榜 → 互动榜（发出/收到两列，带头像）
- 页脚固定说明：「由太空饭否在你的浏览器本地生成，数据不上传任何服务器」
- 未授权态：引导一键授权；未同步态：引导点击同步并显示进度

### 隐私与数据管理

- 一切数据在 `chrome.storage.local`，永不 sync、永不上传
- 报告页提供「清除全部年度报告数据」按钮
- 记录带 `SCHEMA_VERSION`，未来结构变更时强制重新同步（沿用 avatar-wallpaper 先例）

## 风险与对策

| 风险 | 对策 |
| --- | --- |
| API 限速（约 150 次/小时量级，未官方核实） | 500ms 节流 + 断点续传；1 万条/年 ≈ 167 页请求，一次同步约 2 分钟，正常量级安全 |
| 超重度用户（>3 万条/年）存储压力 | 轻量记录 + 不存原文已把上限压到 ~3MB；仍超则提示分年清理 |
| mentions 翻页深度截断 | 「至少 N 次」标注，绝不编造 |
| page.js 包体积（872KB 上限 848KB 附近） | 报告页是独立 entry，不进 page.js；feature 侧只有设置入口按钮，增量可忽略 |

## 分期

- **P0（先能出报告）**：同步管线 + 大数字总览 + 月度分布 + 报告页骨架 + 设置页入口
- **P1**：关键词榜 + 互动榜 + 被 @ 统计 + 时段/连续天数
- **P2**：收藏统计、导出图片文件、多年对比、首页侧栏入口

## Sprint Contract（验收标准）

- [ ] `npm test`、`npm run build` 通过；sync 游标/aggregate/keywords 均有单测
- [ ] 实测：测试账号完成一次全年同步，进度条推进，中途刷新页面后能断点续传
- [ ] 实测：报告页展示全部 P0+P1 区块，数字与手工抽查一致（抽 1 个月人工数一遍）
- [ ] 实测：切换年份正常；重新同步走 since_id 增量而非全量
- [ ] 实测：「清除数据」后回到未同步引导态
- [ ] 核实：同步全程 DevTools Network 无 api.fanfou.com/fanfou.com 以外的请求
- [ ] 截图存证 pic/（报告页全貌）

## 工作量预估

P0 约 1.5~2 天（新 entry + 同步管线是大头），P1 约 1 天。建议 P0/P1 分两轮验收。
