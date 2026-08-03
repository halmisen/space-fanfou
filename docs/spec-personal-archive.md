# Spec: 个人归档与年度报告（personal-archive）

Updated: 2026-07-31（第四版，P0 实施中）
Executor: codex
Status: P0 实施中 — 4.5 File System Access 与 4.6 API 完整性地基均已通过；下一门禁为
P0 设置面板的真实全量同步、暂停续传与磁盘对账

前置文档：

- `docs/feature-directions.md`（2026-07-30，方向清单，本 spec 对应其第一组「数据类」）
- `docs/spec-annual-report.md`（2026-07-12，年度报告设计）
- `docs/fanfou-ecosystem-feature-spec.md`（2026-06-08，生态调研）
- `docs/distribution-and-devmode-storage.md`（2026-07-17，开发者模式存储风险）

### 修订记录

第一版（2026-07-31 早）由 codex 评审后修订，本版改动：

| 项 | 第一版 | 本版 |
| --- | --- | --- |
| 年度口径 | 未定 | **自然年**（用户确认） |
| 备份目录 | 待定 | `startIn: 'documents'` + 建议文案，不假装能指定路径 |
| 图片下载 | 待定 | **默认开**，同步前显示预估数量与体积 |
| `bundle.py` | 待定 | **删除**，见第 12 节 |
| 分支状态 | 「落后 1 个提交」 | **落后 6、领先 1**（第一版读反了 `rev-list` 左右列） |
| 纯函数复用 | 「原样复用」 | **选择性移植**，两个统计函数需改写，见第 5.1 节 |
| 目录句柄存放 | 写成 `chrome.storage.local` | **IndexedDB**（句柄不可 JSON 序列化），见第 9 节 |
| 收藏语义 | 仅增量追加 | 增加取消收藏的识别，见第 6.3 节 |
| 离线 HTML 安全 | 未提 | 强制转义 + 离线 CSP，见第 7.2 节 |
| 实测范围 | 仅文件系统 | 增加 **API 完整性实测**，见第 4.5 节 |
| 第 4.5/4.6 节实测结果（2026-07-31 四次修订） | 未测（占位） | 4.5 的 API 存在性、真实 Windows 目录读写、刷新和跨 Chrome 重启后的真实句柄取回均已通过；重启后权限实测为 `prompt`，真实点击后为 `granted`。4.6 已完整通过本账号校准：`user_timeline` 390 页/23281 条，favorites 43 页/2471 条，mentions 242 页/14085 条，均串行到空页且无重复；收藏 API 可枚举数比资料计数少 29，必须保留口径说明。 |

---

## 0. 与既有文档的关系

本 spec **取代** `docs/spec-annual-report.md` 中「技术方案 → 数据同步器 → 存储瘦身（关键设计）」
一节，即「不持久化消息原文、只存约 100B/条的轻量记录」那段设计。

该文档其余内容**继续有效且被本 spec 引用**：API 接口与分页参数（`count` 上限 60）、
关键词提取的本地确定性算法、收藏统计的口径限制、mentions 截断时标注「至少 N 次」、
报告页版式与区块顺序、隐私声明。

`docs/feature-directions.md` 第六节的「三条路」按第 1 条（合并成一件事）落地，
存储方案换成落盘，因此该节描述的存储冲突不再存在。

---

## 1. 已确认的产品决策

1. **消息原文保存到用户本地磁盘**，不做容量裁剪、不因存储限制丢弃内容。
2. **图片与收藏一并保存**，不是单独的后续功能。
3. **备份文件夹自带离线 HTML**，用户不装任何软件就能双击打开浏览全部归档。
4. **暂不上架 Chrome 应用商店**，分发方式仍是开发者模式加载解压文件夹。
5. **年度报告与个人备份是同一个功能**，共用一次同步，不拆成两个设置项。
6. **年度口径为自然年**（2026-07-31 确认），可切换查看往年；不使用滚动 365 天。

---

## 2. 一条已排除的方案：写进插件安装目录

**技术上做不到。** Chrome 扩展没有任何 API 能往自己的安装目录写文件。`chrome.runtime.getURL()`
只提供对打包资源的只读访问；`chrome.fileSystem` 是 ChromeOS App 的 API，不对扩展开放。MV3 下
扩展能写的持久化位置只有 `chrome.storage` / IndexedDB / Cache Storage（都在浏览器 profile 内，
不是用户可见的文件），以及通过 `chrome.downloads` 或 File System Access 写到用户文件系统。

**产品上也是最差选择。** 当前分发方式是「解压文件夹 + 开发者模式加载」，升级方式就是替换那个
文件夹。备份放在里面，等于每次升级插件都把用户的归档删一遍。

`docs/distribution-and-devmode-storage.md` 已记录的相关风险（未固定 manifest `key` 时扩展 ID
可能变化、`chrome.storage.local` 数据不跟随）**正是「原文必须落到用户磁盘」的第二个理由**。

---

## 3. 非目标

- 不做云端存储、不做分享链接、不做服务器。
- 关键词提取不用 AI、不联网。
- 不备份他人数据，只备份当前授权账号自己的消息、收藏和收到的提及。
- 不导出 OAuth token、cookie、请求签名或任何凭据材料。
- 不在插件里重做时间线浏览器。
- 不在备份文件夹里放任何可执行脚本（见第 12 节）。

