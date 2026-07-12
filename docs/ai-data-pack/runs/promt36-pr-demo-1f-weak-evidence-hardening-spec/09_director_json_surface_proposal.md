# Director JSON Surface Proposal

This file compares read-only Director JSON surface options for future implementation. Prompt 36 does not implement any option.

## Option 1 - Add Evidence Rows Inside Existing Relevant Sections

Description:

Place evidence rows under existing sections such as `16_operation_capacity`, `18_alerts`, `19_data_quality`, `20_mapping_report`, inventory, supplier, labor, or finance sections.

Pros:

- Low schema migration risk.
- Keeps evidence near existing Director context.
- Minimal reviewer learning curve.

Cons:

- Evidence can become scattered across sections.
- ChatGPT Web may miss cross-domain patterns.
- Harder to compare all finding evidence in one table.

Migration risk:

- `low` if fields are additive and read-only.

Reviewer clarity:

- `medium`

Recommendation:

- Useful for the first implementation slice when only one or two findings are hardened.

## Option 2 - Add New Read-Only Section `operational_risk_evidence`

Description:

Create one new read-only Director JSON section containing canonical evidence rows for all operational and cross-domain findings.

Pros:

- Clear review surface for ChatGPT Web.
- Easy to validate and test.
- Supports shared evidence row model and common data quality gates.

Cons:

- Requires a new section contract.
- Existing readers must learn one new section.
- Needs careful versioning to avoid becoming action schema.

Migration risk:

- `medium`

Reviewer clarity:

- `high`

Recommendation:

- Best long-term shape for the five weak findings, as long as the section remains explicitly read-only and non-action.

## Option 3 - Keep Alert Labels But Add `evidence_detail` Rows

Description:

Keep current alert labels and attach structured `evidence_detail` arrays to each alert.

Pros:

- Preserves current alert behavior.
- Makes weak alert labels easier to harden incrementally.
- Clear link between alert and supporting evidence.

Cons:

- Alert payloads may become large.
- Reused evidence across findings may duplicate.
- Data quality gates may be inconsistent if not centralized.

Migration risk:

- `low-medium`

Reviewer clarity:

- `medium-high`

Recommendation:

- Good compromise for backward compatibility. If implementation is incremental, use this first; if implementing a fuller evidence model, prefer Option 2.

## Overall Recommendation

For a future read-only implementation slice:

1. Start with Option 3 for one finding to prove evidence detail rows.
2. Move toward Option 2 if multiple findings share evidence model and validation tests.
3. Avoid any action fields, provider operation names, approval transitions, or executable payloads.

