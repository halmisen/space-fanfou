# 发布

> 当前分发现实：原 Chrome Web Store listing 由饭否官方控制；本 fork 无法直接更新原 listing，除非获得转移或授权。当前开发者模式更新、Chrome 商店自发布、本地战绩迁移的判断记录见 [`docs/distribution-and-devmode-storage.md`](./distribution-and-devmode-storage.md)。

### 如何选择新版本号

从 1.0.0 开始，太空饭否使用[语义化版本控制](https://semver.org)。当发布新版本时，选择新版本号应遵循：

- 如果没有引入新功能，只是在现有基础上修补和改进，则应发布 patch（`_._.+`）更新；
- 如果引入了新功能，则应该发布 minor（`_.+._`）更新；
- 如果大幅度调整了代码或设计，则应该发布 major（`+._._`）更新。

### 更新历史的显示位置

- 「设置」→「更新历史」，显示完整的更新历史
- 扩展启动时弹出通知，显示本次版本更新内容的概要（如果刚刚升级到了新版本、开启了相关设置，并且 `versionHistory` 中包含了该版本的更新内容）

### 如何编写更新历史内容

- 更新历史应该介绍该版本在功能、设计及用户体验方面新引入或修正的内容
- 应该避免无意义的文字，如「修正了一些 bug」，尽量不打扰用户
- 如果更新内容过多，可以在前面写一行概要，用于作为桌面通知内容显示

### 如何准备新版？

1. 修改 `static/manifest.json` 中的版本号
1. 在 `src/version-history/versionHistory` 中添加更新说明（可选）
1. 构建 `npm run release`

### 如何分发新版？

- 开发者模式：让用户加载同一个稳定目录更稳妥。若用户改用新文件夹，且 manifest 没有固定 `key`，Chrome 可能生成不同扩展 ID，本地 `chrome.storage.local` 中的设置、缓存、头像消消乐战绩可能不会自动迁移。
- 商店发布：只能提交到自己拥有或被授权管理的 Chrome Web Store listing。若自建 listing，它会是一个独立扩展，通常需要独立安装和迁移说明。
- 下一步发布前置：优先补齐本地数据 export/import，再鼓励用户用开发者模式更新。
