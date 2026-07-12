# Freshness Gate Spec

All thresholds are proposed defaults pending Director/BA approval.

| source | fresh up to | hard stale | official impact when stale/missing | partial export |
|---|---:|---:|---|---|
| Google Ads | 60m | 180m | block configured critical ads pack; no scale | allow with warning |
| Meta/TikTok Ads | 180m | 720m | block when active/critical; no channel scale | allow |
| Zalo Ads | n/a | n/a | unsupported/not configured; never fresh | allow if optional |
| Advertising costs | 360m | 1440m | block strong ads/profit conclusion | allow |
| CRM leads | 120m | 480m | block strong sales conclusion | allow |
| Orders | 60m | 240m | `can_conclude_profit=false`; no strong operations | allow |
| Payments | 120m | 720m | no strong realized profit/cash | allow |
| Finance/cashflow | 60m | 240m | block Director budget/cash decisions | strong warning only |
| Loans/debt | 1440m | 2880m | block when stale or schedule incomplete | allow |
| Supplier/tier-2 settlement | 1440m | 2880m | proposed block on strong margin/scale, needs approval | allow |
| Product mapping | 1440m | 4320m | block scale if stale/incomplete | allow |
| Operations | 120m | 480m | no strong capacity conclusion | allow |
| Returns | 1440m | 2880m | no strong return-adjusted conclusion | allow |
| Decision history | 1440m | 4320m | warning unless governance review requested | allow |

Gate evaluation order:

1. Resolve required sources for requested packs.
2. Check configuration/support state.
3. Read last successful sync/local watermark.
4. Check requested report-date/range coverage.
5. Compare against approved threshold.
6. Run only approved allowlisted read-only adapters when policy permits.
7. Re-check freshness/coverage.
8. Apply export and decision gates.

Required distinctions:

- `not_configured` is not a failure only for an approved optional source.
- `unsupported`, `unknown`, `missing`, `stale` and `failed` are never fresh.
- A recent timestamp with no requested-date rows does not pass.
- Fresh data can still fail mapping/completeness gates.
- Provider failure preserves the last known watermark but records the failure separately.
