# 待修复 Bug：PopupBox 上传按钮左对齐失败

## 背景说明

在 `src/features/status-form-enhancements/` 中，`ajax-form@page.js` 的 `injectUploadButton(form)` 方法向详细对话弹出的回复框 `#PopupBox` 动态注入了一个照片上传按钮 (`.sf-popup-upload-wrapper`)。
注入点位置：`sendButton.before(uploadWrapper)`

用户的期望是：**这个上传图标必须出现在输入框下方状态栏的“最左侧”，正如首页 `#phupdate` 中的布局一样**。

## 已尝试方案及失败现象

在分支 `feat/beautify-plan` 过去的几次尝试中，均未能在实际运行的 DOM 中达到最左边缘对齐的效果（图标总是卡在中间偏右或发送按钮附近，见最新截图）：

1. **绝对定位法** (`position: absolute; left: 18px; bottom: 16px;`)
   未能生效，怀疑 `#PopupBox` 内的 `.act` 等父容器或表格布局强制阻断了定位上下文。
2. **浮动法** (`float: left;`)
   在原生的表格/内联混排结构下未生效。
3. **Flexbox 劫持** (`display: flex; margin-right: auto;`)
   将 `#PopupBox .act` 修改为 Flex 容器，试图用 margin 霸占剩余空间将按钮挤到左边，但这可能打破了原生 `.act` (可能是 `display: table-cell` 或其他遗留布局) 的内含约束，导致图标依然徘徊在发送按钮边上。

## 移交要求与线索

**给 Codex 的核心任务：调查并彻底解决这个对齐难题，将透明相机图标放置到 PopupBox 最左下角。**

需要您深入饭否真实的 DOM 结构去审查 `#PopupBox .act`：
- 当前 `src/features/status-form-enhancements/misc@page.less` 中保留了我最后尝试的 Flexbox 代码。您可以保留或完全推翻重写。
- 请检查原生 `#PopupBox` 生成的完整包裹链，确认除了 `.act` 外是否还有隐形的 `table`, `form-bottom`, 或其他限制元素。
- 若纯 CSS 实在无法冲破限制，您可以考虑回到 `ajax-form@page.js`，修改 DOM 插入锚点（不要粗暴地 `sendButton.before`，可以尝试插入到离左侧约束更近的地方，或脱离当前的按钮群容器）。

注：
必须保留 `ajax-form@page.js` 的上传逻辑，且 `misc@page.less` 中剥离原来丑陋边框的代码不能丢（必须保持纯透明小相机的精致感）。
