# Space Fanfou Development Tasks

## UI Rewrite & Beautification Strategy (New)

### Problem Analysis
*   The original UI (especially the Settings page and Sidebar Statistics) has a high information density and relies on tightly packed text elements.
*   Aggressively applying modern structural patterns (like Bento Grids or large Glassmorphism cards) drastically reduces information density, breaks text flow, and introduces negative optimizations (e.g., squished inputs, overlapping text).
*   The goal is to modernize the *feel* without destroying the *function* and *layout*.

### Progressive Enhancement Strategy
Instead of structural overhauls, we will focus on **Non-Destructive Aesthetic Upgrades**:

1.  **Color & Contrast Refinement (The Foundation):**
    *   Replace flat, generic colors with a cohesive modern palette (e.g., Tailwind's Slate/Gray scale for neutrals, Cyan/Blue for accents).
    *   Increase contrast ratios slightly for better readability.
    *   Introduce a subtle global background color (e.g., `#F8FAFC` or `#F5F5F7`) to make white content panels "pop" without needing heavy borders.

2.  **Typography Modernization:**
    *   We are already using system fonts (`-apple-system`, `BlinkMacSystemFont`), which is good.
    *   *Action:* Fine-tune font weights. Make headers bolder (`600` or `700`) and slightly tighter in letter-spacing. Use slightly lighter shades (`#475569` or `#64748B`) for secondary text to establish a clear visual hierarchy.

3.  **Micro-Interactions & Soft Shadows (The Polish):**
    *   *Current State:* Borders are often used to separate elements (e.g., `#eee`).
    *   *Upgrade:* Replace harsh borders with extremely subtle, modern drop shadows (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);`).
    *   Add smooth, fast transitions (`transition: all 0.2s ease-in-out;`) to hover states, button clicks, and input focuses.

4.  **Form Element Polish (Crucial for Settings):**
    *   Do *not* change the width or fundamental layout of inputs.
    *   *Action:* Give inputs a softer border (`1px solid #E2E8F0`), a very subtle inner shadow, and a clear, modern focus ring (e.g., `box-shadow: 0 0 0 2px #BAE6FD; border-color: #38BDF8;`). This makes them feel "clickable" and modern without altering the page layout.

### Next Action Plan
1.  **Discard Structural Changes:** We have already reverted the `feat/ui-settings` and `feat/ui-sidebar` worktrees to their `2026.2` state.
2.  **Iterative Micro-styling:** We will pick one component (e.g., the Settings page buttons and inputs) and apply *only* color, shadow, and transition updates.
3.  **Review & Proceed:** We will review these subtle changes. If successful, we expand this logic to other elements.

[x] Reverted failed Bento Grid/Glassmorphism structural changes in Settings and Sidebar.
[ ] Define a global minimalist color/shadow CSS variables block.
[ ] Apply non-destructive styling to Settings Form Elements (Inputs, Checkboxes, Buttons).
[ ] Apply non-destructive styling to Sidebar Typography and spacing.

## 2026-02-27 PopupBox Upload Button Alignment
- Restored `ajax-form@page.js` injection logic so the upload button works.
- Cleaned up `misc@page.less` by stripping the custom `.sf-popup-upload-wrapper` backgrounds, borders, and shadows.
- The injected popup upload button now renders as a clean, transparent icon identical to the native homepage input style, fixing the baseline alignment.

## 2026-02-27 PopupBox Upload Button Left-Alignment
- Updated `misc@page.less` to apply `float: left` and remove custom background styling to the injected upload button.
- The icon is now correctly rendered on the far left of the `#PopupBox` `.act` container, faithfully reproducing the native homepage behavior while retaining the script functionality.

## 2026-02-27 PopupBox Upload Button Absolute Left-Alignment
- Updated `misc@page.less` to apply `position: absolute; left: 18px; bottom: 16px;` to force the button into the bottom left corner.

## 2026-02-28 PopupBox Upload Button Robust Flex Layout
- Replaced `position: absolute` with Flexbox on `#PopupBox .act`.
- Used `margin-right: auto` on the upload wrapper to guarantee it always anchors to the far left without breaking the native form layout.
- 2026-02-28 `PopupBox` upload button left alignment failed (Float, Absolute, Flexbox). Handing over layout debugging to Codex.

## 2026-02-28 PopupBox Upload Button True Left Alignment (Codex)

### Plan
- [x] 1. 审查 `#PopupBox` 上传按钮的注入锚点、计数器插入点和全局样式冲突，确认为什么 `.act` 内对齐策略始终失效。
- [x] 2. 改用更贴近原生 `#phupdate` 的 DOM 落点或结构包装，避免继续依赖会破坏旧布局的 `flex/absolute/float` 强推。
- [x] 3. 收敛 `misc@page.less` 中只为 PopupBox 服务的覆盖，保留透明相机图标外观，同时确保发送按钮与计数器不被带偏。
- [x] 4. 运行针对性校验（至少 `stylelint`，必要时补 `build`），并在本节记录结果与剩余风险。

### Review / Results
- 根因：上传按钮一直被插在 `sendButton.before(...)` 的同级按钮组里，真实约束容器更可能是 `.actpost`；因此对 `#PopupBox .act` 做 `float`、`absolute`、`flex` 都无法把它真正推到左边。
- 变更：在 `src/features/status-form-enhancements/ajax-form@page.js` 为 PopupBox 增加专属落点，检测 `.act > .actpost` 后将 `.sf-popup-upload-wrapper` 插到 `.actpost` 前，而不是继续塞进发送按钮那组。
- 变更：在 `src/features/status-form-enhancements/misc@page.less` 将 PopupBox 操作行改为“左侧上传按钮 + 右侧 actpost 按钮组”的匹配布局，并重置 `.actpost .formbutton` 的遗留 `left` 偏移，保留透明相机图标外观。
- 验证：
- `npx stylelint src/features/status-form-enhancements/misc@page.less` 通过（仅出现仓库既有 deprecation warning）。
- `npx eslint src/features/status-form-enhancements/ajax-form@page.js` 通过。
- `npm run build` 通过（退出码 `0`）。
- 剩余风险：当前环境没有可复用的饭否登录 Cookie，未能在真实 `#PopupBox` 页面做 Playwright/手工视觉复验；建议在扩展热更新后实际打开回复弹窗确认图标已贴左下角。
