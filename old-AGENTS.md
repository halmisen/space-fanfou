# AGENTS.md

This repository follows `CLAUDE.md` as the primary operating contract for all
agents.

## Source of Truth

Priority order:

1. `CLAUDE.md` (authoritative workflow and quality bar)
2. Live repository state (`git branch --show-current`, `git status --short`,
   current files on disk)

If instructions conflict, follow `CLAUDE.md` first, then reconcile with live
repo state.

## Session Start

Check live state with `git branch --show-current` and `git status --short`, then
read `tasks/{STATUS,todo,problems,logic,lessons}.md` in that order.
`tasks/STATUS.md` is the project cockpit. Snapshot documents such as
`docs/project-status.md` and `PROJECT-STATUS-*.md` are historical references;
never use them as the basis for action without live verification.

## Mandatory Agent Workflow

1. For any non-trivial task (3+ steps or architecture-impacting), enter planning
   flow first:
   - Write a detailed, checkable plan in `tasks/todo.md`
   - Check in before implementation
   - Re-plan immediately if execution goes sideways
2. Use subagents for complex research/exploration/parallel analysis with one
   tack per subagent.
3. Track execution in `tasks/todo.md` while working:
   - Mark progress continuously
   - Add a review/results section before closing the task
4. Verify before claiming completion:
   - Run relevant lint/tests/build checks
   - Inspect logs/errors instead of assuming success
   - Validate behavior changes against baseline when relevant
5. Keep fixes simple, minimal, and root-cause oriented:
   - No temporary/hacky fix for non-trivial issues
   - Prefer elegant solutions when complexity warrants
6. After user corrections, update `tasks/lessons.md` with concrete prevention
   rules.

## Command Output Discipline

- Pipe all command outputs through `| head -100` by default
- Test/lint failures: inspect with `grep -E "FAIL|Error|✗|failed"` only, not full output
- Never `cat` full log files; use `tail -50` for recent state
- For repeated `npm test`/`npm run build` failures, read only the error section, not the full run
- Build success/failure is a boolean; only surface the relevant error block

## Practical Guardrails

- Do not assume status docs are current; confirm branch/dirty state first.
- Do not revert or overwrite unrelated local changes.
- Keep diffs scoped; prefer smallest safe change that satisfies the request.
