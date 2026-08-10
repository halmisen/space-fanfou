# Repository Guidelines

This repository's active development line is `2026.8`. `CLAUDE.md` contains
the detailed operating contract; this file is the fast, project-specific loop.
Keep development-only instruction changes out of product PRs unless they are
deliberately part of the public change.

## Start Here

Before non-trivial work, check `git branch --show-current` and
`git status --short`, then read `KANBAN.md`. Read the named long-task card or
reference file only when the panel points to it. Preserve unrelated local
changes. Write a checkable plan for work with multiple steps and verify the
exact user-facing surface before calling it done. `KANBAN.md` is the sole
short-term status panel; do not recreate a `tasks/` control plane.

## Project Layout

This is a Manifest V3 Chrome extension. Webpack entries are in `src/entries/`;
runtime layers are `src/background/`, `src/content/`, `src/page/`,
`src/settings/`, and `src/offscreen/`. Features live in
`src/features/<feature-name>/`, with `metadata.js` and layer suffixes such as
`@background.js`, `@content.js`, `@page.js`, and `.less`. Reusable helpers and
colocated Jest tests are in `src/libs/` and feature directories. `static/`
contains the manifest and assets, `tests/playwright/` contains browser specs,
`build/` contains Webpack and packaging code, and `dist/` is generated output.

## Fast Development Loop

- `npm run dev` watches a development build; load `dist/` as an unpacked extension.
- `npm test` runs ESLint, Stylelint, and Jest; use `npx jest path/to/test.js`
  for a focused test.
- `npm run build` creates the production build; run it after source changes.
- `npx playwright test` runs browser specs after rebuilding `dist/`.
- Use `npx eslint <files>` and `npx stylelint <files>` for quick targeted checks.

Use two-space indentation, single-quoted Babel-compatible JavaScript, and the
existing ESLint `riophae` rules. Use kebab-case feature directories and the
configured aliases `@libs/*`, `@features/*`, and `@constants/*`. New features
are discovered through `src/features/index.js`; do not add a second registry.

## Verification and Handoff

Background/content/page changes have different reload requirements: rebuild,
reload the unpacked extension when needed, and refresh Fanfou pages for content
scripts. Add colocated `*.test.js` regression coverage for logic changes and
`tests/playwright/*.spec.ts` coverage for browser behavior. Before handoff, run
the relevant focused checks, `npm test`, `npm run build`, and `git diff --check`.
Keep commits focused with messages such as `feat(scope): ...` or
`fix(scope): ...`; never commit tokens, cookies, `.env` contents, or generated
artifacts.
