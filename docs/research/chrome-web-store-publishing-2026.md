---
executor: Codex (chrome_publish_research)
run_id: sf-distribution-20260717-01
timestamp: 2026-07-17T15:56:37+08:00
checkpoint: research-complete
---

# Chrome Web Store 自主发布与自动化边界（截至 2026-07-17）

## 先说结论

第一次发布不能合理地做成“一条 CLI 命令全自动完成”。Chrome Web Store API v2 适合在商店条目已经建立、网页资料已经填好之后，自动上传新版、提交审核、查询状态、取消提交和调整灰度比例；它不支持创建新条目，也不支持修改商店可见性。商店介绍、截图、隐私声明等资料仍须在开发者后台填写。

对非程序员最现实的办法是：**第一次由浏览器 Agent 帮忙导航和填草稿，但登录、两步验证、付款、法律声明、隐私声明确认以及最终提交由本人操作；首次发布成功后，只有确实需要频繁更新时才配置 API。**

## 1. 注册账号和费用：哪些必须本人完成

官方注册流程要求：

1. 使用一个长期可访问的 Google 账号进入开发者后台。账号创建后，开发者账号的邮箱不能直接更换；Google 建议使用专门用于发布的邮箱。
2. 阅读并同意开发者协议和政策。
3. 支付一次性注册费。
4. 设置发布者名称，并验证联系邮箱。
5. 在发布或更新扩展前，为 Google 账号启用两步验证。
6. 所有开发者都需要声明自己属于 Trader（经营者）还是 Non-Trader（非经营者）。若属于 Trader，还涉及法定姓名、电话、地址等验证与公开展示。

关于费用，官方公开文档只写“一次性注册费”；开发者协议进一步说明金额由 Google 决定。**公开官方页面没有写死当前具体金额，因此本研究不能把“5 美元”确认为 2026-07-17 的当前价格。实际金额只能以本人进入注册付款页面时显示的金额为准。**

来源：

- 注册流程与一次性费用：https://developer.chrome.com/docs/webstore/register
- 开发者协议中的费用表述：https://developer.chrome.com/docs/webstore/program-policies/terms
- 发布者名称和邮箱验证：https://developer.chrome.com/docs/webstore/set-up-account/
- 两步验证要求：https://developer.chrome.com/docs/webstore/program-policies/two-step-verification
- Trader / Non-Trader 声明：https://developer.chrome.com/docs/webstore/program-policies/trader-verification-faq

## 2. 第一次发布能否通过 CLI 或 API 完成

### Chrome Web Store API v2 能做什么

对一个**已经存在的商店条目**，API v2 可以：

- 上传新版本压缩包；
- 提交审核并选择“审核通过后立即发布”或“审核通过后暂存”；
- 查询已发布版本、待审版本、上传状态、警告或下架状态；
- 取消正在审核的提交；
- 对符合条件的扩展提高灰度发布比例。

API 的 `publish` 操作本身就是提交审核/发布动作，并非单纯保存草稿。`skipReview` 也只会在扩展符合免审条件时生效，不代表可以绕过审核。

来源：

- API v2 使用指南和 curl 示例：https://developer.chrome.com/docs/webstore/using-api
- API v2 方法总表：https://developer.chrome.com/docs/webstore/api/reference/rest
- 提交与发布参数：https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/publish
- 查询状态：https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/fetchStatus

### API v2 明确不能做什么

- 不能创建新的商店条目；第一次仍要在开发者后台点击“Add new item”并上传 ZIP。
- 不能通过 API 修改条目可见性。
- API v2 没有用于编辑商店介绍、截图、宣传图、分类、隐私声明或权限理由的接口。
- 新条目发布前，必须在开发者后台填完 Store listing 和 Privacy 页面。
- 如果在后台改变了可见性，至少需要按新可见性手动发布一次，之后才能继续用 API 发布。

Google 在 API v2 发布说明中明确写明“不支持创建新条目”和“不再支持通过 API 改变可见性”。API v2 的完整方法表也只有上传、状态、发布、取消提交和灰度比例，没有商店元数据接口。

来源：

- API v2 的新增能力与限制：https://developer.chrome.com/blog/cws-api-v2
- 第一次上传的后台流程：https://developer.chrome.com/docs/webstore/publish/
- 商店介绍和图片字段：https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- 隐私与权限声明字段：https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- 可见性与地区设置：https://developer.chrome.com/docs/webstore/cws-dashboard-distribution

### 旧 API v1 的例外，不值得为新项目采用

