# Space Fanfou Logic

Updated: 2026-07-17T16:00:59+08:00
Executor: codex

This file records durable decisions and reasoning. It is not a task checklist.

## Development Branch

Decision: the practical development branch is `2026.8`.

Reasoning:

- The previous local development branch name `2026.2` no longer matched the user's current planning horizon.
- `origin/simplify` is intentionally kept separate as a prior rewrite/worktree idea and should not be merged or cleaned up casually.

## Distribution Path

Decision: prepare both an independent Chrome Web Store route and a free route, while sharing one extension codebase. The free route consists of the unpacked full extension plus an optional userscript limited to visual and page-level enhancements.

Reasoning:

- The original Fanfou extension listing was removed after its manifest was not updated in time.
- The repository maintainer who accepted the Manifest V3 pull request is not Fanfou official and does not control the removed listing.
- A self-published listing would normally be a separate extension/listing with separate install and migration expectations.
- The full extension depends on browser APIs that a userscript cannot replace, so the userscript is a lightweight skin rather than a second full product.
- Shared compliance, privacy, permission, packaging and migration preparation should happen before the user decides whether to pay the registration fee.

Reference: `docs/distribution-decision-guide.md`

## Local Data and Match3 Records

Decision: avatar match3 records can be local-only for now, but broader user distribution needs export/import or stable extension ID handling.

Reasoning:

- The feature does not need a backend to save fastest clears and most-cleared avatar accounts.
- Current records are stored in `chrome.storage.local`.
- Without a fixed manifest `key`, a new developer-mode folder may produce a different extension ID, so users may not see old local records.

Preferred next implementation:

- Add export/import for safe local user data.
- Do not export OAuth tokens, cookies, signatures, or browser session material.

## Font Feature

Decision: implement Fanfou font customization as small preset choices rather than arbitrary free-form font input.

Reasoning:

- Presets are easier to support and less likely to break layout.
- The setting can remain user-facing without needing a backend or external font dependency.

## Extension Icon Behavior

Decision: clicking the Chrome extension icon should open/focus Fanfou rather than show a popup.

Reasoning:

- The user wanted a one-click jump to `fanfou.com`.
- A background action launcher is simpler than maintaining a popup UI for this behavior.