---

## 4. 落盘方案

### 4.1 两条候选路径

| | A. File System Access | B. `chrome.downloads` |
| --- | --- | --- |
| 用户操作 | 点一次「选择备份文件夹」，句柄持久化 | 零点击，固定写到 `下载/太空饭否备份/` |
| 新增权限声明 | 无（授权来自用户手势） | 需要在 manifest 加 `downloads` |
| 写入 | 任意目录树，可覆盖 | 支持子目录与 `conflictAction: 'overwrite'` |
| **读回已写内容** | **可以** | **不可以** |
| 运行位置 | 仅扩展页面（设置页），service worker 不可用 | 后台可用 |
| 摩擦 | 浏览器重启后首次写入需再点一次「允许」 | 无 |

### 4.2 选 A，决定性理由是「能读回」

增量同步后需要重新生成完整的 `index.html`，而生成它需要**全部**历史消息。

- 走 A：读回上次写的 `statuses/*.json`，与本次新增合并后重写 HTML。增量成立。
- 走 B：写出去的文件读不回来，重建完整 HTML 只能每次全量重抓，或把全文同时留一份在
  `storage.local`——那就退回了 10MB 上限问题。

**A 为主路径，B 为降级路径。** 降级路径只承诺「一次性全量导出」，不承诺增量。

### 4.3 目录选择的交互

- 面板文案：「建议在「文档」里新建一个「太空饭否备份」文件夹」。
- 调用 `showDirectoryPicker({ id: 'sf-archive', mode: 'readwrite', startIn: 'documents' })`。
  `startIn` 只影响选择器的起始位置，**扩展无法指定或预设实际路径**，文案不得暗示可以。
- 句柄存 IndexedDB（见第 9 节），`id` 让 Chrome 记住上次位置。

### 4.4 目录结构

```
太空饭否备份/
├── index.html              # 离线浏览入口与跨年搜索，由扩展生成
├── 2026.html               # 按年分卷的消息页，每年一个（见 7.1）
├── 2025.html
├── assets/
│   ├── archive.css
│   ├── archive.js          # 过滤/跳转，独立文件以便 CSP 用 script-src 'self'
│   └── search-index.js     # window.SF_INDEX，供 index.html 跨年搜索
├── meta.json               # 账号、schema 版本、同步水位、上次同步时间
├── statuses/
│   ├── 2026-07.json        # 按自然月分片的消息原文
│   └── 2026-06.json
├── favorites/
│   ├── favorites.json      # 收藏原文 + 收藏状态元数据（见 6.3）
│   └── favorites.md        # 人读版，按月分组，带回饭否的链接
├── mentions/
│   └── 2026.json
├── photos/
│   └── 2026-07/<statusId>.jpg      # 转发原文的配图为 <statusId>-repost.jpg
└── avatars/
    └── <userId>.jpg        # 按 userId 落盘，天然去重
```

按月分片：单文件不会无限增长，增量同步只需重写当月分片。

`meta.json`：

```json
{
  "schemaVersion": 1,
  "account": { "id": "...", "name": "..." },
  "lastSyncedAt": "2026-07-31T12:00:00+08:00",
  "watermark": {
    "statuses": { "newestId": "...", "oldestId": "...", "reachedFirstEver": false },
    "mentions":  { "newestId": "...", "truncated": false, "stoppedAtPage": null },
    "favorites": { "lastFullScanAt": null, "lastScanComplete": false }
  },
  "counts": { "statuses": 0, "favorites": 0, "photos": 0 },
  "photoFailures": []
}
```

`reachedFirstEver` 表示已翻到账号第一条；`truncated` 表示因 API 分页深度限制提前停止，
报告中对应指标标注为下限值。

### 4.5 实测组一：文件系统地基（阻塞项）

任一不通过则整体退到降级路径 B：

1. `showDirectoryPicker()` 能否在 `chrome-extension://` 页面（设置页）中调用，`startIn` 是否生效。
2. `FileSystemDirectoryHandle` 能否存入 IndexedDB 并跨浏览器会话取回。
   （4.5.1 已用真实本地句柄验证**同进程内页面刷新**后的取回；真正的**跨浏览器重启**归入
   第 4 条的 C3，仍未验证——不要把本条的 pass 读成重启范围也已测完。）
3. 取回后 `queryPermission({ mode: 'readwrite' })` 的返回值，以及重新 `requestPermission()`
   需要什么样的用户手势。

### 4.5.1 实测结论（2026-07-31，agent-browser `sf-fsa` + Windows Chrome `Default`）

1. **`showDirectoryPicker()` 能否在 `chrome-extension://` 独立标签页（settings.html/spike.html，非
   popup 非 iframe）调用 —— pass**
   - 扩展 id `kdfbllbkehinhdahiepgicmpbjggfohe`。`eval('typeof window.showDirectoryPicker')` 返回
     `'function'`（非 `undefined`）。
   - 无真实用户手势直接 `eval` 调用 → 抛 `SecurityError`（`Must be handling a user gesture to
     show a file picker.`），符合预期，非 bug。
   - 用 agent-browser 的 CDP 真实鼠标 `click`（可信手势）点击页面按钮后，调用未立即
     reject/AbortError；等待 20s+ 期间同一页面其它 `eval`（如 `1+1`）仍正常响应，证明未阻塞渲染
     进程，只是 Promise 长期 pending。
   - 结论：本项目独立标签页场景没有踩中 prep 阶段记录的『popup 失焦即 AbortError』问题。

