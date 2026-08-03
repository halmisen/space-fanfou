# CLAUDE.md

Primary operating contract for agents working in this repository.

## Workflow Orchestration

### 1. Plan Node Default

- Enter plan mode for any non-trivial task (3+ steps or architectural decisions).
- Write checkable acceptance criteria up front, including verification.
- If execution goes sideways, stop and re-plan immediately.

### 2. Subagent Strategy

- Use one focused subagent per complex research, exploration, or parallel-analysis tack.
- Keep straightforward work in the main session.

### 3. Self-Improvement Loop

- After a user correction, add a concrete prevention rule to `tasks/lessons.md`.
- Review relevant lessons at session start.

### 4. Verification Before Done

- Prove the result with relevant tests, logs, and behavioral comparison.
- Never mark work complete based on assumption; apply a staff-engineer quality bar.

### 5. Demand Elegance (Balanced)

- Prefer the simplest root-cause fix with minimal impact.
- Reconsider non-trivial solutions that feel hacky; do not over-engineer obvious fixes.

### 6. Autonomous Bug Fixing

- Diagnose bugs from objective evidence, then fix them without asking for hand-holding.
- Resolve failing CI checks within the task scope.

## Task Management

1. Write a checkable plan in `tasks/todo.md` for non-trivial work.
2. Confirm the plan before implementation and track progress as work proceeds.
3. Add a review/results section with verification evidence before closing.
4. Update `tasks/lessons.md` after user corrections.

### Project Control Plane

At session start, check live git state, then read these files in order:

1. `tasks/STATUS.md`: current project cockpit
2. `tasks/todo.md`: active plans and acceptance criteria
3. `tasks/problems.md`: open risks and blockers
4. `tasks/logic.md`: durable decisions and reasoning
5. `tasks/lessons.md`: prevention rules from prior work

Use `tasks/journal.md` for continuity history and `tasks/handoffs/` for role or
agent handoffs. Treat dated status documents outside this control plane as
historical references until live state confirms them.

## Core Principles

- **Simplicity**: make the smallest change that fully solves the problem. Avoid
  speculative abstraction, configuration, and indirection.
- **Root cause**: no temporary or unexplained patches for non-trivial issues.
- **Minimal impact**: preserve unrelated work and avoid unnecessary churn.
- **Layered growth**: start from the smallest version that works end to end, then
  add each capability on top of something that already works. Never trade a
  working product for unfinished complexity.
- **Decide for the long term**: do not accept a stopgap that only works for now
  and is meant to be replaced later.
- **Study prior art first**: look at how established products solve the problem
  before designing one; adopt their proven patterns instead of inventing an
  approach. This is how `docs/feature-directions.md` was derived from `nofan`.
- **Reuse before writing**: lean on dependencies already in the project, and read
  a library's docs and types before assuming it lacks a capability. Adding a new
  dependency additionally needs a size argument — `build/shared.js` enforces a
  `BUNDLE_SIZE_LIMIT` ratchet on `page.js` that has been raised three times.

### Compatibility is not optional in this project

A general principle "remove obsolete paths instead of adding migrations" does
**not** apply here, and agents should not adopt it from external guides.

Users run whatever version they last loaded as an unpacked extension, and their
data lives on their own machines: `chrome.storage.local` settings, avatar match3
records, mute lists, and personal-archive folders written to disk with a
`meta.json` watermark. There is no deployment we control and no server-side
backfill. Removing an old path therefore needs a migration or a version bump —
see `CACHE_SCHEMA_VERSION` in `src/features/avatar-wallpaper/`, currently `3` —
rather than deletion. `tasks/problems.md` tracks the related open risk that a
changed extension ID can orphan local records.

## Project Overview

Space Fanfou is a Manifest V3 Chrome extension that enhances fanfou.com. It is
forked from [fanfoujs/space-fanfou](https://github.com/fanfoujs/space-fanfou)
and uses the `fanfou-oauth` feature for one-click authorization.

## Core Commands

### Development

```bash
npm run dev          # Watch and rebuild
npm test             # Lint and unit tests
npm run build        # Production build
npm run release      # Build and package
```

### Testing and Linting

```bash
npm run unit         # Jest unit tests
npm run unit:dev     # Jest watch mode
npm run lint         # JavaScript and CSS lint
npm run lint:js      # ESLint only
npm run lint:css     # Stylelint only
npx jest path/to/test-file.js
npx jest -t "test name pattern"
npx playwright test  # End-to-end specs in tests/playwright/
```

## Architecture

The extension compiles into four independent layers; see `docs/architecture.md`.

1. **Background** (`background.js`): service worker for notifications and other
   persistent tasks; no DOM access; talks to Content through Chrome messaging.
2. **Content** (`content.js`): isolated fanfou.com DOM layer and bridge between
   Background and Page; changes require an extension restart.
3. **Page** (`page.js`): fanfou.com page-context code with access to site APIs;
   talks to Content through CustomEvents; changes need only a page reload. Site
   CSP, not extension-page CSP, governs this layer.
4. **Settings** (`settings.html`, `settings.js`): Preact settings interface.

Use Content for performance-sensitive work and Background communication. Use
Page when site JavaScript APIs are required.

### Feature Modules

Each feature lives in `src/features/<feature-name>/` and is auto-loaded:

- `metadata.js`: required options and configuration
- `<name>@background.js`: Background component
- `<name>@content.js` / `<name>@content.less`: Content component and styles
- `<name>@page.js` / `<name>@page.less`: Page component and styles

Options use `defaultValue` and `label`; set `disableCloudSyncing: true` for local
storage. Export `isSoldered = true` only for features that cannot be disabled.

### Build System

- Entries live in `src/entries/`: `background-content-page.js`, `settings.js`,
  and `offscreen.js` (audio outside the service worker).
- `ifdef-loader` selects `ENV_BACKGROUND`, `ENV_CONTENT`, or `ENV_PAGE` code.
- `src/features/index.js` uses `import-all.macro` for feature discovery.
- Production output is written to `dist/` with readable minimal minification.

## Tech Stack

- Preact 10; Webpack 4 and Babel
- Jest and Playwright; ESLint and Stylelint
- LESS and PostCSS/Autoprefixer
- `select-dom`, `dom-chef`, `element-ready`, and `wretch`

## Key Conventions

- Aliases: `@libs/*` → `src/libs/*`, `@features/*` → `src/features/*`,
  `@constants/*` → `src/constants/*`.
- Background ↔ Content uses Chrome messaging; Content ↔ Page uses
  CustomEvents through `src/content/environment/bridge.js`.
- Settings use `chrome.storage.sync` or `chrome.storage.local`, selected per
  option with `disableCloudSyncing`.

## Common Tasks

To add a feature, create its directory and `metadata.js`, then add the required
layer files; no manual registration is needed.

For debugging, run `npm run dev` and load `dist/` as an unpacked extension.
Inspect Background logs through the extension service worker and Content/Page
logs through the page console.

Before release, run `npm test` and then `npm run release`.

## Reference Docs

- Architecture: `docs/architecture.md`
- Release process: `docs/publish.md`
- Contributing: `docs/contributing.md`
