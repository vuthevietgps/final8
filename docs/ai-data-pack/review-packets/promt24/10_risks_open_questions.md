# Risks And Open Questions

Remaining risks:

- Official/partial exports remain not downloadable until a later phase creates actual rendered redacted artifacts.
- The current schema does not model artifact expiration, revocation, or quarantine, so Prompt 24 did not add `410` behavior.
- Rate limits use the existing in-module/cache-manager pattern and are not high-volume multi-pod ready.
- Tenant scoping is represented by current job owner/profile/section checks; no new tenant model was added.
- Stream completion audit is controller-driven after response finish; deeper proxy/storage failure telemetry can be hardened later.

Non-risks preserved:

- No tokenized download.
- No public URL.
- No raw/internal/manifest-only download.
- No OpenAI upload.
- No action import.
- No approval/dry-run/live execution.
- No provider mutation or validateOnly.
- No new provider adapter.
- No Phase 3.