2. **最终能否 resolve 出真实本地磁盘句柄并完成真实读写 —— pass；`startIn` 起始位置未单独记录**
   - `showDirectoryPicker()` 在真实点击后会打开系统原生文件夹选择对话框，不在页面 DOM/CDP
     可控渲染树内。
   - `grep -rln 'chooser\|FileChooser' agent-browser-session --include=*.md --include=*.rs`
     零命中，确认 agent-browser 未实现原生 FileChooser 拦截（Puppeteer/CDP 的
     `Page.fileChooserOpened` 只覆盖 `<input type=file>`，不覆盖 File System Access API 的原生
     目录选择器）。
   - 本机 WSLg 已损坏（既有 memory 记录，本次未重新验证但未见改善迹象），人工也无法看到/点击
     该原生窗口。
   - 等待 20+ 秒后截图（`pic/02-still-pending.png`）确认页面本身无任何原生对话框可见痕迹，
     Promise 保持 pending，无超时。
   - 后续改用原生 Windows Chrome `Default` profile，由用户完成目录选择。扩展在
     `Documents/space-fanfou-fsa-test` 创建 112-byte 探针文件；主代理从 Windows 磁盘核实其中
     build marker 为 `archive-p0-spike-2026-07-31.1`、`phase=overwritten`，nonce 与文件名一致。
   - 结论：真实本地目录句柄可取得，且当前 build 能创建并覆盖真实文件；页面是否由
     `startIn: 'documents'` 正确定位到 Documents 没有独立观察记录，不作为 P0 阻塞项。

3. **`FileSystemDirectoryHandle` 能否存入 IndexedDB 并跨会话（刷新页面）取回 —— pass（真实本地
   磁盘句柄已验证）**
   - 因无法拿到真实本地磁盘句柄（见上），改用同一 `FileSystemDirectoryHandle` 类的代理对象验证
     序列化机制本身：`navigator.storage.getDirectory()`（Origin Private File System）返回句柄的
     `constructor.name` 确认为 `'FileSystemDirectoryHandle'`，与本地磁盘句柄同一原型链。
   - `indexedDB.put(handle)` 成功（无 `DataCloneError`）；agent-browser reload 整个标签页（模拟
     关闭重开）后 `indexedDB.get()` 取回非 null 对象，`.name`/`.kind` 均可正常读取，`constructor`
     仍为 `FileSystemDirectoryHandle`。
   - 限定：这是同类代理验证，不是对『真实用户从本地磁盘选出的句柄』的直接验证——两者是否在
     结构化克隆细节上完全等价未见官方文档特别区分，Chrome 官方文档对 handle 序列化的描述本就
     不区分 OPFS/本地磁盘来源。
   - Windows Chrome 后续补测：用户刷新验收页后没有重新选择目录，通过 retrieve 操作取回句柄，
     随后在原目录生成新的 113-byte 探针文件。磁盘内容含当前 build marker、
     `phase=overwritten`，nonce 与文件名一致。真实本地句柄的刷新后取回和继续写入因此通过。

4. **`queryPermission()`/`requestPermission()` 的返回值与用户手势要求，尤其跨浏览器重启的持久化
   行为（C3）—— pass：重启后为 `prompt`，点击授权后为 `granted`**
   - 用同一 OPFS 代理句柄验证了 `queryPermission()` 的机制性结论：无需用户手势即可调用，reload
     后仍可调用不抛异常，返回 `'granted'`——但 OPFS 句柄本身就是沙盒存储，权限模型上永远隐式
     granted，这条结果**不能**作为『本地磁盘句柄跨重启是否持久化（结论 X vs 结论 Y，三选一弹窗）』
     的证据，C3 仍是完全未验证状态。
   - 完整重启 Chrome 后，真实句柄仍可取回；`queryPermission()` 返回 `prompt`，用户点击
     「请求写入权限」后 `requestPermission()` 返回 `granted`。
   - agent-browser 每次 session 用全新临时 `--user-data-dir`（`ps aux` 已确认
     `--user-data-dir=/tmp/agent-browser-chrome-<uuid>`），并非真实持久 Chrome profile，即使能
     点通原生对话框，『完全重启 Chrome』这个动作在本工具默认用法下也不构成真实的『同一 profile
     重启』，需要额外的 `--state` 持久化机制且未验证其是否覆盖 IndexedDB/FSA 权限（changelog
     只提到 cookies/localStorage）。

**小结**：API 存在性、无手势错误、真实本地目录写入、真实句柄从 IndexedDB 刷新后取回，以及
跨 Chrome 重启后的 `prompt → granted` 权限恢复均已取得 pass。重启后第三次文件 round trip
也由页面 OK 日志与 Windows 磁盘文件共同确认。产品需要在每次浏览器重启后的首次同步入口保留
真实点击授权。

---

### 4.6 实测组二：API 完整性（P0 已完成，P1/P2 校准已记录）

本功能对用户的承诺是「不丢内容」，因此文件系统能写不等于地基验完。用测试账号
（凭据在 repo `.env`）实测并把结论写回本节：

