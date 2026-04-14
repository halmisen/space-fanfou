# 经验教训 (Lessons Learned)

本文件用于记录开发过程中遇到的避坑经验和错误复盘，以遵循“凡有纠正，必有记录”的原则，避免重复犯错。

## 1. OAuth API 签名基准 URL (API Spoofing)
- **踩坑点**：饭否的 `/oauth` 接口以及 `api.fanfou.com` 的数据接口虽然都支持 `https` 请求，但在进行 OAuth 1.0 签名计算 (Signature Base String) 时，**其官方后端由于年久失修，仍会强制将基准 URL 视为 `http://`**。
- **复盘与规则**：在计算签名头参数时，不仅要把 `https://fanfou.com/oauth` 替换为 `http://`，连 `https://api.fanfou.com` 也必须强制替换为 `http://api.fanfou.com`，否则就会无差别收到 `401 Invalid signature` 的暴击。

## 2. Page 级环境脚本扩展注入的宿主模块隔离 (The `page.js` Module Vacuum)
- **踩坑点**：将原有的 `check-friendship` 脚本从 HTML 抓取迁移为 API 抓取时，我顺手在顶部引入了 `const { messaging } = requireModules(['messaging'])`，企图调用后台环境的接口。
- **致命后果**：由于 `page.js` 作为“受限注入脚本”并不具备 `messaging` 的预注册上下文模块，这一个找不到模块的微小错误，不仅让 `check-friendship` 挂掉，而且阻断了预处理器 `webpack` 整个模块遍历链（`for...of Object.entries(features)`）！这导致所有其他页面级组件全部“消失”，造成灾难级的回归 Bug。
- **复盘与规则**：在 `page.js` 的注入域中，**绝对不要**随意 `require` 后台的底层接口模块如 `messaging`。必须使用项目中专门做过 IPC 穿透暴露的 `fanfouOAuth` 等对齐中间件。而且一旦看到所有组件全部失效，第一反应就是去检查有没有阻断特征装载循环的高阶未捕获异常 (Top-level Exception)!

## 3. Chrome `launchWebAuthFlow` 的曲折沙箱 (Sandboxed Sessions)
- **踩坑点**：扩展使用 WebAuthFlow 进行饭否 OAuth 授权时，获取到的 Access Token 能正常工作，但浏览器本体原本登录在主域名下的饭否 Cookie 却不会同步给扩展环境发起的普通 fetch 请求。
- **复盘与规则**：一旦转入了扩展认证流程，就**必须**完全拥弃基于 Cookie 的 DOM 爬虫刮削（Scraping），全面转向受 OAuth 显式授权保护的官方 API。混合（Cookie + OAuth Token）在沙箱里会导致幽灵行为。

## 4. MV3 Service Worker 休眠导致的 Bridge 异常与死锁 (The SW Hibernation Trap)
- **踩坑点**：MV3 下 Service Worker 会在约 30 秒无活动后面临休眠或被杀死的风险。如果页面在此时通过 `postMessage` 向后台发送请求，`messaging.postMessage` 极有可能会直接抛出一个 rejected Promise（因 port 断开）。在原本的 `bridge.js` 转发通道设计中，由于 `await bridge.postMessageToBackground(message)` 周围未作 `try-catch` 处理，这会导致代码抛出异常并提前退出当前 Eventhandler，不再执行向页面脚本回调发回响应的动作，最终导致发起请求侧陷入死锁。
- **关联影响**：在 `check-friendship` 等深度依赖基于 Promise 的 `bridge` 响应通道的组件里，请求永远都没有 resolve 或 reject 返回，UI 操作会卡制在"处理中"的锁定死区，用户无法重试。而如果在页面逻辑的同步流里，成功处理后也没有妥善复位 `hasChecked = false`，同样会导致状态紊乱。
- **复盘与规则**：在涉及到 MV3 的扩展应用环境跨层桥接（比如从 Content Bridge 代理转发给 Background）时，必须严格防御底层管道断裂报错。**任何底层通信的 `await` 调用必须由 `try-catch` 包裹，确保即使通信崩溃，也能把明确定义的错误体转发回前台，以释放所有挂起的 Deferred 锁。** 而对待像 `hasChecked` 这类的行为阻拦标记，应确保其在成功与失败路径的末端都能统一收敛释放。

## 5. Feature 子脚本导出约定破坏会连锁触发设置页白屏 (Subfeature Export Contract)
- **踩坑点**：在 `src/features/*` 中新增了 `@background.js` 但没有 `default export` subfeature 工厂（或者导出形态不符合框架期望），会导致 background 在遍历 feature 并实例化 subfeature 时抛错。
- **关联影响**：background 初始化失败后，settings 页拿不到 `GET_OPTION_DEFS` 响应，最终表现为设置页白屏或空渲染。
- **复盘与规则**：
  - 任何 `*@background.js` / `*@content.js` / `*@page.js` 必须 `export default context => ({ ...lifecycle })`。
  - 如果当前功能只需要页面逻辑，优先使用单一 `@page` 实现，避免不必要的跨层脚本。
  - 一旦出现 settings 白屏，先检查新增 feature 的子脚本导出签名是否满足框架约定，而不是先怀疑 metadata。

