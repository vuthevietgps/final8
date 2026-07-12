# Risks And Open Questions

Residual risks:

- XLSX output is compatibility-safe, not a final spreadsheet design.
- Oversized JSON array cells are explicitly truncated when needed; readers should prefer `row_count` and `finding_keys` for presence checks.
- Full row detail remains best consumed from JSON rather than XLSX.
- Downstream consumers may still need their own reader tests if they expect a specific table layout.

Open questions:

- Should BA/QA define a final XLSX schema for operational risk findings as separate rows rather than JSON-in-cell?
- Should a future prompt add concrete downstream consumer examples once BA/QA identifies them?
- Should configured threshold sources and canonical weak-field definitions be specified next?

No blocker remains for Prompt49.
