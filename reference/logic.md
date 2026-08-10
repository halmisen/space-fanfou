# Space Fanfou Logic

> Durable reference. Current direction is in `../KANBAN.md`.

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

## External Agent-Guide Adoption (2026-08-03)

Decision: keep `AGENTS.md` and `CLAUDE.md` as they are. Merge the reusable design
principles from a community `AGENTS.md` into `CLAUDE.md` § Core Principles, and
explicitly reject its "no backward compatibility" rule.

Reasoning:

- The candidate document is eight bullets of pure design philosophy with no
  project-specific operational content. Replacing our files with it would delete
  the only record of the four-layer runtime model, the reload matrix, the command
  set, the control-plane read order, and the verification gates — none of which
  are recoverable by reasoning from first principles.
- Its rule "do not preserve backward compatibility; remove obsolete paths instead
  of adding compatibility layers, fallbacks, or migrations" is actively wrong for
  a browser extension distributed as an unpacked folder. Users hold their own data
  and upgrade on their own schedule; `CACHE_SCHEMA_VERSION` (now `3`) exists
  precisely as the migration mechanism that rule would forbid.
- Its rule "prefer established libraries" needs a local caveat: `page.js` is under
  a size ratchet in `build/shared.js`, and the 2026-08-03 work spent real effort
  converting a Preact component to `dom-chef` to save 416 bytes.
- Its remaining rules (simplicity, layered growth, modularity, long-term
  decisions, study prior art, reuse existing dependencies) either already existed
  in `CLAUDE.md` or are genuine additions, and were merged with the caveats above.

General lesson: adopt external agent guides additively, and check each rule
against this repository's distribution model before accepting it.

## Extension Icon Behavior

Decision: clicking the Chrome extension icon should open/focus Fanfou rather than show a popup.

Reasoning:

- The user wanted a one-click jump to `fanfou.com`.
- A background action launcher is simpler than maintaining a popup UI for this behavior.
