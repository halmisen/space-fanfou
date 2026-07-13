# Spec: 一键撤回刚发的消息（undo-status）

Updated: 2026-07-12
Executor: claude
Status: spec 已确认需求（撤回窗口 30 秒），待排期实现
灵感来源: [fanfoujs/nofan](https://github.com/fanfoujs/nofan) 的 `nofan undo` 命令

## 背景与目标

发错消息（手滑、错别字、发错账号）后，现在需要：找到那条消息 → 悬停出删除键 → 点击 → 确认。
目标：发送成功后 30 秒内，页面上有一个「撤回」按钮，点一下即删除刚发的那条消息。

## 非目标

- 不做「撤回并重新编辑」（P2 可以考虑：撤回后把原文填回输入框）
- 不做任意历史消息的快捷删除（batch-remove-statuses 已覆盖批量场景）
- 不做私信撤回

## 已验证的技术前提

1. **发送链路**：`status-form-enhancements/ajax-form@page.js` 拦截表单提交走 AJAX，
   成功后 `triggerSuccessEvent()` 在表单 textarea 上派发 `POST_STATUS_SUCCESS_EVENT_TYPE`
   CustomEvent（detail 含 `formDataJson`，注意**当前不冒泡**）。
2. **新消息回流**：发送成功后 `src/page/modules/checkMyNewStatus.js` 会轮询 `/hc?since_id=`
   并调用 `FF.app.Timeline.checkNew()`，几秒内刚发的消息就会出现在 `#stream` 时间线里——
   它的 `li > .op > .delete` 链接自带删除所需的一切。
3. **删除链路**（照搬 `batch-remove-statuses/@page.js` 的 `removeStatus()`，cookie 会话，无需 OAuth）：
   - 从 `.op .delete` 的 `href` 解析出 `[id, actionType]`（普通消息 `msg.del`，图片消息 `photo.del`）
   - POST 当前页 URL，form 数据 `{ ajax: 'yes', action: actionType, [msg|photo]: id, token: button.getAttribute('token') }`
   - 成功后 `FF.util.yFadeRemove(button, 'li')` 移除 DOM
4. **通知组件限制**：`src/content/modules/notification.js` 只支持纯文本、固定 3.5s，
   不支持按钮 → 撤回 toast 需自建。

## 技术方案

新建 `src/features/undo-status/`：

```
undo-status/
├── metadata.js          # 主开关，默认开
├── @page.js             # 监听发送成功 → 渲染 toast → 撤回执行
└── @page.less           # toast 样式
```

### 事件接入（需要对 ajax-form 做一行改动）

`triggerSuccessEvent()` 的 CustomEvent 加 `bubbles: true`，undo-status 在 `document`
上监听即可覆盖所有表单来源（主输入框、浮动输入框、PopupBox），不必逐个表单注册。
回归注意：`replay-and-repost@page.js` 直接在 textarea 上监听同一事件，冒泡不影响它。

### 撤回 toast

- 自建 `#sf-undo-toast`，`position: fixed` 右下角，不复用通用 notification（避免影响其他功能）
- 内容：`消息已发送 · [撤回 (30s)]`，倒计时每秒刷新
- 生命周期：30 秒后淡出自毁；再次发送新消息时旧 toast 立即被替换（只保留最后一条的撤回入口）；
  页面导航自然销毁
- 点击「撤回」后按钮进入 loading 态，防重复点击

### 撤回执行（点击时）

1. **定位目标**：在 `#stream > ol > li` 中从上往下找第一条「自己的消息」
   （`a.author` 的 href === `getLoggedInUserProfilePageUrl()`；个人页时间线无 .author 则取第一条）
2. **安全校验**：目标 li 的 `.content` 纯文本与 `formDataJson.content` 做前缀比对
   （饭否会转换 @ 链接/短链，比对前先 strip；不匹配则走兜底，绝不误删）
3. **兜底**：时间线里找不到（发送后立即翻页/在非时间线页发送/checkNew 未回流）→
   `wretch` 拉取自己个人页 HTML，解析第一条 li 的 delete 链接 + token，同样做文本校验
4. **删除**：按上文删除链路 POST；成功 → toast 变「已撤回」并淡出、时间线 li 淡出移除；
   失败（如已被手动删除/token 失效）→ 显示错误信息，不崩、不重试删除

### 边界情况

| 场景 | 行为 |
| --- | --- |
| 带图消息 | delete href 是 `photo.del`，字段名用 `photo`，链路同样覆盖 |
| 回复/转发 | 本质是普通消息，`msg.del` 正常撤回 |
| 30 秒内连发两条 | toast 被替换，只有最后一条可一键撤回（明确取舍，不做队列） |
| 另一设备同时发消息 | 文本校验不匹配 → 拒绝删除并提示「未找到刚发送的消息」 |
| 主开关关闭 | 完全不渲染 toast，发送流程与现状一致 |

## metadata 选项

```javascript
export const options = {
  _: {
    defaultValue: true,
    label: '发送消息后 30 秒内可一键撤回',
    disableCloudSyncing: true,
  },
}
```

撤回窗口时长 30s 作为常量写死（用户已确认）；后续有需求再升级为子选项。

## Sprint Contract（验收标准）

- [ ] `npm test`、`npm run build` 通过；新增文本校验/删除参数解析的纯函数单测
- [ ] 实测：发送文字消息 → 点撤回 → 时间线该消息消失，刷新后个人页确认已删除
- [ ] 实测：发送带图消息 → 撤回同样成功（photo.del 链路）
- [ ] 实测：30 秒倒计时结束 toast 自动消失；期间再发一条，toast 指向新消息
- [ ] 实测：先手动删除该消息再点撤回 → 错误提示，无未捕获异常
- [ ] 实测：关闭主开关后 toast 不再出现，发送功能不受影响
- [ ] 截图存证 pic/（发送后 toast / 撤回成功）

## 工作量预估

单 feature、三个文件、复用两条已验证链路：约 0.5 天（含验收）。
