# Space Fanfou Archived Task Records

> Historical description of the retired `tasks/` control plane. Use `../KANBAN.md` for current state.

Updated: 2026-06-08T15:47:47+08:00
Executor: codex

This directory is the project-local status surface for agents. Read it before changing code.

## Read Order

1. `todo.md` - active worklist, acceptance criteria, and review/results.
2. `STATUS.md` - current cockpit: branch, feature state, current risks, and next suggested work.
3. `logic.md` - durable decisions and why they were made.
4. `problems.md` - known blockers, risks, and things not to silently assume.
5. `lessons.md` - project-specific rules learned from prior mistakes.
6. `journal.md` - chronological continuity notes.

Older context files:

- `oauth-status-report.md` - OAuth-specific historical report.
- `popupbox-wallpaper-context.md` - PopupBox/avatar-wallpaper historical context.

## File Responsibilities

- Put new implementation plans in `todo.md` before non-trivial work.
- Put only current, high-signal state in `STATUS.md`; do not turn it into a full log.
- Put architectural/product decisions in `logic.md`.
- Put unresolved risks or blockers in `problems.md`.
- Put prevention rules after user corrections in `lessons.md`.
- Put session-to-session narrative in `journal.md`.

## Harness Link

This project is indexed in `/home/fiver/projects/harness/projects.md`.

Local harness-style records:

- Cockpit: `tasks/STATUS.md`
- Continuity: `tasks/journal.md`
- Future handoffs: `tasks/handoffs/`
