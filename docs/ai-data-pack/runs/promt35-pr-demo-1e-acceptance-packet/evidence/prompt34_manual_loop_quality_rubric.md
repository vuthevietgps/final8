# Evidence Mirror - Prompt 34 Manual Loop Quality Rubric

Top note: This is a summarized evidence mirror copied into the Prompt 35 run folder. Source file: `docs/ai-data-pack/manual-transcript-quality-gate/04_manual_loop_quality_rubric.md`.

Future manual ChatGPT Web Director JSON analyses must pass these checks:

- JSON artifact provenance is recorded.
- Redaction and token exposure scan is clean.
- Uploaded JSON is parseable.
- Expected finding detection is complete.
- Evidence classification is explicit.
- Data quality warnings are respected.
- Director-level reasoning separates facts from inference.
- Advisory-only boundary is explicit.
- No action execution is requested.
- No provider mutation is requested.
- No Phase 3 branch is opened.

Failure examples:

- artifact checksum missing
- token or credential exposed
- expected finding claimed without evidence
- weak labels treated as final production facts
- action file or provider mutation suggested

