# Denial Behavior

The public endpoint denial posture remains fail-closed.

Confirmed behavior:

- Unauthorized create requests are denied.
- Missing or unknown jobs do not expose whether an export job exists.
- Non-readable jobs and unknown jobs return indistinguishable public status responses.
- Denied sync-summary responses do not leak source, manifest, storage, or execution details.
- Denied detail responses do not expose audit existence or internal job details.
- Denials are audited persistently where endpoint audit persistence is configured.

Safety properties:

- Public denials do not expose artifact bytes.
- Public denials do not expose download tokens.
- Public denials do not expose public URLs or storage locations.
- Public denials do not expose provider validateOnly or mutation state.
- Public denials do not expose OpenAI upload/action-import state.

Acceptance tests were added to cover jobless denied create, unknown-vs-unreadable job behavior, denied sync-summary safety, and denied detail safety.
