# Avatar Wallpaper 配置页白屏 Bug 排查报告

## 1. 现象 (Symptom)
在 `/src/settings/getTabDefs.js` 的 `details` 分组中加入 `'avatar-wallpaper'` 后，编译出的 Chrome Extension `settings.html` (选项页) 变成完全白屏。
如果将 `avatar-wallpaper` 从 `getTabDefs.js` 数组中移除，重新打包后设置页即可恢复正常。
这说明问题 **100% 出现**在 `avatar-wallpaper` 特性的 `metadata.js` 定义或解析阶段，导致 React(Preact) 在渲染设置组件树时发生了 JavaScript 异常崩溃。

## 2. 已经做过的排查与尝试 (What has been tried)
1. **对比其他功能的 metadata 结构**：
   我对比了像 `floating-status-form` 等具有多个选项的 `metadata.js`，发现结构一样，都对外导出了 `options` 对象。
   第一层包含 `_` 配置总开关，其他字段对应功能子选项。类型如 `defaultValue: true` 或 `defaultValue: 0.15` 会被 `src/features/index.js` 的 `processOptionDef` 自动推断为 `checkbox` 或 `number`。

2. **追查 Number 类型组件的渲染逻辑**：
   在 `src/settings/components/App.js` 的 `renderNumberInput(optionDef)` 方法中，它使用如下方式获取文字并插入输入框：
   ```javascript
   const [ pre, post ] = optionDef.label.split(CONTROL_PLACEHOLDER)
   ```
   **我的猜测是由于我的 Number 类型配置 `opacity` 和 `fetchIntervalDays` 的 `label` 没有携带 `<CONTROL_PLACEHOLDER>`，导致 `post` 变成 `undefined` 从而在 React 中被忽略，但并未直接抛出报错。**
   
   我后来已经在 `avatar-wallpaper/metadata.js` 中补上了从 `@constants` 导入的 `CONTROL_PLACEHOLDER`：
   ```javascript
   label: \`壁纸透明度 \${CONTROL_PLACEHOLDER} (0.05 - 0.5)\`
   ```
   但用户反馈打包更新后**依然是白屏**。可能问题并不出在这里，或者 `import { CONTROL_PLACEHOLDER }` 这种语法在被 `import-all.macro` 解析打包时不能像常规代码那样生效（某些宏可能不支持外部常量导入引发 webpack eval error）。

3. **JSDOM 断点环境分析**：
   我尝试写过 Node JSDOM 脚本模拟加载 `dist/settings.js`，但是由于它依赖于大量强绑定的 `chrome.storage.sync` 和 `chrome.runtime.sendMessage` 底层初始化，很容易抛出误导性的 `TypeError`（比如获取 `chrome` 对象失败等），没法准确定位真正的渲染树崩溃抛错。

## 3. 下一步排查建议 (Next Steps for AI)
如果你接手了这个 Bug，请重点查验以下方向：
- **`import-all.macro` 约束限制**：在 `features/*/metadata.js` 中是否**禁止**使用 `import` 语句？我在 `avatar-wallpaper/metadata.js` 中显式 `import { CONTROL_PLACEHOLDER } from '@constants'` 可能破坏了被抽象语法树动态执行的规则（很多 `metadata.js` 都是纯静态配置，没有外部引用的导入）。尝试把它改成写死的常量字符串 `'<CONTROL_PLACEHOLDER>'` 试试看。
- **重新检视 `options` 对象内的取值约束**：像 `0.15` 是个小数，是否有被代码转化为非法整数报错的可能性？
- **如何获取到真正的 Error Stack**：让用户在本地开着该白屏设置页的 Chrome 开发者工具 (`DevTools -> Console`)，提供确切爆红的 Error 调用栈，这能一瞬间就锁定到是 `processOptionDef` 跪了还是 `App.renderNumberInput` 跪了。

## 4. Workaround 前置方案
如果急于推进而此 Bug 一时无法修好，可以暂时去除子选项，只在 `metadata.js` 里保留单纯的 `_: { defaultValue: true, label: '显示关注者头像壁纸' }` 布尔值开关，并把透明度之类使用写死的常量代码。这样大概率可以恢复设置页正常展现。
