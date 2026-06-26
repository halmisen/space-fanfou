# Fanfou Ecosystem Research and New Feature Spec

Updated: 2026-06-08T15:56:55+08:00
Executor: codex
Status: draft spec for Claude discussion

## Summary

The best new direction for Space Fanfou is a privacy-first "personal archive +
insights" feature family:

1. Back up my own statuses, photos, and favorites locally.
2. Show lightweight yearly insights, including past-year status count and top
   keywords.
3. Rank top interaction users from replies, mentions, repost targets, and
   favorite authors when data is available.
4. Export the archive as JSON and Markdown, with optional photo download.

This direction fits the current Chrome extension better than another standalone
client because the repo already has:

- MV3 background OAuth signing for `api.fanfou.com`.
- A page-script bridge exposed as `fanfouOAuth.request(...)`.
- `chrome.storage.local` for private, non-synced user data.
- Host permissions for `fanfou.com` and `api.fanfou.com`.

## Evidence Sources

### External Projects

| Project | Open source | Current signal checked | Useful lessons for this spec |
| --- | --- | --- | --- |
| [`fanfoujs/nofan`](https://github.com/fanfoujs/nofan) | Yes, MIT | 47 stars, pushed 2026-05-05, CLI for Fanfou | Mature command surface: timelines, mentions, context, search, post, photo post, reply, repost, multi-account, custom GET/POST API requests. It proves power-user API access is valuable. |
| [`j178/fanfou-cli`](https://github.com/j178/fanfou-cli) | Yes, MIT | 23 stars, last pushed 2017-06-09, Python CLI | Has `fan --dump` to save all statuses as JSON. It proves full personal export is a known user need. |
| [`fanfoujs/fanfou-sdk-node`](https://github.com/fanfoujs/fanfou-sdk-node) | Yes, MIT | 34 stars, pushed 2026-04-11 | Confirms a modern JS SDK shape: OAuth tokens, timeline reads, user reads, photo upload, raw `get/post` API calls, and signature hooks for old Fanfou quirks. |
| [`LitoMore/fanfou-export`](https://github.com/LitoMore/fanfou-export) | Yes, MIT | 31 stars, last pushed 2023-10-10 | Narrow product promise: export all Fanfou statuses. This is exactly the kind of single-purpose value our extension can make easier for browser users. |
| [`Allianzcortex/FF-Backup`](https://github.com/Allianzcortex/FF-Backup) | Yes, Apache-2.0 | 43 stars, last pushed 2018-11-11 | Backup demand exists, but login/OAuth friction can stall standalone tools. A logged-in browser extension has an advantage. |
| [`kingcos/fanfou_backup`](https://github.com/kingcos/fanfou_backup) | Yes, MIT | 3 stars, pushed 2026-06-06 | Recent workflow backs up personal statuses as raw JSON plus images via GitHub Actions. It validates JSON + image backup as a current need, but asks users to manage external secrets. |
| [`mcxiaoke/fanfouapp-opensource`](https://github.com/mcxiaoke/fanfouapp-opensource) | Yes, Apache-2.0 | 450 stars, last pushed 2016-02-06 | Strong historical client, but not a good model for this extension's next step: it is a full Android client, explicitly old and no longer feature-growing. |
| [`riophae/PREFiX`](https://github.com/riophae/PREFiX) | Yes, MIT | 50 stars, last pushed 2020-06-24 | Chrome-client precedent includes favorites view, search, notifications, unread counts, cache controls, image upload, and timeline position. Our extension should avoid reimplementing a full client and focus on archive/insight gaps. |

### API Evidence

Confirmed from `FanfouAPI/FanFouAPIDoc` wiki:

- `GET /statuses/user_timeline.[json|xml|rss]` supports current or target user,
  `since_id`, `max_id`, `count`, `page`, `mode`, and `format`. `count` range is
  1 to 60.
- `GET /favorites/id.[json|xml|rss]` supports target user, `count`, `page`,
  `mode`, and `format`. `count` range is 1 to 60.
- `GET /statuses/mentions.[json|xml|rss]` and `GET /statuses/replies.[json|xml|rss]`
  support pagination by `since_id`, `max_id`, `count`, and `page`.
- `GET /photos/user_timeline.[json|xml|rss]` supports user photo status
  pagination with the same 1 to 60 `count` range.
- `GET /statuses/show.[json|xml|rss]` returns status fields including `created_at`,
  `id`, `rawid`, `text`, `source`, reply fields, repost fields, `favorited`,
  `user`, and optional `photo`.

API docs repository: <https://github.com/FanfouAPI/FanFouAPIDoc>

### Local Repo Evidence

- OAuth bridge: `src/background/environment/fanfouOAuth.js`
  - Stores tokens under `fanfou-oauth/tokens` in `chrome.storage.local`.
  - Allows signed requests only to `https://api.fanfou.com`.
  - Applies the known Fanfou OAuth signature workaround: sign as `http://...`,
    fetch as `https://...`.
- Page module: `src/page/modules/fanfouOAuth.js`
  - Exposes `fanfouOAuth.request(args)` to page features through bridge messages.
- Manifest: `static/manifest.json`
  - Already has `storage`, `identity`, and Fanfou/API host permissions.
- Existing feature precedent:
  - `sidebar-statistics` already uses OAuth API user data.
  - `avatar-wallpaper` already stores local records in `chrome.storage.local`.

## Product Goal

Give Fanfou users a one-click personal archive and a small, delightful annual
review inside the extension, without requiring a server, GitHub secrets, or a
separate CLI.

This should feel like:

- "I can finally keep my own Fanfou data."
- "I can see what I wrote most about this year."
- "I can find the people I interacted with most."
- "I can export everything before changing computers or extension IDs."

## Non-Goals

- Do not build a complete Fanfou client inside the extension.
- Do not add a server-side sync service.
- Do not ask users to paste account passwords.
- Do not scrape private data from users the current account cannot access.
- Do not make AI summaries part of MVP; keyword extraction should be local and
  deterministic.

## Proposed Feature Family

Feature directory name: `personal-archive`

Settings label: `个人归档与年度回顾`

Default: off for automatic scheduled sync; manual export buttons visible after
OAuth authorization.

### 1. Local Status Archive

MVP:

- Add a settings-panel action: `同步我的饭否消息`.
- Fetch current user's own timeline using `statuses/user_timeline.json`.
- Use `count=60`, `page=N` for initial import.
- Stop when:
  - API returns an empty page,
  - oldest fetched status is older than requested date range,
  - or user cancels the job.
- Store normalized statuses in `chrome.storage.local`.
- Deduplicate by status `id`.
- Keep a small sync cursor:
  - newest imported `id`
  - oldest imported `id`
  - newest `rawid`
  - last sync time
  - last completed page count

Recommended storage keys:

```text
personal-archive/meta
personal-archive/statuses/<statusId>
personal-archive/index/by-created-month/<YYYY-MM>
personal-archive/jobs/current
```

Open issue for implementation: `chrome.storage.local` is convenient but not
ideal for many large records. If real archive size is large, use IndexedDB for
statuses/photos metadata and keep only job metadata in `chrome.storage.local`.

### 2. Past-Year Status Count

MVP:

- Compute from local archive only.
- Date window: last 365 days by default.
- Show:
  - total statuses
  - text-only statuses
  - photo statuses
  - reposts
  - replies
  - monthly histogram

Definition:

- `photo status`: status has `photo`.
- `reply`: `in_reply_to_status_id` or `in_reply_to_user_id` is present.
- `repost`: `repost_status_id` or `repost_user_id` is present.

Do not present this as complete until archive coverage includes the full date
window. The UI should say `已覆盖 2025-06-09 至 2026-06-08` or similar.

### 3. Keyword Insights

MVP:

- Extract keywords locally from archived status `text`.
- Remove:
  - URLs
  - `@username`
  - Fanfou status links
  - common punctuation
  - a small Chinese stopword list
- Count:
  - hashtags/topics if Fanfou topic syntax is detected
  - Chinese 2-4 character phrases by simple segmentation fallback
  - English/alphanumeric words length >= 2
- Show top 20 keywords for:
  - past 365 days
  - all archived data
  - selected year

Implementation guidance:

- Start with deterministic extraction; no external NLP dependency in MVP.
- Add an internal stopword file under the feature directory.
- Allow users to hide individual keywords locally.

### 4. Top Interaction Users

MVP should be honest about what "interaction" means. Use a score assembled from
available fields:

| Signal | Source | Weight | Notes |
| --- | --- | ---: | --- |
| I replied to user | own statuses: `in_reply_to_user_id` | 3 | Strong direct interaction. |
| I reposted user | own statuses: `repost_user_id` | 2 | Strong public interaction. |
| User mentioned me | `statuses/mentions` archive: `user.id` | 2 | Requires mentions sync. |
| User replied to me | `statuses/replies` archive: `user.id` | 3 | Requires replies sync. |
| I favorited user's status | favorites archive: `status.user.id` | 1 | Interest signal, not direct conversation. |

Output:

- Top 10 users for past 365 days.
- Top 10 users for all archived data.
- For each user:
  - avatar
  - display name
  - user id
  - score
  - signal breakdown
  - link to `https://fanfou.com/<id>`

Important limitation:

- Fanfou API status objects do not expose every possible social action. This
  feature is an approximation from archiveable replies, mentions, reposts, and
  favorites. The UI must label it `互动估算 Top 10`, not `互动 Top 10`.

### 5. Favorites Export

MVP:

- Add action: `下载我的收藏`.
- Fetch `favorites/<myUserId>.json` page by page with `count=60`.
- Save:
  - raw JSON
  - Markdown file
  - optional image folder for `photo.largeurl` / `photo.imageurl`

Markdown format:

```markdown
# Fanfou Favorites Export

Generated: 2026-06-08T15:56:55+08:00
Account: @example
Count: 1234

## 2026-06

### 2026-06-08 12:34 - @user

Status URL: https://fanfou.com/statuses/<id>

消息正文

![photo](images/<id>.jpg)
```

Download packaging options:

- MVP: `favorites.json` and `favorites.md` using `chrome.downloads`.
- Phase 2: zip bundle with images. This requires adding the `downloads`
  permission and a zip library, or generating a static HTML export with linked
  downloaded images.

Current manifest does not include `downloads`, so MVP either:

- uses browser-generated object URLs and `<a download>` from the settings page,
- or explicitly adds `downloads` in the implementation plan.

### 6. Photo Backup

MVP:

- Store photo metadata in the archive.
- Export Markdown references to original image URLs.

Phase 2:

- Optional `下载图片` job.
- Download only images attached to own statuses and favorites.
- Deduplicate by URL.
- Save files as:

```text
images/<statusId>-thumb.jpg
images/<statusId>-large.jpg
```

Risk:

- Browser extensions may not be able to choose nested folders reliably without
  `downloads` permission and user prompts. Keep image download optional.

## User Stories

1. As a long-time Fanfou user, I want to back up all my own statuses so that I
   do not lose personal history.
2. As a user preparing a year-end review, I want to know how many statuses I
   posted in the past year and what I talked about most.
3. As a social user, I want to see my estimated top interaction users so that I
   can rediscover important relationships.
4. As a collector, I want one-click export of favorites to Markdown so that my
   saved posts are readable outside Fanfou.
5. As a developer-mode extension user, I want export/import for archive data so
   changing extension folders or IDs does not make my data disappear.

## UX Placement

Settings page:

- Add a new tab under tools: `归档`
- OAuth status card at top:
  - Authorized account
  - Last sync
  - Archive coverage
  - Storage size estimate
- Primary actions:
  - `同步最近一年`
  - `同步全部`
  - `下载我的收藏`
  - `导出归档`
  - `导入归档`
- Read-only insights:
  - Past-year count
  - Top keywords
  - Estimated interaction Top 10

Fanfou page:

- Optional sidebar mini card on own profile only:
  - `今年发饭 N 条`
  - `年度关键词`
  - link to full archive panel

## Data Model

Normalized status:

```json
{
  "id": "status id",
  "rawid": 123456,
  "created_at": "Wed Nov 09 07:15:21 +0000 2011",
  "createdAtISO": "2011-11-09T07:15:21.000Z",
  "text": "message text",
  "source": "web",
  "favorited": false,
  "in_reply_to_status_id": "",
  "in_reply_to_user_id": "",
  "in_reply_to_screen_name": "",
  "repost_status_id": "",
  "repost_user_id": "",
  "repost_screen_name": "",
  "user": {
    "id": "user id",
    "screen_name": "screen name",
    "name": "display name",
    "profile_image_url": "url"
  },
  "photo": {
    "thumburl": "url",
    "imageurl": "url",
    "largeurl": "url"
  },
  "archiveSource": "own_timeline|favorites|mentions|replies|photos",
  "archivedAt": "2026-06-08T15:56:55+08:00"
}
```

Archive meta:

```json
{
  "schemaVersion": 1,
  "account": {
    "id": "current user id",
    "screenName": "current screen name"
  },
  "coverage": {
    "ownTimeline": {
      "newestCreatedAt": "ISO date",
      "oldestCreatedAt": "ISO date",
      "lastFullSyncAt": "ISO date"
    },
    "favorites": {},
    "mentions": {},
    "replies": {}
  },
  "counts": {
    "statuses": 0,
    "favorites": 0,
    "mentions": 0,
    "replies": 0,
    "photos": 0
  }
}
```

## Implementation Plan

### Phase 1: Archive Foundation

Files likely to change:

- `src/features/personal-archive/metadata.js`
- `src/features/personal-archive/archive@page.js`
- `src/features/personal-archive/archiveStore.js`
- `src/features/personal-archive/fanfouArchiveClient.js`
- `src/settings/components/...` or existing settings tab wiring

Acceptance:

- OAuth-authorized user can sync recent own statuses.
- Local archive deduplicates statuses by id.
- UI shows coverage and sync status.
- Export JSON works.

### Phase 2: Insights

Acceptance:

- Past-year status count is computed from archive.
- Monthly histogram is computed.
- Keyword top 20 is computed locally.
- UI marks incomplete coverage clearly.

### Phase 3: Favorites Markdown Export

Acceptance:

- User can fetch favorites by page.
- Export includes raw JSON and Markdown.
- Markdown groups by month and links back to original Fanfou statuses.
- Photo URLs are included even before binary image download exists.

### Phase 4: Interaction Top 10

Acceptance:

- Sync mentions and replies.
- Compute top users from reply/repost/mention/favorite-author signals.
- UI shows score breakdown and calls it an estimate.

### Phase 5: Optional Image Bundle

Acceptance:

- User can opt into downloading attached images.
- Download job deduplicates URLs and records failed downloads.
- No image download runs without explicit user action.

## Privacy and Safety

- Store all archive data locally by default.
- Do not sync archive data through `chrome.storage.sync`.
- Do not send archive data to any server.
- Do not store passwords.
- Do not auto-download images without user action.
- Add export/import before encouraging developer-mode folder changes because
  extension ID changes can strand `chrome.storage.local` data.
- Add a clear delete button: `删除本地归档`.

## Risks

1. API completeness:
   - Full historical pagination may be slow or rate-limited.
   - Mitigation: chunk jobs, save cursors, resume safely, expose coverage.
2. Storage size:
   - Large archives may exceed comfortable `chrome.storage.local` usage.
   - Mitigation: prefer IndexedDB once archive size passes prototype threshold.
3. OAuth fragility:
   - Existing implementation relies on old Fanfou OAuth behavior and built-in
     nofan key fallback.
   - Mitigation: reuse the existing bridge and do not introduce new auth paths.
4. Export UX:
   - Downloading many files from an extension may need extra permissions.
   - Mitigation: MVP exports JSON/Markdown first; images later.
5. Interaction accuracy:
   - API fields only expose partial social signals.
   - Mitigation: label ranking as an estimate and show signal breakdown.

## Open Questions for Claude Discussion

1. Should archive storage start with `chrome.storage.local` for speed, or go
   straight to IndexedDB to avoid migration work?
2. Should `downloads` permission be added now, or deferred until image bundle
   export?
3. Should the first UI live entirely in settings, or should own profile pages
   get a small annual-review card in Phase 2?
4. Should `personal-archive` be one large feature module or split into
   `archive-export`, `annual-review`, and `favorites-export` modules?
5. Should Markdown export preserve Fanfou HTML links via `format=html`, or keep
   plain text plus explicit source URLs?

## Recommended MVP Contract

Build Phase 1 and Phase 2 together:

- Manual `同步最近一年`.
- Local normalized archive.
- JSON export/import.
- Past-year count.
- Keyword top 20.
- Coverage display.

Then build favorites Markdown export as the next independent vertical slice.

Reasoning:

- The yearly stats and keyword ideas require the same archive base.
- Export/import reduces the current developer-mode storage risk.
- Favorites export can be delivered after the archive store is proven.
