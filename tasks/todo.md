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

### Next Action Plan: "Beautification 5-Step Plan"

- [x] 0. 创建新的 worktree (`feat/beautify-plan`) 进行开发
- [x] 1. 建立具有 `--sf-*` 前缀的 CSS 变量池（`00-variables.less`），并通过 `index.js` 显式引入。
- [x] 2. 优化输入框、按钮（`.bl`, `.bh`, `input.formbutton`）、Tabs、PopupBox（去闪烁，加 transition 和 focus ring，杜绝 translateY 抖动）。
- [x] 3. 为 timeline（`#stream li`）添加轻量悬停反馈。
- [x] 4. 按需在 `src/features/translucent-sidebar/@content.less` 引入 `@supports` 毛玻璃特效。
- [x] 5. **(New)** 移除侧边栏毛玻璃特效，还原其实体感。
- [x] 6. **(New)** 加强 `00-variables.less` 中的阴影深度 (`--sf-shadow-sm/md`)，增强对比度，让层次感更明显。
- [x] 7. **(New Aesthetic Adjustment based on Screenshots)**:
    - a. 弱化主题背景图的影响（或者将主容器背景色设置为不透明的全白），让内容区浮现出来。
    - b. 消除主内容区 (`#main`, `#sidebar`, `#content`) 生硬的物理边框，完全依靠阴影 (`var(--sf-shadow-md)`) 区分层级。
    - c. 增加主内容的内边距 (`padding`)，让文字和卡片边缘有呼吸感。
- [x] 8. **(Feedback Refinements)**:
    - [x] a. 恢复用户的自定义壁纸显示（移除 `#00-global.less` 对 body 背景的覆盖）。
    - [x] b. 优化 `#PopupBox` 弹窗内的元素（解决“发送”和“上传照片”按钮没有对齐、大小风格不一致的冲突）。

## 2026-02-27 PopupBox 对齐复核（Codex）

### Plan
- [x] 1. 核对实际使用工作树与 dist 输出目录，确认用户侧运行的是 `space-fanfou-beautify/dist`。
- [x] 2. 对 `#PopupUpdate .formbutton` 的遗留 `left` 偏移做精准覆盖，修正按钮错位。
- [x] 3. 重新构建 `space-fanfou-beautify` 并确认 `dist` 产物时间戳更新。
- [x] 4. 记录验证结果与用户侧复测要点。

### Review / Results
- 结论：此前我修复并构建的是 `/home/fiver/projects/space-fanfou/dist`，用户实际使用的是 `/home/fiver/projects/space-fanfou-beautify/dist`，导致用户看不到变化。
- 代码修正：在 `src/features/status-form-enhancements/misc@page.less` 新增 `#PopupUpdate .formbutton, #PopupBox .formbutton` 覆盖，强制清除遗留 `left: 24px !important` 偏移并移除 float/margin 干扰。
- 验证：
  - `npx stylelint src/features/status-form-enhancements/misc@page.less` 通过（仅有既有 deprecation warning）。
  - `npm run build` 通过（`BUILD_EXIT=0`）。
  - `dist/page.css` 更新时间为 `2026-02-27 15:45`，确认已重建最新产物。
- 用户侧复测点：扩展管理页面执行「重新加载」，然后在具体状态页弹出 `#PopupBox` 观察上传按钮和发送按钮是否同一基线。

## 2026-02-27 PopupBox Simplification
- Removed JS-based upload button injection from `#PopupBox` to reduce complexity and align with native text-only reply usage.
- Cleaned up CSS to remove custom alignment shims and fully adopted native `#phupdate` form styles (padding, borders, box-shadow).
- Built successfully to `/dist`.
