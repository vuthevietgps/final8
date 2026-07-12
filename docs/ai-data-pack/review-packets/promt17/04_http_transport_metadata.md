# HTTP Transport Metadata

Prompt 17 added sanitized request context capture:

- `backend/src/ai-data-pack/audit/export-endpoint-request-context.ts`
- Controller wiring in `backend/src/ai-data-pack/export-jobs/export-job-endpoint.controller.ts`
- Persistent fields in `backend/src/ai-data-pack/audit/export-endpoint-audit.schema.ts`

Captured fields:

- `requestId`
- `correlationId`
- `routeTemplate`
- `method`
- `ipHash`
- `userAgentHash`

Safety rules:

- Static route templates are used.
- Raw request body is not passed.
- Raw headers are not persisted.
- Raw IP is not persisted.
- Raw user-agent is not persisted.
- IP and user-agent are SHA-256 hashed before persistence.

Tests verify:

- Metadata appears on persistent endpoint audit.
- Raw IP/user-agent/header/body strings are absent.
- Transport hash fields stay bounded and sanitized.
