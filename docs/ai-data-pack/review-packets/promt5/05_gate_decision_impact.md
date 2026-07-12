# Decision Gate Impact

Strong decisions require both:

```text
freshnessStatus=fresh
coverageStatus=covered|not_applicable
```

Rules:

- Ads scale: Google Ads + advertising costs + product mapping.
- Strong profit: orders + order-payment evidence + advertising costs.
- Sales today: CRM leads.
- Strong finance: finance + loans/debt.
- Strong LTV: customer referral + product mapping.

Safety invariants:

```text
canGenerateActionDraft=true
canImportActionFile=false
canDryRun=false
canExecuteLive=false
```

Strong LTV remains false while customer referral is unsupported. No executable action is created.
