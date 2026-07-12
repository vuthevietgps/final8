# Acceptance Checklist

| Requirement | Status |
|---|---|
| DB-only pre-assessment | PASS |
| `export_cached` never calls adapter | PASS |
| `sync_if_stale` skips fresh covered Google Ads | PASS |
| `sync_if_stale` can call mocked adapter when stale | PASS |
| `sync_required` blocks adapter unavailable/failure | PASS |
| Post-sync DB-only assessment after adapter | PASS |
| Only `google_ads` adapter is callable | PASS |
| Non-Google sources remain DB-only | PASS |
| No false zero source-impact statuses | PASS |
| Narrow internal execute permission used | PASS |
| `google-ads.read` not accepted for execution | PASS |
| Cached ExportJob lifecycle unchanged | PASS |
| Existing GET exports unchanged | PASS |
| No public endpoint/status/download added | PASS |
| No provider mutation/validateOnly | PASS |
| No action import/dry-run/live/OpenAI/Phase 3 | PASS |
| Module-level provider wiring added | NOT IN SCOPE |
