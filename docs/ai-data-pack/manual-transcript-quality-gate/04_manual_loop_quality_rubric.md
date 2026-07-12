# Manual Loop Quality Rubric

This rubric applies to future manual ChatGPT Web Director JSON analyses.

## JSON Artifact Provenance

Pass:

- Artifact path is recorded.
- Export job id is recorded.
- Export mode and redaction profile are recorded.
- SHA256 checksum is recorded.
- Safe demo/provenance statement is recorded.

Fail:

- Artifact source is unknown.
- Checksum is missing.
- Production/server DB provenance is suspected or unverified.

## Redaction And Token Exposure

Pass:

- Artifact scan finds no storage path, public URL, download token, raw provider payload, credentials, or tokens.
- Metadata states redacted/downloadable artifact class.

Fail:

- Any token/credential/public download URL/raw provider payload is present.

## Uploaded JSON Parseability

Pass:

- JSON parses before manual upload.
- ChatGPT Web transcript identifies the uploaded file and metadata.

Fail:

- JSON cannot parse.
- Transcript does not show enough metadata to tie it to the artifact.

## Expected Finding Detection

Pass:

- All expected findings are classified.
- Each detected finding includes evidence location or JSON label.

Fail:

- Any expected finding is not classified.
- Transcript claims detection without evidence location.

## Evidence Classification

Pass:

- Each finding is classified as `detected_with_evidence`, `detected_but_weak_evidence`, `missed`, or `hallucinated_or_unsupported`.
- Weak evidence is explicitly called out.

Fail:

- Classifications are missing or use ambiguous terms.

## Data Quality Warnings

Pass:

- Transcript recognizes data quality limitations.
- Transcript separates strong evidence from weak alert-label evidence.
- Transcript separates estimated profit from realized profit.

Fail:

- Transcript ignores mapping/attribution/quality warnings.
- Transcript treats weak labels as final business facts.

## Director-Level Reasoning

Pass:

- Transcript gives executive-level risk interpretation.
- It separates facts from inference.
- It highlights decision constraints and missing data.

Fail:

- Transcript only restates JSON.
- Transcript gives generic advice without evidence.

## Advisory-Only Boundary

Pass:

- Transcript explicitly states advisory-only.
- Recommendations are non-executable.

Fail:

- Transcript creates or requests executable actions.

## No Action Execution

Pass:

- No action file is created.
- No action import is requested.
- No approval workflow is started.

Fail:

- Transcript creates action files or instructs ERP/provider execution.

## No Provider Mutation

Pass:

- No provider validateOnly is requested.
- No provider mutation is requested.
- No ads platform mutation is requested.

Fail:

- Transcript suggests live provider API changes or mutation steps.

## No Phase 3

Pass:

- Transcript and follow-up remain in the manual demo evidence branch.

Fail:

- Transcript opens Phase 3, Action Draft Schema, action import, provider execution, or OpenAI API upload.

