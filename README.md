# Obsidian Wallabag Plugin

This plugin syncs a self-hosted [Wallabag](https://www.wallabag.it/en) account with [Obsidian](https://obsidian.md). It now supports bidirectional workflows: pull articles into notes, push new URLs from watched notes, and sync frontmatter state changes back to Wallabag.

## What v1 adds

- **Pull sync** for unread and/or archived Wallabag entries
- **Push new** from daily notes, clipper-tagged notes, or the active note
- **Push frontmatter** for `read`, `starred`, and `tags`
- **Watcher-driven sync** for timers, daily notes, clipper notes, and linked-note edits
- **Headless support** via `settings.json` and command-driven auth/sync
- **Dry-run remote writes by default** until you enable `push.enableRemoteWrites`

## Authentication

You need a Wallabag server URL, client ID, client secret, username, and password.

You can authenticate in two ways:

1. Run **`Wallabag: Authenticate (interactive)`** and enter credentials in the modal.
2. Fill `settings.json` and run **`Wallabag: Authenticate (from settings.json)`**.

Wallabag token data is stored in:

- `.__wallabag_token__`

## Settings model

The plugin mirrors configuration between Obsidian's `data.json` and:

- `[VAULT]/.obsidian/plugins/wallabag/settings.json`

`settings.json` is the authoritative headless-editable file. The settings tab edits the same data.

Important defaults:

| Setting | Default | Notes |
| --- | --- | --- |
| `pull.enabled` | `true` | Enables pull commands and timer pulls |
| `push.enableRemoteWrites` | `false` | Mutating API calls stay in dry-run until enabled |
| `push.pushDebounceMs` | `2000` | Debounce for watcher-triggered pushes |
| `folders.notes` | `Wallabag` | Default folder for pulled notes |
| `folders.attachments` | `Attachments/Wallabag` | Downloaded article images |
| `watchers.dailyNotesHarvest.tagOnSubmit` | `["from-daily-note"]` | Tags added to harvested URLs |
| `watchers.clipperBridge.clipperTag` | `clippings` | Tag used to detect clipper notes |

## Commands

Every action is exposed as an Obsidian command.

| Command ID | Display name |
| --- | --- |
| `wallabag:sync-pull` | Wallabag: Pull articles from server |
| `wallabag:sync-push-new` | Wallabag: Push new content to server |
| `wallabag:sync-push-frontmatter` | Wallabag: Push frontmatter state to server |
| `wallabag:sync-bidirectional` | Wallabag: Full bidirectional sync |
| `wallabag:push-current-note` | Wallabag: Push current note to server |
| `wallabag:harvest-daily-notes` | Wallabag: Harvest URLs from daily notes |
| `wallabag:authenticate-interactive` | Wallabag: Authenticate (interactive) |
| `wallabag:authenticate-headless` | Wallabag: Authenticate (from settings.json) |
| `wallabag:logout` | Wallabag: Logout |
| `wallabag:clear-synced-cache` | Wallabag: Clear synced-articles cache |
| `wallabag:delete-and-forget` | Wallabag: Delete note and remove from synced cache |
| `wallabag:dump-state` | Wallabag: Write state snapshot to disk |

## Frontmatter contract

Pulled notes use frontmatter as the sync layer. These fields matter most:

```yaml
---
wallabag_id: 123
wallabag_url: https://wallabag.example.com/view/123
source_url: https://example.com/article
given_url: https://example.com/article
tags:
  - reading
read: false
starred: false
date_added: 2026-04-18T12:00:00Z
date_read: null
published_at: 2026-04-10T00:00:00Z
wallabag_last_synced: 2026-04-19T09:00:00Z
clipper_source: https://example.com/article
---
```

Writable fields:

- `tags`
- `read`
- `starred`

If Wallabag has changed remotely after `wallabag_last_synced`, local frontmatter pushes are skipped and reported as conflicts.

## Templating

Built-in templates create markdown notes or PDF-link notes. You can also point `template.path` at a custom markdown file.

Available variables:

| Variable | Description |
| --- | --- |
| `{{frontmatter}}` | Canonical Wallabag frontmatter block |
| `{{id}}` | Wallabag entry ID |
| `{{article_title}}` | Article title |
| `{{original_link}}` | Source URL |
| `{{given_url}}` | Submitted URL |
| `{{created_at}}` | Wallabag creation timestamp |
| `{{published_at}}` | Published timestamp |
| `{{updated_at}}` | Last Wallabag update timestamp |
| `{{wallabag_link}}` | Wallabag entry URL |
| `{{content}}` | Article content after attachment rewriting / markdown conversion |
| `{{pdf_link}}` | Exported PDF path when PDF export is enabled |
| `{{tags}}` | Tags rendered in the configured tag format |
| `{{reading_time}}` | Reading time |
| `{{preview_picture}}` | Preview image URL |
| `{{domain_name}}` | Domain name |
| `{{annotations}}` | Pulled Wallabag annotations |
| `{{is_archived}}` / `{{read}}` | Read/archive state |
| `{{is_starred}}` / `{{starred}}` | Starred state |
| `{{date_read}}` | Archived timestamp when available |

If `template.emitFullFrontmatter` is enabled, the plugin prepends canonical frontmatter unless the template already inserts `{{frontmatter}}`.

## Watchers

### Linked note watcher

When `watchers.vaultFileWatcher` is enabled, edits to linked-note frontmatter are debounced and reconciled back to Wallabag.

### Daily notes

When `watchers.dailyNotesHarvest.enabled` is enabled and the core Daily Notes plugin is active, the plugin watches the Daily Notes folder, extracts URLs, submits unseen ones, and marks processed lines with:

```text
— wallabag'd
```

### Clipper bridge

When `watchers.clipperBridge.enabled` is enabled, newly created notes tagged with `watchers.clipperBridge.clipperTag` are treated as push candidates.

## Attachments

If `attachments.download` is enabled, article images are downloaded into:

- `[VAULT]/Attachments/Wallabag/<wallabag_id>/...`

The plugin rewrites article content to point to local files and can emit markdown wikilinks for downloaded images.

## Headless usage

Example `settings.json`:

```json
{
  "$schemaVersion": 1,
  "server": {
    "url": "https://wallabag.example.com",
    "clientId": "client-id",
    "clientSecret": "client-secret"
  },
  "auth": {
    "username": "me",
    "password": "secret",
    "storeCredentials": false
  },
  "push": {
    "enableRemoteWrites": false,
    "pushNewContent": true,
    "pushFrontmatterUpdates": true,
    "pushDebounceMs": 2000,
    "onLocalDelete": "ignore"
  },
  "timer": {
    "enabled": true,
    "intervalMinutes": 30,
    "runOnStartup": false
  }
}
```

Typical command flow:

```bash
obsidian command id="wallabag:authenticate-headless"
obsidian command id="wallabag:sync-bidirectional"
obsidian property:set path="Wallabag/Some article.md" name="read" value="true"
obsidian command id="wallabag:sync-push-frontmatter"
```

## Installation

### Manually

- You need Obsidian v1.12.2+.
- Download the latest release.
- Create `[VAULT]/.obsidian/plugins/wallabag`.
- Copy `main.js`, `manifest.json`, and `styles.css` into that folder.
- Reload Obsidian and enable the plugin.

## Development

### Workflow

- `npm install`
- `npm run build`
- `npm run lint`
- Copy the built plugin files into your vault's plugin directory
- Reload the plugin in Obsidian

### State files

Relative to `[VAULT]/.obsidian/plugins/wallabag`:

- `.synced` — pulled article IDs
- `.dedup.json` — normalized URL dedup cache for push-new flows
- `.dry-run.log` — logged remote mutations while writes are disarmed
- `.wallabag-debug.json` — state dump from `wallabag:dump-state`
- `.__wallabag_token__` — stored Wallabag token
