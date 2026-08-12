# 长任务卡：个人归档长同步的抗中断与可自证

状态：active
建卡：2026-08-11
来源：用户 2026-08-07 真机反馈（大号全量同步停在 5700/23281 条），证据 `problem-pic/`

> 本卡是本议题唯一的长期记录。`KANBAN.md` 只在它 active 期间链接它。

## 1. 问题

大号（23281 条）全量同步在第 95 页附近中止，面板只显示「检测到未完成同步，可从已提交
水位继续」，**没有错误文本、没有控制台日志**。中止原因在磁盘和界面上都没有留下任何痕迹，
因此无法判断是网络挂起、service worker 回收、写盘失败，还是标签页被回收。

数据没有丢：水位每页落盘，`mergeStatusRecords` 按 id 去重，续传幂等。问题在于
**长任务禁不起一次抖动，且中止后无法自证**。

## 2. 冻结的验收标准

1. `sync.js` 对可恢复错误做有限次退避重试，重试成功不中断整轮；不可恢复错误（授权失效、
   账号不匹配、数据格式）立即终止，不做无谓重试。
2. 中止原因落盘：`meta.activeRun.stopReason` 与 `lastError{message, at, nextMaxId,
   committedPages}`，正常暂停与异常中止在磁盘上可区分。
3. 面板重开后能从 `meta.json` 读出「停在第几页、什么时间、什么原因」，不再依赖易失的
   组件 state。
4. 后台 `fetch` 有超时上限，网络挂起会变成一个真正的 Error，而不是永久 pending。
5. 新增单测覆盖：单页失败→重试成功→全量完成；重试耗尽→水位不丢、`stopReason` 已落盘；
   不可恢复错误不重试。
6. `npm test` 全绿；`npm run build` 通过且 `page.js` 不超过 `BUNDLE_SIZE_LIMIT`。

## 3. 缺陷清单（2026-08-11 六维度盘点 + 部分对抗复核）

复核说明：20 条发现里 22 个复核 agent 出了结论，其余因 session 限额未跑完。
`sync-resilience` 与 `mv3-lifetime` 两个维度的复核**全部未完成**，其结论由主会话逐条
回源码核实后采信，标注为「主会话核实」。

### 采信（按修复顺序）

| # | 缺陷 | 证据 | 判定 |
| --- | --- | --- | --- |
| D1 | service worker 休眠断开 port 时，**所有在途请求被无条件 reject**，随后才自动重连；一次自愈的抖动就能截断 390 页长任务 | `src/content/environment/messaging.js:41-43`；`sync.js:42` 无 try/catch | confirmed（主会话核实） |
| D2 | 后台 `fetch` 无超时。TCP 层挂起会让面板永久 `working=true`，既不 resolve 也不 reject，天然无错误文本、无日志 | `src/background/environment/fanfouOAuth.js:158` 裸 `await fetch`；全链路无 `AbortController`/`signal` | confirmed（主会话核实） |
| D3 | `activeRun` 没有任何字段区分「用户暂停」「异常中止」「标签页被回收」，三者在磁盘上完全同形 | `checkpoint.js:3-141` 无 `stopReason`/`error` 字段 | confirmed（两路复核通过） |
| D4 | 失败原因只写进 Preact 内存 state，刷新即永久丢失；`catch` 里没有一次 `console.error` | `PersonalArchivePanel.js:188-194`；`sync.js` 全文零 `console.*` | confirmed（两路复核通过，严重度由 high 下调至 medium：面板仍开着时能看到 ⚠️ 文本） |
| D5 | `activeRun.committedPages` / `nextMaxId` / `lastCheckpointAt` 已落盘，但面板重开后一个都不读，「停在第几页」在界面上答不出来 | `checkpoint.js:88-94` 写入；`PersonalArchivePanel.js:376-383` 只做布尔判断 | confirmed（三个维度独立发现） |
| D6 | 同步进行中 `publishSummary` 被 `working` 短路，首页侧栏摘要冻结数十分钟，与设置页数字对不上 | `PersonalArchivePanel.js:69` | confirmed（两路复核通过） |
| D7 | 写盘失败（配额、权限被收回、目录被移动）无重试，任一页写失败即终止整轮；但不破坏数据自洽 | `sync.js:81/84` 无 try/catch；`fsStore.js:121-149` | confirmed |
| D8 | 单条脏数据（缺 id、创建时间无效）会终止整轮，没有「跳过该条」机制；同一页会反复卡住 | `sync.js:58-60`；`statusRecords.js:86-88` | confirmed |
| D9 | 暂停只在页边界生效，在途请求无超时/无 abort，卡住时用户只能关标签页 | `sync.js:36-42, 95-97` | confirmed（两路复核通过） |

