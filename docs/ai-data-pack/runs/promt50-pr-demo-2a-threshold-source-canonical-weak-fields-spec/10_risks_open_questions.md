# Risks And Open Questions

## Risks

- Existing threshold constants are embedded in code, not policy-owned records.
- `SupplierQuote` query reads approval/status candidate fields that are not present in the current schema file.
- `AgentStatement` naming can mislead downstream readers because the schema comments describe payable/settlement semantics rather than pure receivable cash-in.
- Labor overtime remains low-confidence until an approved overtime policy, SLA pressure source, and staff capacity source exist.
- Slow supplier analysis can be medium at best without reliability score, delivery quality notes, and margin/COGS attribution.
- XLSX compatibility is proven for presence/readability, not final spreadsheet-first analysis.

## Open questions for BA

- Who owns each threshold: operations, finance, procurement, HR, or Director?
- Which thresholds may use defaults, and which must block row emission when unconfigured?
- Should threshold changes require approval and effective dates before appearing in Director evidence?
- What is the official terminology boundary between dealer receivable, agent payable, settlement pressure, and collectible cash-in?
- What minimum sample sizes should BA accept for bestseller velocity, supplier reliability, overtime, and receivables aging?
- Should future source registry be code/config first or database-backed after review?

