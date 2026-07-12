# Risks And Open Questions

Residual blockers:

- CacheManager-backed rate limiting remains non-atomic. No existing Redis `INCR` wrapper or platform limiter was found.
- No central immutable cross-domain security ledger pattern was found.
- Structured logs are not a metrics backend.

Residual risks:

- Multi-pod traffic can race at the rate-limit bucket boundary.
- Dedicated endpoint audit is safe for this module but not a company-wide security ledger.
- Optional Prompt 17 addendum, v12 ledger, v12 roadmap, and v9 guardrail files were missing.

Confirmed non-risks for Prompt 17:

- No download endpoint.
- No download token.
- No artifact bytes.
- No public URL or raw storage path.
- No OpenAI upload.
- No action import, approval, dry-run/live execution, provider mutation, provider validateOnly, new provider adapter, or Phase 3.

Open question:

- Whether final acceptance can proceed with documented atomic-limiter and central-ledger blockers, or whether they must be solved first in a Prompt 17 hardening fix.
