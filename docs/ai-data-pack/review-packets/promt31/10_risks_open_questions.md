# 10 Risks Open Questions

Risks and open questions:

- The successful export smoke run used compiled `backend/dist` in a minimal Nest context because source `ts-node` runtime failed on Mongoose schema metadata for union fields.
- `cached_export` completed but direct download was denied because cached jobs do not currently persist `redactionProfile`.
- The successful artifact used `partial_export`, not `official_export`, to keep provider sync optional and avoid provider calls.
- Three seeded demo findings are not surfaced by the current Director JSON export.
- The finance context in the minimal smoke harness reads local demo collections directly instead of loading the full FinanceModule.

No production DB or provider API was used.

