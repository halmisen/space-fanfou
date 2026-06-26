# Space Fanfou Status

Updated: 2026-06-08T15:47:47+08:00
Executor: codex
Status: active cockpit

## Source Order

1. `CLAUDE.md`
2. Live git state and files on disk
3. `AGENTS.md`
4. `tasks/STATUS.md`
5. `tasks/todo.md`
6. `tasks/logic.md`
7. `tasks/problems.md`
8. `tasks/journal.md`
9. `docs/project-status.md`

`docs/project-status.md` is a dated snapshot and may lag behind current branch state.

## Current Branch

- Active branch: `2026.8`
- Tracking: `origin/2026.8`
- `origin/simplify` is intentionally kept as a separate worktree/rewrite branch and should not be touched unless the user asks.

## Current Feature State

- Extension icon action launcher: implemented on branch `2026.8`; clicking the extension icon opens or focuses `https://fanfou.com/home`.
- Fanfou font preset feature: implemented as a user-selectable setting.
- Avatar match3 local records: implemented with `chrome.storage.local`; records are backend-free.

Last full implementation verification for those feature changes:

- ESLint targeted files: passed.
- Stylelint targeted files: passed with existing Browserslist/stylelint deprecation warnings only.
- `npm run build`: passed.

## Distribution Decision

The original Chrome Web Store listing is controlled by Fanfou official. This fork cannot update that listing without official transfer or authorization.

Current practical distribution path: unpacked folder + Chrome developer mode.

Risk: the current manifest has no fixed `key`, so loading a new folder can produce a different extension ID. Local `chrome.storage.local` records, including avatar match3 results, may not migrate automatically.

Decision note: `docs/distribution-and-devmode-storage.md`

## Harness Integration

- Global project index: `/home/fiver/projects/harness/projects.md`
- Local cockpit: `tasks/STATUS.md`
- Local task list: `tasks/todo.md`
- Local decisions: `tasks/logic.md`
- Local risks/problems: `tasks/problems.md`
- Local continuity log: `tasks/journal.md`
- Future handoffs root: `tasks/handoffs/`

This is a lightweight harness integration: enough for the next agent to find current state and continuation notes, without imposing a full reviewer workflow until the project needs it.

## Next Suggested Work

1. Add export/import for safe local extension data, especially `avatar-wallpaper/match3Records`.
2. Decide whether developer-mode builds should use a fixed manifest `key`.
3. If pursuing Chrome Web Store self-publishing, prepare privacy policy, permission rationale, listing copy/assets, and migration notes.

## Task Record Files

- `tasks/README.md`: how to read and maintain task records.
- `tasks/todo.md`: plans, acceptance criteria, and review/results.
- `tasks/logic.md`: durable decisions and reasoning.
- `tasks/problems.md`: active risks and blockers.
- `tasks/lessons.md`: prevention rules learned from prior mistakes.
- `tasks/journal.md`: chronological continuity.
