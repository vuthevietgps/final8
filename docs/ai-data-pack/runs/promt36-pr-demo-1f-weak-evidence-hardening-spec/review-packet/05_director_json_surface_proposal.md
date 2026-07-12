# Director JSON Surface Proposal

Surface proposal file:

`09_director_json_surface_proposal.md`

Compared options:

1. Add evidence rows inside existing relevant sections.
2. Add a new read-only section such as `operational_risk_evidence`.
3. Keep alert labels but add `evidence_detail` rows.

Recommendation:

- Start with Option 3 for an incremental implementation slice.
- Move toward Option 2 if multiple findings use the canonical evidence model.
- Keep all surfaces read-only and non-action.