### 复核驳回（不修）

- 「`commitStatusPage` 无事务」— 分片先落盘、meta 后写是仓库自己测过的幂等设计
  （`fsStore.test.js:126-169`），且失败时面板会显示 ⚠️。不需要改成单文件事务。
- 「长任务中途不重校验写权限」— 事实成立，但异常会被 `handleStartSync` 的 catch 接住并
  显示，不是静默丢失路径。降级并入 D7。
- 「收藏同步未实现」— 是 spec 明写的 P1 范围（`docs/spec-personal-archive.md:378`），
  不是缺陷。
- 「`meta.json` 字段与 spec 4.4 不一致（缺 `counts.photos`）」— 不满足「中断长任务 /
  用户看不清 / 数据不可信」任一判据。
- 「分享弹窗不自动关闭」— `/sharer` 是饭否服务端渲染页面，「本窗口数秒后将自动关闭」这句
  文案不归本扩展管，扩展从未向该页注入过脚本（`@background.js:23-31`）。

## 4. 停在 5700 条的直接原因：D0 设置页是 popup，失焦即关

**已定案（用户 2026-08-11 指出，代码核实成立）。**

在饭否标签页上点扩展图标打开的设置页，是 browser action popup，不是标签页：

```js
// src/background/environment/actionLauncher.js:20
await chrome.action.setPopup({ tabId, popup: isFanfou ? SETTINGS_POPUP_URL : '' })
```

popup 只要失焦就会被 Chrome 关闭，整个 JS 上下文连同 `sync.js` 的 `while` 循环一起销毁。
全量同步是 20 分钟级长任务，期间用户点一下页面任何位置就结束了。这解释了全部现象：
没有错误文本、没有控制台日志、没有 `catch` 执行——**不是错误被吞了，是根本没发生错误**，
执行环境被外力整个拿走。

同一个 popup 里「选择备份文件夹」也是坏的：`showDirectoryPicker()` 弹出的系统对话框
会先让 popup 失焦关闭。

两个入口命运完全不同，此前没有人核对过：

| 入口 | 打开方式 | 长同步能否跑完 |
| --- | --- | --- |
| 扩展图标（饭否页面上） | `chrome.action.setPopup` → popup | **不能**，失焦即关 |
| 首页侧栏「本地备份」 | `proxiedCreateTab` → 真标签页 | 能 |

`docs/spec-personal-archive.md` §15.1 用「设置页是独立标签页，不会被误关」论证过
「执行不能搬到饭否页面内」。**这个论据本身是错的**——该结论仍然成立，但理由要换成
第 2、3 条（句柄绑 origin、归档要写磁盘）。spec 待订正。

### 复盘：为什么第一轮没找出来

六个维度的盘点全部在读源码，没有一个去核对「用户实际是怎么打开这个页面的」。
`mv3-lifetime` 维度甚至明确写了「同步跑在设置页标签页的 JS 上下文里」，
直接采信了 spec 的说法。主会话也照抄了同一句话。真实入口只在一张截图里——
popup 浮层贴着工具栏图标，边缘没有标签页——静态读码永远得不出这个结论。

## 5. 边界

- 不动 `origin/simplify`。
- 不改 `messaging.js` 的通用重连语义（影响全部 feature）；重试留在 `sync.js` 这一层。
- 不为这件事引入新依赖（`build/shared.js` 的 `BUNDLE_SIZE_LIMIT` 是硬门禁）。
- 收藏同步、`counts.photos`、「重试失败项」按钮不在本卡范围内。