1. `user_timeline` 用 `max_id` 能否一直翻到账号第一条；`max_id` 是包含还是排除边界，
   连续翻页是否产生重复 id。
2. `favorites/id` 的 `page` 能否完整遍历到底，有无页数上限。
3. `mentions` 在第几页开始返回空或重复——确定截断点，写进 `meta.json` 的 `stoppedAtPage`。
4. 单账号消息总量与实际耗时，用于校准第 13 节的工作量与限速对策。

**任一路径无法遍历到底，就必须在产品文案里明说该项是「部分归档」，不得默认呈现为完整。**

### 4.6.1 实测结论（2026-07-31，测试账号 halmisen，agent-browser session `sf-fsa`）

官方基准（真实签名请求，`archiveProbe.probeProfile()` 调用 `users/show.json` 返回，非估算）：
`statuses_count=23281`，`favourites_count=2500`。OAuth 一键授权全自动完成，截图
`pic/04-after-login.png` 显示登录后首页「消息 23281」与该基准一致。

1. **`user_timeline`：pass（本账号）**
   - 严格串行请求 390 页，取得 23281 个唯一 ID；第 390 页为空，和资料页
     `statuses_count=23281` 完全一致。
   - `max_id` 实测为排除边界；非预期重复为 0。最新 ID 为 `cnfOIAJMLDw`，最早 ID 为
     `vRFBKv_RMJg`。
   - 390 次请求合计 1081635ms，平均 2773ms；加每页 600ms 间隔后合计约 21 分 56 秒。

2. **`favorites/id`：pass（本账号，口径有限制）**
   - 严格串行请求 43 页，取得 2471 个唯一 ID；第 42 页 40 条，第 43 页为空，重复为 0。
   - API 可枚举数比资料页 `favourites_count=2500` 少 29。证据只支持“两种口径不完全相等”，
     不支持推断缺少的具体原因；P1 界面不得把资料页计数当作可导出条数。

3. **`mentions`：pass（本账号）**
   - 严格串行请求 242 页，取得 14085 个唯一 ID；第 241 页 6 条，第 242 页为空，重复为 0。
   - 本账号未观察到 100 页等隐藏上限，但不能推广为所有账号或未来 API 的保证。

4. **总量与耗时：pass（本账号实测）**
   - `user_timeline` 计入请求和 600ms 间隔约 1316 秒；favorites 约 166.4 秒；mentions 约
     955.5 秒。三条流总计保留 675 次 API 请求，另有 1 次 `users/show`，共 676 条请求日志。
   - 结果日志没有终态请求错误；现有日志不能排除探针内部曾重试后成功的瞬时错误。

**小结**：4.6 对 P0 的承重结论已经成立：使用严格串行 `user_timeline`、排除式 `max_id`、按 ID
去重和空页终止。本结论来自测试账号 `halmisen` 的真实扩展页/API 观察，不是全平台保证；
favorites 与 mentions 结论分别作为 P1/P2 的输入，不阻塞 P0。

### 4.7 图片抓取的权限前提（2026-07-31 更正，原断言错误）

> **原文断言「`https://*.fanfou.com/` 已覆盖饭否图片域名，不需要新增 host 权限」是错的。**
> 它从站点主域推断了资源域名，没有核对真实数据。以下为按小号 1483 条归档统计的实际结果。

| 资源 | 真实域名 | 样本 |
| --- | --- | --- |
| `photo.imageurl` / `thumburl` / `largeurl` | `s3-img.meituan.net` | 26/26 顶层 + 14/14 嵌套转发 |
| `user.profile_image_url` | `s3.meituan.net` | 1483/1483 + 77/77 嵌套转发 |
| `photo.url`（饭否页面链接，不下载） | `fanfou.com` | 26/26 |

饭否图床与头像早已迁至美团 S3。且**没有绕开 host 权限的办法**：`mode: 'no-cors'` 得到的是
opaque response 读不到字节；用 `<img>` + canvas 会因跨域污染，`toBlob()` 抛 `SecurityError`。

**已执行**：`static/manifest.json` 的 `host_permissions` 新增 `https://s3-img.meituan.net/`
与 `https://s3.meituan.net/`。代价是扩展更新时用户会看到一次新的权限提示，用户已确认接受。

代码侧的白名单是 `mediaUrls.js` 的 `ALLOWED_MEDIA_HOSTS`，`mediaUrls.test.js` 有一致性断言
防止两边漂移。不在白名单的域名不会被 fetch，而是逐 host 计数写入 `meta.mediaSkipped` 并在
面板显示出来——小号 40 张图的样本不足以证明大号 23281 条里没有其它历史图床，让未知域名
当场可见比静默失败好。

`permissions` 中**没有** `downloads`。主路径 A 不需要加；只有启用降级路径 B 才需要补。

### 4.8 需要用户亲手完成的步骤

第 4.5/4.6 节的部分断言在 agent-browser + WSLg 损坏的当前环境下**结构性无法验证**，或纯粹因为
API 探针已经跑完。以下只剩系统原生 UI 必须由用户亲手介入。

**A. 补测 4.5 节需要真实鼠标操作的部分**（在 WSLg 正常，或原生 Windows/Linux 桌面 Chrome 里，
加载已 build 的 `dist`）：

