# Space Fanfou Logic

Updated: 2026-06-08T15:47:47+08:00
Executor: codex

This file records durable decisions and reasoning. It is not a task checklist.

## Development Branch

Decision: the practical development branch is `2026.8`.

Reasoning:

- The previous local development branch name `2026.2` no longer matched the user's current planning horizon.
- `origin/simplify` is intentionally kept separate as a prior rewrite/worktree idea and should not be merged or cleaned up casually.

## Distribution Path

Decision: treat developer-mode folder distribution as the current practical path; treat Chrome Web Store self-publishing as a separate future release path.

Reasoning:

- The original Fanfou extension listing is controlled by Fanfou official, not this fork.
- This fork cannot update the original listing unless ownership or release access is transferred.
- A self-published listing would normally be a separate extension/listing with separate install and migration expectations.

Reference: `docs/distribution-and-devmode-storage.md`

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
