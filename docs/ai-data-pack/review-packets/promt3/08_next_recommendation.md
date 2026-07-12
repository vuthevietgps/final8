# Next Recommendation

Do not auto-code PR-2.3B yet.

Recommended sequence:

1. ChatGPT Web Pro Extended reviews PR-2.3A.
2. Director/BA approves source criticality, thresholds, official-block policy, RBAC and retention.
3. Implement PR-2.3B-1: ExportJob plus cached-export wrapper only.
4. Implement PR-2.3B-2: code allowlist source registry plus DB-only freshness/coverage gate.
5. Review and approve separately before implementing PR-2.3B-3 Google Ads read-only adapter.

Suggested next prompt: authorize PR-2.3B-1 only, with cached mode, no provider calls, no action/import/dry-run/live flow, focused tests and a reviewer packet.

Do not include Meta/TikTok/Zalo orchestration, external accounting, provider mutation, sheet writes, payment/settlement mutation, OpenAI/upload work or Phase 3.
