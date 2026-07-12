# Security and Permission Review

## Current State

- Existing RBAC grants pack read permissions.
- There are no export-job create/read/download/sync-detail permissions.
- Director reads all current packs; Manager reads marketer/quality/mapping; Investor reads director/quality/mapping.
- Investor/Manager access requires re-review before sensitive supplier, commission, payroll or detailed finance sections are added.

## Proposed Permissions

- `ai-data-pack.export.cached.create`
- `ai-data-pack.export.partial.create`
- `ai-data-pack.export.official.create`
- `ai-data-pack.export.job.read`
- `ai-data-pack.export.download`
- `ai-data-pack.export.sync-detail.read`
- `ai-data-pack.source-sync.readonly.execute`

Recommended:

- Official export: Director and explicitly approved technical admin.
- Partial export: Director/Manager subject to requested pack permission.
- Cached export: technical/admin and approved reviewers.
- Read/download: requester plus Director/admin, intersected with pack permission.
- Sync failure detail: restricted sanitized view.

## Required Controls

- Immutable export audit: actor, role, request, policy version, source results, files/checksums and timestamps.
- Section-level RBAC before sensitive new sections.
- Never log or return secret, API key, refresh token, credential, authorization header, raw provider body, stack trace or unnecessary PII.
- The orchestrator may inject only narrow allowlisted adapters.
- Server enforces read-only provider sync and `live_execution=false`; clients cannot override it.
- No pre-export path may call action validation/execution, auto-control, sheet write, payment/settlement mutation or order recalculation.
