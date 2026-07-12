# 04 Source Sync Policy

Prompt 10 source-sync delegate is reused:

```text
prepareSourcesForExportJob()
```

Mode mapping:

| Mode | Sync policy |
|---|---|
| `official_export` | `sync_required` |
| `partial_export` | `sync_if_stale` |

Safety:

- Cached export still uses `export_cached`.
- Cached export still does not call source sync.
- The lifecycle does not call Google Ads APIs directly.
- Tests use mocked source-sync results for lifecycle behavior.
- No provider mutation or validateOnly flow was added.
