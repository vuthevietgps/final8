# Risks And Open Questions

Risks:

- No real role binding is approved; implementation must not infer it.
- Retention defaults still need legal/business approval.
- Investor redaction profile needs explicit business approval.
- External consultant data-sharing policy remains business/legal dependent.
- Artifact storage backend and storage-key format are not implemented.
- System internal worker download remains intentionally denied until service audit policy exists.

Open questions:

1. Who approves real permission-to-role bindings?
2. Are 90/30/7-day artifact retention defaults acceptable?
3. Should all downloads be one-time, or can Director artifacts allow limited multi-use?
4. Which finance fields can appear in investor packs as buckets?
5. Which supplier metrics can appear in manager/marketer packs?
6. Do external consultants need downloadable files or view-only access?
7. Who can revoke active download tokens?
