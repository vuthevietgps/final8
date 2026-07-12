# Next Non-Action Branch Options

Only non-action branches are listed here. No provider/action branch is chosen.

## Option A - `PR-DEMO-1F weak-evidence ERP data hardening spec`

Why it matters:

Five findings are currently weak because they depend on alert labels or incomplete underlying detail.

What it would produce:

- A BA/data specification for supplier cost, receivables, inventory bestseller, labor overtime, and supplier reliability evidence.
- No implementation unless approved in a later phase.

Why it does not open Action Draft Schema:

It defines evidence requirements only and does not create executable actions.

What remains forbidden:

- Action Draft Schema
- action import
- provider mutation
- OpenAI API upload
- Phase 3

## Option B - `PR-DEMO-1F cached-export metadata/download hardening spec`

Why it matters:

Earlier prompts documented cached export download metadata as a limitation.

What it would produce:

- A specification for cached export redaction metadata and download acceptance checks.
- No provider execution and no production DB work.

Why it does not open Action Draft Schema:

It is export metadata hardening only.

What remains forbidden:

- Action Draft Schema
- action import
- provider validateOnly/mutation
- live execution
- Phase 3

## Option C - `PR-DEMO-1F production-readiness gap checklist for Director JSON only`

Why it matters:

The current proof is demo-only. A production-readiness checklist can identify non-action gaps before any automation branch.

What it would produce:

- A checklist for redaction, provenance, data quality, schema stability, and reviewer acceptance for Director JSON only.

Why it does not open Action Draft Schema:

It reviews read-only Director JSON readiness and does not define or import actions.

What remains forbidden:

- OpenAI API upload
- provider execution/mutation
- approval workflow
- action import
- Phase 3