1. Windows Chrome `Default` profile 当前加载的扩展 ID 为
   `ldmngjbcgbbgblhkamaiekehpcjpolpa`，路径为本仓库 `dist`。用地址栏打开
   `chrome-extension://ldmngjbcgbbgblhkamaiekehpcjpolpa/spike.html`，确认日志里的 build marker
   是 `archive-p0-spike-2026-07-31.1`。
2. 首次「选择备份文件夹」→「保存文件夹授权」→「测试创建、读取和覆盖」已经完成；磁盘最终覆盖
   内容已核对。
3. 刷新页面后的句柄取回与再次写入已经完成；第二个探针文件已从 Windows 磁盘核对。
4. 真实重启 Chrome（不是刷新标签页）后再次执行「恢复已保存文件夹」→「检查写入权限」。若显示
   需要确认，点「请求写入权限」后再执行「测试创建、读取和覆盖」；「已允许」与
   「需要确认 → 已允许」都是 P0 可接受分支。

**B. 临时改动清理 —— 已完成**

`spike` 构建入口与三个临时文件均已清理，生产构建后的 `dist` 不再包含验收页或 API 探针。
Windows 测试目录内三个探针文本保留为人工验收证据，不属于扩展发行内容。

---

## 5. 模块结构

```
src/features/personal-archive/
├── statusRecords.js             # P0：保留原始 API 对象、归档字段、ID 合并和自然月分组
├── checkpoint.js                # P0：首次回填、增量同步与页级水位状态机
├── sync.js                      # P0：严格串行分页、暂停和断点续传
├── fsStore.js                   # P0：月分片先提交，meta.json 最后提交
├── directoryHandleRepository.js # P0：用 IndexedDB 保存目录句柄
├── directoryPermissions.js      # P0：query/request readwrite 权限边界
├── fanfouClient.js              # P0：复用现有 OAuth 消息桥
└── panel/                       # P0：最小设置页面板（Preact）
```

### 5.1 旧分支的处理：选择性移植，不整分支 rebase

`feature/personal-archive` 相对 `2026.8` **落后 6 个提交、领先 1 个提交**，且携带一个
410 行的旧设置面板 `src/settings/components/PersonalArchivePanel.js`——它是按旧的
`storage.local` 全量存储模型写的，与本 spec 的落盘模型不兼容。

**已执行做法：没有 cherry-pick 旧提交；只复用了“保留完整原始对象、按 ID 幂等合并”的语义，
代码按当前落盘模型重写。旧面板、全局 archive 对象、下载逻辑和 action types 均未移植。**

| 导出 | 处理 |
| --- | --- |
| `normalizeStatus` | 直接用 |
| `createArchive` / `mergeStatuses` | 直接用 |
| `getStatusList` | 直接用 |
| `getPhotoUrlsFromStatuses` | 直接用 |
| `buildFavoritesMarkdown` | 直接用 |
| `buildExportPayload` | 直接用 |
| `EMPTY_ARCHIVE` | 直接用 |
| `computeTopKeywords` | 需改：`pastYearOnly` 参数改为按自然年过滤 |
| `computePastYearStats` | **需改写**：现实现是 `setDate(getDate() - 365)` 滚动 365 天，与决策 6 冲突；改为接受 `year` 参数按自然年分桶 |
| `computeTopInteractions` | **需重新确认**：现实现用加权分（回复 3 / 转发 2 / 提及 2 / 被回复 3），且读取 `getStatusList(archive, 'replies')` 这一路数据，而本 spec 的同步管线不抓 replies。要么补抓，要么去掉该信号并重算权重——报告里的「互动榜」口径必须在实现前定死 |

---

## 6. 同步管线

### 6.1 流程与分期

1. **前置**：未授权则先走 `fanfou-oauth` 一键授权；未选备份文件夹则先弹目录选择。
2. **P0 只抓 `user_timeline`**。favorites 属 P1；mentions、replies 与年度报告属 P2，不能扩大
   当前同步范围。
3. **翻页**：`max_id` 向历史翻，直到返回空页或触及上次水位；串行请求 + 每次间隔 500ms。
4. **进度**：面板显示「已同步 N 条 · 正在获取 YYYY-MM」，可中断。
5. **落盘时机**：每个 API 页先幂等合并并关闭受影响的自然月分片，再最后写 `meta.json`。
   不声明跨文件原子性；若 meta 写失败，旧水位保留，重试靠 ID 去重恢复。
6. **P0 收尾**：空页确认到底后清除 active run 并记录 `lastSyncedAt`。离线 HTML 与
   `favorites.md` 在 P1 实现。

### 6.2 图片

默认开启。理由：关掉之后「完整备份」默认产出的是不完整结果，与功能承诺矛盾。

- 同步开始前显示预估：「约 N 张图片，预计占用 X MB」，用户可在此明确关闭。
- 消息落盘后按 `getPhotoUrlsFromStatuses` 逐张 `fetch` → 写入 `photos/YYYY-MM/`；
  同名文件已存在则跳过。
- 单张失败只记入 `meta.json` 的 `photoFailures`，不中断主流程，面板提供「重试失败项」。

### 6.3 收藏语义：取消收藏必须能识别

收藏会被用户取消，纯增量追加会让归档里永远留着已取消的项且无法区分。

`favorites.json` 每条附带：

