# Space Fanfou Problems and Risks

Updated: 2026-06-08T15:47:47+08:00
Executor: codex

This file tracks unresolved risks and blockers. Closed items should move into `lessons.md` or `journal.md`.

## Active Risks

### Developer-mode Update Can Lose Local Records

Status: open

Current understanding:

- Current manifest has no fixed `key`.
- If a user loads the next version from a different folder, Chrome may assign a different extension ID.
- `chrome.storage.local` data is extension-scoped, so match3 records and some settings may not appear in the new folder's extension instance.

Mitigation:

- Add export/import for safe local extension data before encouraging wider developer-mode updates.
- Consider a fixed manifest `key` for developer-mode builds, but treat it as release infrastructure.

### Chrome Web Store Listing Ownership

Status: open

Current understanding:

- The original Fanfou extension listing is controlled by Fanfou official.
- This fork cannot update that listing without transfer or authorization.
- Self-publishing would be a separate listing and requires separate naming, privacy, listing assets, review process, and user migration notes.

Mitigation:

- Keep current docs explicit about official ownership.
- Prepare self-publishing only after privacy/export/import and listing copy are ready.

### `docs/project-status.md` May Be Stale

Status: open

Current understanding:

- `docs/project-status.md` is useful historical context, but it is not the live cockpit.
- Live state should come from git state plus `tasks/STATUS.md`.

Mitigation:

- Update `tasks/STATUS.md` for current cockpit state.
- Only update `docs/project-status.md` when intentionally refreshing the dated snapshot.

## Watchlist

- Keep `origin/simplify` untouched unless the user asks to resume that rewrite path.
- Do not commit by default; this project records status first and commits only when explicitly requested.