## 6. 视觉类功能必须验证“感知效果”，不仅是逻辑正确 (Perceptual Validation)
- **踩坑点**：即使像素规格是对的（如 48x48），若布局间距过大、透明度过低或强制重复平铺，用户会感知为“头像太小/不美观/像坏了”。
- **复盘与规则**：
  - 对视觉功能至少做一次真实页面截图复核，确认“体感大小”和“信息密度”符合预期。
  - 避免为铺满而机械重复素材；优先唯一渲染，再根据数据量做自适应尺寸和排版。
  - 对背景类功能提供可选预设（如蓝色梯度方案），不要把单一默认色硬编码成唯一体验。

## 7. 背景装饰必须尊重内容主区信息层级 (Decorative Layout Hierarchy)
- **踩坑点**：将头像墙无差别铺满全屏会与时间线主区竞争视觉焦点，用户体感会认为“中间应该留白”。
- **复盘与规则**：
  - 装饰层优先布局在“次要阅读区域”（如左右栏），主内容中心区域应留出视觉呼吸带。
  - 用户已有显式偏好数据（如有爱饭友）时，装饰排序应支持优先策略，而不是纯随机。

## 8. 背景色需要支持“仅填缝”模式 (Gap-only Background Mode)
- **踩坑点**：用户希望保留头像清晰度时，统一透明层会把头像与背景一起变淡，造成“蓝色覆盖头像”的体感。
- **复盘与规则**：
  - 背景装饰应拆分“头像层”和“背景层”透明度控制，避免单一容器透明度同时影响两者。
  - 同一功能提供“全局背景”和“仅填缝背景”两种模式，满足不同审美偏好。

## 9. 长寿命功能分支在继续开发前要先与活跃主线对齐 (Branch Reality Check)
- **踩坑点**：我在 `feat/avatar-wallpaper` 的旧状态上直接实现“羊了个羊”视觉改造，没有先核对当前活跃主线 `2026.2`。结果主线上其实已经新增了 `match3Mode` 选项和一整套羊了个羊玩法，导致我改的是过时实现，用户自然也看不到我以为存在的入口。
- **复盘与规则**：
  - 当用户要求“继续优化某个已有功能”时，先检查当前活跃主线/主工作树是否已经对该功能有更新，再决定是在旧分支上改还是先同步。
  - 如果主线上已经有同名功能入口（如设置项、实验模式、按钮），应以那套最新实现为基线修复，而不是并行造第二套。

## 10. 交互状态不能依赖素材内容本身传达 (State vs. Content)
- **踩坑点**：在羊了个羊模式里，有些头像本身就是灰色或低饱和素材，结果即使牌是可点击的，也会被误看成“被遮挡/不能点”。
- **复盘与规则**：
  - “可操作 / 不可操作 / 被遮挡”这类状态必须通过独立于素材内容的 UI 信号表达，比如遮罩、亮边、浮起、状态条，而不是指望用户从图片内容自行判断。
  - 对游戏/互动式界面，关键资源计数（如剩余牌数）要单独高可见展示，不应只混在一句小文案里。

## 11. WSL 下接管 Windows Chrome 要区分“装上技能”和“连到浏览器” (WSL-to-Windows CDP Reality)
- **踩坑点**：在 WSL / Linux 会话里安装 `chrome-cdp-skill` 后，直觉上会以为 `127.0.0.1:9222` 就能直接通到 Windows Chrome；但实际这个 Linux 回环地址和 Windows 本地回环不是一回事，`curl http://127.0.0.1:9222` 在 WSL 里可能直接失败。
- **关联影响**：
  - 技能装到 `~/.codex/skills` 只是“本地可见”，不等于当前 Linux `node` 环境就能驱动 Windows 那份 Chrome。
  - 本机 Linux `node` 版本也可能不满足技能要求（这次 WSL 里是 `v20`，Windows 里是 `node.exe v23`）。
  - 直接让 Windows `node.exe` 跑 `\\\\wsl.localhost\\...\\cdp.mjs` 这种 UNC 路径时，模块解析可能翻车；复制到 `C:\\Users\\<user>\\AppData\\Local\\...` 之类的 Windows 本地目录更稳。
- **复盘与规则**：
  - 先在 WSL 里安装技能，再分别验证 Linux 侧和 Windows 侧的调试端口与 Node 版本，不要默认它们共享同一个运行时。
  - 需要真正接管 Windows Chrome 时，优先用 Windows 的 `node.exe` 执行 skill 脚本，并把脚本放到 Windows 本地路径。
  - `list` 能拿到标签页，不代表具体 tab 已可控；第一次对某个 tab 做 `shot/snap/click` 等附着操作时，往往还要在 Chrome 里单独点一次 “Allow debugging”。