```json
{
  "firstSeenAt": "2026-07-31T...",
  "lastSeenAt":  "2026-07-31T...",
  "presentInLatestFullSync": true,
  "unfavoritedAt": null
}
```

规则：

- **归档只增不删**——曾经收藏过的内容永久保留，这是备份功能的本分。
- 只有在**一次完整的收藏扫描成功结束后**（`lastScanComplete: true`），才把本次未出现的条目
  标为 `presentInLatestFullSync: false` 并写入 `unfavoritedAt`。
- 扫描中断、报错或提前截断时**不做任何标记**，避免把中断误判成取消收藏。
- `favorites.md` 与 `index.html` 默认只列当前仍收藏的条目，已取消的折叠在「曾经收藏过」区块。

### 6.4 限速

500ms 节流 + 断点续传。一万条约 167 次请求，实际配额与耗时以第 4.6 节实测为准。

---

## 7. 离线 HTML（`index.html`）

### 7.1 基本要求

- **单文件夹、零依赖、不联网**：样式与脚本走同目录 `assets/`，无 CDN、无外链字体。
- **图片走相对路径**引用 `photos/`，不做 base64 内嵌——整个文件夹可整体拷贝到 U 盘或另一台
  电脑，双击即可离线浏览。
- 内容：账号信息 + 归档区间 + 按月分组的消息全文 + 收藏区 + 年度统计摘要。
- 顶部提供纯前端的关键词过滤与年份跳转（原生 JS，不引框架）。
- 页脚固定说明「由太空饭否在你的浏览器本地生成，数据不上传任何服务器」。

### 7.2 安全：归档内容不得变成脚本（硬性）

归档正文来自饭否上的任意用户内容，直接拼进 HTML 就是一个存储型 XSS，且落在用户本地文件里。

- `buildHtml.js` 对**所有**来自 API 的字段（正文、用户名、链接、图片路径）强制转义，
  只走文本节点或转义后拼接，不存在任何未转义插值路径。
- 生成的 HTML 头部写死：
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; style-src 'self'; script-src 'self'">`
  ——既挡住注入脚本，也保证这个文件永远不会向外发起任何请求。
- 单测必须包含 XSS 载荷 fixture（`<script>`、`onerror=`、`javascript:` 链接、
  带引号闭合的用户名），断言输出中不含可执行形式。

#### 7.2.1 实测结论：该 CSP 在 `file://` 下不阻断离线浏览（2026-07-31）

事前存在一个可能推翻整个方案的疑虑：`file://` 的 origin 在 Chrome 中序列化为 `null`，
`'self'` 可能匹配不上任何同目录资源，导致双击打开时 CSS/JS/图片被自己的 CSP 全部拦掉。

**已实测否定该疑虑。** 冒烟目录 `C:\Users\fiver\Documents\space-fanfou-csp-smoke`
复刻了本节的 CSP 与 7.1 的相对路径结构（`assets/archive.css`、`assets/archive.js`、
`photos/2012-08/sample.png`），由用户在 Windows Chrome 中以 `file://` 双击打开：

| 探针 | 指令 | 结果 |
| --- | --- | --- |
| 外部 CSS 相对路径 | `style-src 'self'` | 通过 |
| 外部 JS 相对路径 | `script-src 'self'` | 通过 |
| 相对路径图片 `photos/...` | `img-src 'self'` | 通过 |
| `data:` URI 图片 | `img-src data:` | 通过 |

结论：7.2 的 CSP 字符串**原样保留**，不需要为离线浏览放宽。7.1 的光盘式文件夹方案
（图片独立成文件 + 相对路径引用）在 `file://` 下成立。

### 7.3 规模：总是按年分卷，实测只用于记录体积

**决定改为无条件按年分卷**，不再设「超过阈值才切分」的判断。两万条以上的单页在任何阈值下
都不成立，分卷是唯一稳定形态；去掉阈值分支也让 `buildHtml.js` 少一条状态。

- `index.html`：账号概览 + 逐年条数 + 跨年搜索
- `YYYY.html`：该年全部消息，按自然月分组、时间倒序

跨年搜索的索引走 `assets/search-index.js`（`window.SF_INDEX`，只含 id/年月/正文），
用 `<script src>` 加载。**不能用 `fetch`**：CSP 是 `default-src 'none'` 未开 `connect-src`，
且 `file://` 下 fetch 本地文件会被 CORS 挡；`script-src 'self'` 这条路已由 7.2.1 实测验证。

实测仍要做，但目的从「定阈值」变成「记录真实体积与响应延迟」，数字回填此处。

---

## 8. 年度报告如何复用这套数据

年度报告不再单独同步，改为「读备份 → 算统计 → 渲染报告页」：

- 数据来源：`statuses/*.json` + `mentions/*.json` + `favorites/favorites.json`
- 口径：**自然年**，默认当前年，可切换到有数据的往年
- 统计逻辑：第 5.1 节移植与改写后的纯函数
- 报告页：沿用 `spec-annual-report.md` 的独立扩展页面方案（新 webpack entry +
  `static/annual-report.html`），版式、区块顺序、页脚声明照其设计
- **重新生成报告不需要重抓数据**，因为原文在磁盘上

---

## 9. 扩展内存储（与磁盘的分工）