截至本研究日期，旧 API v1 仍有 `insert` 接口，可以创建条目，但它已弃用，并将在 **2026-10-15** 停止支持；即使通过它创建条目，商店资料仍要回到开发者后台填写。对一个准备长期维护的新项目，依赖即将退役的 v1 只会制造额外迁移工作，因此不建议采用。

来源：https://developer.chrome.com/docs/webstore/api/v1

## 3. 有没有官方 CLI

官方资料没有提供一个专门的“Chrome Web Store 发布 CLI”。官方提供的是 REST API，并用 `curl` 展示调用方式；还提供 API Explorer、OAuth Playground、Google API 客户端库以及服务账号支持。

`gcloud` 可以帮助服务账号生成短期访问令牌，但它不是一个能够替你创建商店条目、填写隐私表单并完成首次发布的 CWS CLI。配置 API 还需要 Google Cloud 项目、启用 API、OAuth 客户端或服务账号、访问令牌和发布者 ID。对只维护一个扩展、且不经常发布的非程序员而言，这套配置通常比手动更新更复杂。

来源：

- API 初始化与 curl：https://developer.chrome.com/docs/webstore/using-api
- 服务账号和 gcloud 获取令牌：https://developer.chrome.com/docs/webstore/service-accounts
- API Discovery Document 与方法列表：https://developer.chrome.com/docs/webstore/api/reference/rest

## 4. 浏览器 Agent 能帮到哪里

以下是依据官方流程作出的**操作建议（推断，不是 Google 对 Agent 的正式承诺）**：

### 适合交给浏览器 Agent 辅助

- 打开正确页面并解释每一栏的意思；
- 根据事先准备好的材料填写发布者名称、扩展介绍、分类、支持网址和权限理由草稿；
- 上传已经检查过的 ZIP、图标和截图；
- 检查遗漏项、记录页面报错、保存提交前截图；
- 后续查看审核状态或协助更新非敏感资料。

### 应由本人亲自完成

- Google 账号登录、验证码、两步验证或通行密钥；
- 输入付款信息并确认付款；
- 接受开发者协议；
- Trader / Non-Trader 的法律身份判断和声明；
- 确认隐私与数据使用声明真实反映扩展行为；
- 最终点击“Submit for Review”或调用会触发提交/发布的 API。

原因不是浏览器 Agent 一定无法点击，而是这些步骤涉及账户控制、付款、法律承诺、隐私事实和不可立即撤销的外部状态。更安全的流程是让 Agent 停在最终确认页，由本人核对后执行。

## 5. 官方支持的其他扩展分发方式

Google 官方把面向普通用户的扩展分发限定为两类：

1. Chrome Web Store；
2. 由组织管理员通过企业策略管理的自托管分发。

“加载已解压的扩展”适合个人开发和加载可信代码，但官方不把它视为普通用户的正式分发渠道。Windows 和 macOS 上的自托管扩展需要企业策略；Linux 还允许手动安装未由商店签名的打包扩展。

来源：https://developer.chrome.com/docs/extensions/how-to/distribute

用户脚本则是另一条产品路线：它依赖用户脚本管理器，不属于 Chrome 官方的扩展分发机制。因此它可以绕开 CWS 开发者注册，但不能等同于把完整扩展“免费发布到 Chrome”。

## 6. 面向当前项目的实际工作流

### 路线 A：自行发布 Chrome 扩展

第一次：

1. 由开发工作准备好 ZIP、图标、截图、商店介绍、权限说明和隐私说明。
2. 本人注册开发者账号、查看实际费用并决定是否付款。
3. 浏览器 Agent 协助填写后台，所有敏感和法律步骤由本人操作。
4. 先以 Unlisted 或 Private 方式完成测试；这两种方式仍然需要同样的政策审核。
5. 本人确认后提交审核。

后续：

- 如果一年只更新几次，继续通过后台上传最省事。
- 如果更新频繁，再配置 API v2，通过脚本完成“打包后上传、查询状态、提交审核”；商店文案和隐私资料仍在后台维护。

### 路线 B：发布用户脚本

这条路线不需要 Chrome Web Store 开发者注册费，但用户必须先安装脚本管理器。它适合 CSS 换肤和页面 DOM 增强，不应假定能完整替代扩展的后台任务、通知、右键菜单、身份能力等功能。

## 最终判断

对于当前实际情况，不建议先搭建 CLI/API 流水线。正确顺序是：先准备两条路线所需的成品和说明；若选择商店路线，第一次使用“浏览器 Agent 辅助 + 本人关键确认”的方式完成；只有首次发布已经成功且后续更新频繁时，再把上传和提交部分做成 API 自动化。
