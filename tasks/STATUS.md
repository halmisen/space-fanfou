# Space Fanfou Status

Updated: 2026-07-13T10:05:00+08:00
Executor: claude
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

- Extension icon action (2026-07-13): dynamic per-tab behavior — on fanfou.com tabs the icon opens the settings popup (`settings.html`); on other tabs it opens or focuses `https://fanfou.com/home`. Popup click itself still needs the user's manual confirmation once.
- Mute fanfouers (`mute-fanfouers`, 2026-07-12): timeline mute with conversation matching, sidebar 「无爱饭友」 management panel (below 我关注的人), profile-page 静音此人 link placed inline with the native ops link row (2026-07-13). Fully verified logged-in.
- Unify sidebar panels (`unify-sidebar-panels`, 2026-07-13): optional (default off) grid/list layout unification for 有爱饭友 / 我关注的人 / 无爱饭友. CSS-only via body classes. Verified logged-in, both modes (pic/13~16).
- Fanfou font preset feature: implemented as a user-selectable setting.
- Avatar match3 local records: implemented with `chrome.storage.local`; records are backend-free.

Last full verification (2026-07-13): `npm test` (14 suites / 34 tests) passed, `npm run build` passed (page.js 842 KiB, limit 848), agent-browser logged-in acceptance with screenshots.

## Pending (specs ready, awaiting user scheduling)

- `docs/spec-undo-status.md`: 30s undo for just-posted statuses (~0.5 day).
- `docs/spec-annual-report.md`: personal annual report extension page (P0 1.5~2 days + P1 1 day).
- All work since the last commit is uncommitted on `2026.8` (mute-fanfouers, unify-sidebar-panels, action popup, specs).

## Test Automation Channel

- Credentials in repo-root `.env` (gitignored, chmod 600) — do not ask the user again.
- Flow: `agent-browser --extension <repo>/dist --session sf-test open https://fanfou.com/login` → `set viewport 1440 900` (narrow default viewport hides the sidebar) → fill from `.env` → one-click OAuth via settings page (开始授权 → 同意). Details in project memory `fanfou-test-account`.

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
