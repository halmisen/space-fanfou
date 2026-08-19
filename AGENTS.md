# Repository Guidelines

## Project Structure

Space Fanfou is a Manifest V3 Chrome extension. Webpack entry points are in
`src/entries/`; runtime layers live in `src/background/`, `src/content/`,
`src/page/`, `src/settings/`, and `src/offscreen/`. Feature modules belong in
`src/features/<feature-name>/` and are discovered automatically through
`src/features/index.js`. Reusable helpers and colocated Jest tests are in
`src/libs/` and feature directories. Use `static/` for the manifest and static
icons, `build/` for packaging code, and `tests/playwright/` for browser specs.
`dist/` is generated output; do not edit it by hand.

## Build, Test, and Development Commands

- `npm install` installs dependencies.
- `npm run dev` watches a development build; load `dist/` as an unpacked
  extension in Chrome.
- `npm test` runs JavaScript linting, CSS linting, and Jest unit tests.
- `npm run unit` runs Jest only; use `npx jest path/to/file.test.js` for a
  focused test.
- `npm run build` creates a production build. Rebuild before
  `npx playwright test`, which exercises `tests/playwright/` against `dist/`.
- `npm run release` builds and packages the extension.

## Coding Style and Naming

Use two-space indentation, single-quoted JavaScript, and the repository's
`riophae` ESLint rules. Keep LESS compatible with Stylelint. Name feature
directories in kebab-case; use the existing aliases such as `@libs/*`,
`@features/*`, and `@constants/*`. New extension CSS classes and IDs must use
the `sf-` prefix and kebab-case, for example `sf-archive-panel`. Add feature
files with the established layer suffixes (`@background.js`, `@content.js`,
`@page.js`) instead of creating a second registration system.

## Testing Guidelines

Place unit tests beside the code they cover with a `*.test.js` suffix. Add a
Playwright `*.spec.ts` test for user-visible browser behavior. Logic changes
should include regression coverage. There is no fixed coverage threshold;
run the narrowest relevant test first, then `npm test` and `npm run build`.

## Commits and Pull Requests

Keep commits focused and use the established format, for example
`fix(personal-archive): 修复分页重复 [Codex]`. Write comments and commit
messages in Chinese where practical. Pull requests should describe behavior
changes, list verification commands, and include screenshots for UI changes.
Use GitHub's **Squash and merge** option. Never commit `.env`, tokens,
cookies, personal archive data, or generated build output.

## Start Here and Project State

Before non-trivial work, check `git branch --show-current` and
`git status --short`, then read `KANBAN.md`. Read the long-task card or
reference file named by that panel only when needed. `KANBAN.md` is the sole
short-term status panel; do not recreate a `tasks/` control plane. Preserve
unrelated local changes, and keep development-only instruction changes out of
product changes unless they are deliberately in scope.

The active development line is `2026.8`. The `origin/simplify` line is an
independent rewrite; do not modify or merge it without explicit instruction.
The extension's local archive is personal data, not a network replica. Keep
directory handles, OAuth state, account identifiers, cookies, `.env` files,
acceptance screenshots, and raw archive backups out of Git and out of logs.

## Archive and Browser Verification

File System Access directory selection and permission persistence must be
verified in the user's real Windows Chrome profile after a restart. A
temporary profile or `agent-browser` result does not prove this behavior.
Before cross-directory or cross-version distribution, resolve the missing
stable extension ID or a tested local-data migration path. Do not treat a
successful build or offline fixture read as proof of real desktop acceptance.

For background, content, and page changes, rebuild and reload the unpacked
extension as needed; refresh Fanfou pages when content scripts change. Add
regression coverage for logic and browser behavior, then run the narrowest
relevant checks before broader tests and build verification.
