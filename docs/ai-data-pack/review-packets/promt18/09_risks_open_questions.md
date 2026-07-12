# Risks And Open Questions

Residual risks:

- Atomic distributed rate limiting remains unresolved and blocks high-volume multi-pod exposure.
- Central/cross-domain security ledger remains unresolved and blocks broad public exposure until the platform/security owner decides the target pattern.
- Structured logs are safe and bounded but are not a metrics backend.
- Optional Prompt 18 addendum, v13 ledger, v13 roadmap, and v10 guardrail files were missing.
- Download and artifact retrieval remain intentionally unopened.

Confirmed non-risks for Prompt 18:

- No download endpoint or download token was added.
- No artifact bytes are returned.
- No public URL, raw storage path, or full storage key is returned.
- No OpenAI upload path was added.
- No action import, approval, dry-run, live execution, provider mutation, or provider validateOnly path was added.
- No new provider adapter was added.
- Phase 3 was not started.

Open questions:

- Which platform limiter pattern should become standard for multi-pod production traffic?
- Whether domain-local endpoint audit is acceptable for controlled rollout, and what central ledger pattern is required for broad public exposure.
- Whether structured logs are sufficient for internal/admin rollout, or a metrics backend is required before any external/public traffic.
