# Distribution and Developer-mode Storage Notes

Updated: 2026-07-17
Executor: codex
Status: current decision note

## Current Reality

- The original Chrome Web Store listing was removed after its manifest was not updated in time.
- The repository maintainer who accepted the Manifest V3 pull request is not Fanfou official and does not control the removed store listing. Repository maintenance access must not be treated as store publishing access.
- Self-publishing to Chrome Web Store would create a separate extension listing and, by default, a separate extension ID. Existing users of the official listing would not automatically receive this fork.
- The practical distribution path for now is still an unpacked folder loaded through Chrome developer mode.
- The full two-route decision guide, including registration fees, CLI limits and browser-agent boundaries, is in [`docs/distribution-decision-guide.md`](./distribution-decision-guide.md).

## Chrome Web Store Path

Self-publishing is possible, but it should be treated as a separate product/release path. It needs:

- a long-term Chrome Web Store developer account and verified publisher identity;
- a package generated from the current release build;
- a privacy policy and a clear permission/data-use declaration;
- listing assets, screenshots, description, support/contact information, and review-ready release notes;
- clear naming/copy that avoids implying this fork is the official Fanfou-controlled listing unless Fanfou authorizes it;
- a migration plan for users who previously installed a developer-mode copy.

This path is not blocked technically, but it should not be the default next step until export/import and privacy/release documentation are ready.

## Developer-mode Path

Developer-mode folder updates are convenient for testing, but they have a storage risk:

- The current `static/manifest.json` does not define a fixed manifest `key`.
- For unpacked extensions, Chrome can derive the extension ID from the loaded path/key. Loading the next version from a different folder may create a different extension ID.
- `chrome.storage.local` is scoped to the extension. If the ID changes, local records such as avatar match3 results may not follow the user to the new folder.
- Removing the old unpacked extension can also remove its local extension storage.

So the current understanding is correct: match3 records are local storage, and a user who updates by choosing a new folder may lose visible records unless the extension ID is stable or the data is exported/imported.

## Product Decision

Before encouraging broader folder-based updates, add a user-facing export/import path for local data.

Minimum export/import scope:

- avatar match3 records: `avatar-wallpaper/match3Records`;
- user-facing extension settings that are safe to move;
- avatar-wall/cache data only if it is useful and not too large.

Do not export OAuth tokens, cookies, request signatures, private credentials, or browser session material.

Optional future path:

- Add and document a fixed manifest `key` for developer-mode builds so the unpacked extension ID can remain stable across folders.
- Treat that key as release infrastructure: once shared with users, changing it is a migration event.

## Open Decisions

- Whether to add a fixed manifest `key` for developer-mode builds.
- Where export/import should live in the UI: settings page, avatar-wallpaper settings, or a general backup panel.
- Whether this project should pursue a new independent Chrome Web Store listing or remain on the free unpacked-extension plus userscript route.

## References

- Chrome Web Store developer registration: https://developer.chrome.com/docs/webstore/register
- Chrome Web Store review process: https://developer.chrome.com/docs/webstore/review-process/
- Chrome extension storage API: https://developer.chrome.com/docs/extensions/reference/api/storage
- Manifest `key`: https://developer.chrome.com/docs/extensions/reference/manifest/key
