# Risks And Open Questions

Risks:

- A real human ChatGPT Web upload output transcript is not attached.
- The repo has no configured `backend/test/jest-e2e.json` harness.
- Partial JSON has service-level render readiness evidence and shared endpoint gate evidence, but no separate named partial-download smoke command.
- XLSX official/partial rendering remains unsupported; not required for Prompt 26.
- Artifact expiration, revocation, and quarantine states are not modeled.
- Current rate limit/audit posture remains internal acceptance grade, not high-volume multi-pod public grade.

Preserved safety:

- No OpenAI upload.
- No OpenAI API call.
- No action import.
- No approval workflow.
- No dry-run/live execution.
- No provider mutation.
- No provider `validateOnly`.
- No tokenized download.
- No public/signed URL.
- No Phase 3.

