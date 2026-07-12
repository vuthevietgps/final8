# Download Authorization And Expiry

Policy:

- Use a short-lived download token.
- Recommended expiry: 15 minutes.
- Default token mode: one-time use.
- Multi-use requires explicit policy, max-use count, and audit reason.

Authorization checks:

1. Requester match or delegated permission.
2. `ai-data-pack.export.artifact.download`.
3. Redaction profile matches artifact manifest.
4. Artifact is not expired.
5. Token is not expired, revoked, or consumed.
6. Artifact has not been deleted.

Forbidden:

- Public unauthenticated links.
- Permanent links.
- Download without audit.
- Download ignoring redaction profile.
- System worker download without separate service audit policy.