| 数据 | 位置 | 理由 |
| --- | --- | --- |
| `FileSystemDirectoryHandle` | **IndexedDB** | 句柄是结构化克隆对象，`chrome.storage` 走 JSON 序列化，**存不了** |
| 同步水位副本、统计结果缓存、面板 UI 状态 | `chrome.storage.local` | 普通可序列化数据，几十 KB |
| 消息原文、图片、收藏 | 用户磁盘 | 见第 1 节决策 1 |

---

## 10. 隐私与数据管理

- 所有数据只在用户浏览器与用户自选的本地文件夹之间流动，无第三方请求。
- 同步全程只访问 `api.fanfou.com` 与 `*.fanfou.com`（图片），验收时用 DevTools Network 核实。
- 备份文件夹里**不写入** OAuth token、cookie、签名或任何凭据材料。
- 设置面板提供：更换备份文件夹、查看上次同步时间、清除扩展内缓存（不删磁盘上的备份）。
- 磁盘上的备份文件夹归用户所有，扩展不提供「删除备份」按钮。

---

## 11. 风险与对策

| 风险 | 对策 |
| --- | --- |
| File System Access 在扩展页面不可用 | 第 4.5 节先行实测；不通过则退降级路径 B，功能降为一次性全量导出 |
| 目录句柄权限每会话需重新授予 | 把重授权做成同步流程的第一步（「点击继续备份」），不做成错误态 |
| API 无法遍历到底 | 第 4.6 节实测确定边界；无法到底的项在界面与报告中明说是「部分归档」 |
| 归档内容注入脚本 | 强制转义 + 离线 CSP + XSS fixture 单测（第 7.2 节） |
| 取消收藏被误判 | 仅在完整扫描成功后标记，中断不标记（第 6.3 节） |
| 大归档打开卡顿 | 合成数据实测 + 超阈值按年切分（第 7.3 节） |
| 图片批量下载耗时长 | 独立阶段，失败不中断，失败清单可重试 |
| 用户中途换文件夹导致两份不完整备份 | `meta.json` 带账号 ID，选到不匹配的文件夹时提示并要求确认 |
| `page.js` 体积上限 | 归档逻辑全在设置页与独立 entry，不进 `page.js`。（`tasks/STATUS.md` 2026-07-13 记录为 842KB / 上限 848KB，实现前重新测量） |

---

## 12. 已排除：备份文件夹内的 Python 脚本

第一版曾计划放一个 `bundle.py`，把归档压成单个 base64 内嵌的 HTML 便于整份转发。**取消。**

- 备份文件夹本身已经可整体拷贝、可 zip，「便携」这个目标已经达成。
- 往用户的备份目录里放可执行脚本，需要额外解释「这是什么、为什么安全、要不要跨平台支持」，
  与「不在备份文件夹里放任何可执行内容」的原则冲突。
- 超大单文件 HTML 本身就是个会卡死浏览器的产物，价值可疑。

---

## 13. 分期

**P0 — 能备份**：目录选择与句柄持久化、消息同步与分片落盘、`meta.json` 水位与断点续传、设置页面板。

**P1 — 能看**：`index.html` 生成（含转义与 CSP）、收藏同步与状态标记、`favorites.md`、图片下载。

**P2 — 能回顾**：年度报告页（独立 entry）、按自然年的统计改写、关键词榜与互动榜、被 @ 统计。

**P3 — 兜底**：降级路径 B、多账号。

工作量：4.6 已确认 P0 API 路径；4.5 剩余真实目录和重启测试只可能调整授权交互，不再推翻
P0 存储与同步架构。

---

## 14. Sprint Contract（验收标准）

**地基**

- [x] 第 4.5 节三项文件系统实测有结论并写回文档（见 4.5.1）
  - [x] `showDirectoryPicker()` 核心断言（API 存在性 + 无手势报错行为）：pass
  - [x] 真实本地磁盘句柄与首次文件创建/覆盖：Windows Chrome `Default` 已通过；`startIn`
    起始位置未单独记录且不阻塞 P0
  - [x] `FileSystemDirectoryHandle` 存入 IndexedDB 并跨页面刷新取回：OPFS 代理与真实本地磁盘
    句柄均已通过，见 4.5.1 第 3 条
  - [x] `queryPermission()`/`requestPermission()` 真实手势行为 + 跨浏览器重启持久化（C3）：
    句柄保留，权限为 `prompt`，真实点击后转为 `granted`
- [x] 第 4.6 节四项 API 完整性实测有结论并写回文档（见 4.6.1）
  - [x] `user_timeline` 390 页翻到底；23281 个唯一 ID；`max_id` 排除边界；重复为 0
  - [x] `favorites/id` 43 页翻到底；2471 个唯一 ID；资料计数差 29 已保留口径说明
  - [x] `mentions` 第 242 页为空；14085 个唯一 ID；重复为 0
  - [x] 全量消息同步计入请求与间隔约 1316 秒（约 21 分 56 秒）

**代码**

- [x] 当前 P0 范围 `npm test`、`npm run build` 通过（20 suites / 48 tests）
- [ ] `sync.js` / `fsStore.js` / `buildHtml.js` 均有单测
- [ ] `buildHtml.js` 的 XSS fixture 单测通过（`<script>` / `onerror=` / `javascript:` / 引号闭合用户名）
- [ ] 从旧分支移植的纯函数带原测试通过；`computePastYearStats` 按自然年重写并有新测试
- [ ] 互动榜口径已定死并有测试（是否含 replies 信号、各信号权重）

