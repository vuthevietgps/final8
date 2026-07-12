# Schema Guard

The guard requires every targeted row to include:

- identity fields
- source fields
- affected entity fields
- metric/threshold/calculation/sample fields
- data-quality/confidence fields
- advisory language
- `not_allowed_actions`

It also checks finding-specific groups for inventory, supplier cost, receivables, labor overtime, and slow supplier good cost signals.
