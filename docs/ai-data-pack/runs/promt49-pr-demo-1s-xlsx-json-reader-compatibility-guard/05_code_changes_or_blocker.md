# Code Changes Or Blocker

Status: implemented_reader_compatibility_guard

Blocker: none.

Changed files:

- `backend/src/ai-data-pack/export/xlsx-exporter.service.ts`
- `backend/src/ai-data-pack/ai-data-pack.service.spec.ts`

Exporter changes:

- Added Excel text limit guard.
- Added explicit truncation marker for oversized cell text.
- Changed nested object handling from stringify-one-cell to recursive dotted-column flattening.
- Added `row_count` metadata for arrays.
- Added `finding_keys` metadata for arrays containing `finding_key`.

Test changes:

- Extended the existing hardened operational risk guard to pass the nested Director section through `XlsxExporterService`.
- Asserted XLSX output preserves operational risk finding evidence columns and all five finding keys.

Business logic changed: false.

Director section contract changed: false in Prompt49.

Operational risk query changed: false.

No production/server database was used.