**实测**

- [ ] 测试账号完成一次全量同步，进度条推进；中途关闭标签页后能从水位续传
- [ ] 磁盘上生成第 4.4 节的完整目录结构，`meta.json` 字段齐全
- [ ] 再次同步走增量（只新增分片、不重抓已有月份），`index.html` 内容完整更新
- [ ] 取消一条收藏后重新完整同步，该条被标 `presentInLatestFullSync: false` 且仍保留在归档中
- [ ] 中断一次收藏扫描，确认**没有**任何条目被误标为已取消
- [ ] 断网后双击 `index.html` 能正常浏览，图片正常显示
- [ ] 1 万条与 3 万条合成数据下的打开耗时与搜索响应已测量并记录
- [ ] `favorites.md` 丢进笔记软件排版正常，链接可点回饭否

**核实**

- [ ] 同步全程 DevTools Network 无 `api.fanfou.com` / `*.fanfou.com` 以外请求
- [ ] 离线 HTML 打开时 Network 面板零请求（CSP 生效）
- [ ] 备份文件夹内无 token、cookie、签名等凭据材料，也无任何可执行脚本
- [ ] 截图存证 `pic/`（面板同步中、磁盘目录、离线 HTML）

---

## 15. 待议方向（用户 2026-07-31 提出，未排期）

以下三条来自 P0 小号验收后的讨论。记录动机与已知约束，不进入当前 Sprint Contract。

### 15.1 在饭否页面内提供备份入口（建议做，P1 之后）

**动机**：设置页藏得深，用户在饭否首页时想不起来这个功能存在。

**结论：入口可以搬，执行不能搬。**

可做的部分——content script 在侧栏（可复用 `unify-sidebar-panels` 的面板位）注入一个
「备份我的饭否」链接，点击后 `chrome.runtime.sendMessage` 让 background 打开设置页并直接
定位到「个人归档」区块。纯加法，不碰同步管线。需要给设置页加一个 hash 路由
（参考 `App.js` 现有的 `#version-history` 处理）。

不做的部分——在饭否页面内直接执行同步。三条理由，按强度排序：

1. **导航即中断**：饭否首页点任何链接都会重载页面，而全量同步是 20 分钟级长任务
   （4.6.1 实测 1316 秒）。设置页是独立标签页，不会被误关。
2. **句柄绑 origin**（推断，未实测）：在 `fanfou.com` 调 `showDirectoryPicker()`，句柄落在
   `fanfou.com` 的 IndexedDB，与设置页 `chrome-extension://` origin 那份不互通，等于两套
   独立授权。即使此推断有误，第 1 条已足以否定。
3. 归档能力会写用户磁盘，没有理由把它挪到与第三方页面脚本相邻的执行环境。

### 15.2 单文件离线 HTML（优先级最低，7.1 已满足真实诉求）

**动机已澄清（2026-07-31 追加）**：用户的参照物是早年 ISO 光盘里的 HTML 相册——图片作为
独立文件躺在文件夹里，HTML 相对路径引用，双击即可像联网一样浏览。**这正是 7.1 的主路径，
不是 base64 单文件。** 本节保留的 base64 方案仅作为「分享一个文件」场景的可选导出，
不进 P1，也不作为浏览入口。

下方规模分析仍然有效，用于说明为什么 base64 不能当主路径。

**7.1 的「图片走相对路径、不做 base64 内嵌」决定不变。** 规模估算（非实测）：

| | 小号实测 | 大号推算 |
| --- | --- | --- |
| 消息数 | 1483 | 23281 |
| 正文 JSON | 3.0 MB | ~47 MB |
| 带图比例 | 1.8%（26 条） | 未知，按同比例约 410 张 |
| 图片原始体积 | — | ~60 MB（按 150 KB/张） |
| base64 后 | — | ~80 MB |
| **单文件合计** | — | **~127 MB** |

两条决定性缺陷：

- base64 内嵌的图片**无法懒加载**，首屏必须先把整份文档解析进 DOM；相对路径引用则由浏览器
  按滚动位置按需读盘。
- 增量同步后要重写整份文件——多同步 3 条消息也要重写 127 MB，与 4.2 节「增量成立」的
  前提冲突。

**折中方案**：主路径保持 7.1 的文件夹结构；额外提供「导出单文件」按钮，按自然年切分
（`2012.html`），图片降级为内嵌缩略图，原图仍留在 `photos/`。定位为分享与存档，不是
日常浏览入口。切分阈值与缩略图尺寸按 7.3 的合成数据实测确定。

### 15.3 本地全文搜索（建议提升优先级）

**动机**：饭否官方搜索翻不动老内容，而备份完成后磁盘上就是全量原文。

7.1 目前只规划了「关键词过滤与年份跳转」。考虑扩展为：关键词 + 年份区间 + 有图/无图
组合筛选，结果按时间排序并可跳转回饭否原文链接。增量成本主要在 `assets/archive.js`，
仍受 7.2 的 CSP 与转义约束（`script-src 'self'`，不得引入任何外部检索库）。

规模风险与 7.3 共用同一次合成数据实测：3 万条时的过滤响应延迟是这条能否留在单页内的
判据；超阈值则退回按年切分后各自搜索。
