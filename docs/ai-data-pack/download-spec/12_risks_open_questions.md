# Risks And Open Questions

## Risks

- Official/partial artifacts are currently `manifest_only` with `artifact_rendering=deferred`; they are not download-ready.
- Existing cached artifacts may have physical files, but cached output must be clearly permission-gated and decision-quality-labeled.
- Existing rate limits remain non-atomic under multi-pod concurrency.
- No central immutable cross-domain security ledger exists yet.
- Streaming large XLSX files can consume resources if concurrency controls are weak.
- Tokenized download would add a new replayable credential surface if Option B is implemented too early.
- A broad existing `ai-data-pack.export.download` constant exists; future public implementation must migrate to granular permissions instead of relying on a broad permission.

## Open Questions

- Which tenant/scope field should be canonical for AI Data Pack jobs if multi-tenant support is expanded?
- Which profiles can download cached artifacts versus official/partial artifacts?
- Should cached download be exposed at all, or remain internal/admin only?
- What exact file-size threshold triggers large-file throttling?
- What exact retention and revocation policy applies to rendered downloadable artifacts?
- Should checksum be exposed as `ETag`, `X-AI-Data-Pack-Checksum`, or both?
- What platform decision will resolve atomic distributed download throttling?
- Will a central security ledger become mandatory before broad public download exposure?
- Should future raw evidence packs have a separate policy and route, or remain out of MVP?

## Can Continue

None of these risks block PR-2.3B-5A because this phase is spec-only and explicitly does not implement download.

