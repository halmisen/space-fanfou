# Space Fanfou Journal

## 2026-06-08 Harness status and distribution/storage decision

Executor: codex
Timestamp: 2026-06-08T15:38:08+08:00

### Context

The user asked to record the current thinking and check whether this project is connected to `/home/fiver/projects/harness` status tracking.

### Findings

- `/home/fiver/projects/harness/projects.md` already listed `space-fanfou` with its path and domain.
- The local project did not yet have a harness-style cockpit file (`tasks/STATUS.md`) or continuity log (`tasks/journal.md`).
- `docs/project-status.md` exists, but it is a historical snapshot and should not be treated as current cockpit state.

### Records Added

- `docs/distribution-and-devmode-storage.md`: distribution and local-storage decision note.
- `docs/publish.md`: updated to point to the current distribution reality.
- `tasks/STATUS.md`: current local cockpit.
- `tasks/journal.md`: continuity log.
- `tasks/handoffs/.gitkeep`: reserved handoff root for future multi-role work.
- `/home/fiver/projects/harness/projects.md`: updated so the global index points to this project's local status records.

### Decision

Current release path is developer-mode folder distribution. Before wider user-facing updates, add export/import for safe local extension data because a new folder may create a new extension ID and lose `chrome.storage.local` records.

## 2026-06-08 Task record file set expanded

Executor: codex
Timestamp: 2026-06-08T15:47:47+08:00

### Context

The user confirmed that task-series files should be supplemented so TODO and status records are clear.

### Records Added

- `tasks/README.md`: read order and file responsibilities.
- `tasks/logic.md`: durable product/technical decisions.
- `tasks/problems.md`: active risks and mitigations.

### Status Update

`tasks/STATUS.md` now lists the full task-record file set, so future agents can start from the project-local status surface instead of relying on dated snapshots or chat history.
