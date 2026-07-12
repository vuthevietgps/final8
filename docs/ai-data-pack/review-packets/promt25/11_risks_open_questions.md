# Risks And Open Questions

Remaining risks:

- Official/partial XLSX rendering is not supported yet.
- Rendered JSON uses existing pack builders and redaction utility; deeper profile-specific row/field shaping can be hardened later.
- Optional schema fields were added without migration; existing records stay compatible.
- Artifact expiration, revocation, and quarantine are not modeled yet.
- Existing rate limits and audit posture remain controlled/internal, not high-volume multi-pod public ready.
- A full manual ChatGPT Web acceptance pass with real local data has not been run in this prompt.

Non-risks preserved:

- No OpenAI upload.
- No action import.
- No approval workflow.
- No dry-run/live execution.
- No provider mutation or validateOnly.
- No tokenized download.
- No public URL or storage path exposure.
- No raw/internal or manifest-only download.
- No Phase 3.
