# Risks And Open Questions

Risks:

- Freshness thresholds still need Director/BA approval.
- Supplier settlement criticality remains policy-pending.
- Employee/payroll data is unsupported and sensitive.
- Investor redaction profile is not approved.
- Public endpoint and artifact download surface may need a separate RBAC spec.
- Retention defaults need legal/business approval before implementation.
- Google Ads customer scope discovery is not defined here.

Open questions:

1. Should official export block completely or allow audited downgrade by default?
2. Which Director/BA exemptions can allow official export with weak non-core sources?
3. What retention period is acceptable for PII-containing artifacts?
4. Can managers create partial Marketer exports, or only Director?
5. What exact investor data profile is allowed?
6. When supplier settlement is stale, should product/supplier allocation be blocked or only warned?
7. Which finance fields must be redacted from Marketer and investor packs?