## 6. 恢复指针

- 盘点原始数据：`/tmp/claude-1000/.../scratchpad/findings.json`（临时，已摘录进本卡第 3 节）
- 相关代码：`src/features/personal-archive/{sync,checkpoint,fsStore}.js`、
  `panel/PersonalArchivePanel.js`、`src/background/environment/fanfouOAuth.js`
- 真机验收前置条件见 `KANBAN.md` 的「边界与门禁」。

## 7. 进展

### 2026-08-11 第一刀（已落地，门禁通过）

| 缺陷 | 处理 |
| --- | --- |
| **D0** | 面板在 popup 上下文里不再显示任何操作按钮，只给一句解释和「在新标签页中打开备份页面」。判定抽成 `popupContext.js`（`chrome.tabs.getCurrent()` 在 popup 里拿不到标签页），带 3 个用例；判定出来之前不渲染按钮，避免闪出一个点了必然半途而废的「开始同步」 |
| D1 | `sync.js` 新增 `withRetry`：可恢复错误最多 5 次、指数退避（1/2/4/8 秒）。`Port disconnected` 归为可重试 |
| D2 | `fanfouOAuth.js` 的 `signedRequest` 加 `AbortController` + 45 秒超时；超时抛出明确 Error，不再永久 pending。同时把 HTTP `status` 单独透传（原先被错误正文顶掉，客户端无法区分 401 和 503） |
| D3 | `activeRun` 新增 `stopReason` / `stoppedAt` / `lastError`；暂停、报错各写各的，续传时清空 |
| D4 | `catch` 补 `console.error`；失败原因随 `meta.json` 落盘 |
| D5 | 面板重开后直接从 `meta.activeRun` 渲染「已提交几页、下一页游标、停止时间、失败原因」 |
| D6 | 同步中每 3 秒发布一次摘要（原先 `working` 时整轮不发布），首页侧栏显示「正在备份…已同步 N 条」。摘要带 `isRunning` + `updatedAt`，超过 60 秒没有新进度就不再声称进行中——备份标签页可能已被关掉；首页每 15 秒自行重算一次，让这行字能自动退回 |
| D7 | **部分**。写盘侧只把「文件被临时占用」（`NoModificationAllowedError` / `InvalidStateError`）列为可重试；权限被撤和磁盘满立刻停下并落盘原因 |
| D9 | **部分**。45 秒超时兜住了「在途请求永不返回」，但暂停仍只在页边界生效 |

顺带修复两处让门禁本身跑不起来的问题（在干净 HEAD 上同样复现，非本次改动引入）：

- `.eslintignore` / `.stylelintignore` 未排除仓库内的 `worktrees/`，ESLint 走进 worktree 自带的
  `node_modules` 直接崩溃，`npm run lint` 长期无法执行。
- `jest.config.js` 只排除了 `.claude/worktrees/`，没排除迁移后的 `worktrees/`，测试基线从
  26 suites 虚涨到 77。这是 2026-08-03「测试基线翻倍」的同一个坑第二次踩。

验证：`npm test` → 27 suites / 114 tests 全绿（新增 13 个用例）；`npm run build` → `BUILD_EXIT=0`，
`page.js` 869637 bytes（门禁 884736 bytes，余量 15099）。

### 未做（下一刀）

- 订正 `docs/spec-personal-archive.md` §15.1 里「设置页是独立标签页，不会被误关」的错误论据。
- 长任务期间给标签页加 `beforeunload` 提示，防止用户误关真标签页。

- D8：单条脏数据跳过并计入 `meta.skipped`，而不是终止整轮。
- D9 剩余：给在途请求加可中止能力，让「暂停」立即生效。
- D7 剩余：权限被撤时引导用户重新授权，而不是只报错。

## 8. 结案判定

（未结案）真机复跑大号之前不能结案——第一刀的目的是让下次中断可自证，
这个目的只有在真机再跑一次并读到 `stopReason` / `lastError` 之后才算达成。
