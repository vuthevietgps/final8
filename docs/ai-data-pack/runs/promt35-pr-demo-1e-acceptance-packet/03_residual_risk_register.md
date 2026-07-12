# Residual Risk Register

## Risk 1 - Weak Evidence Findings Need ERP Hardening

risk: Five findings are still supported by weak evidence or alert labels.

severity: `medium`

current mitigation: Prompt 34 created a weak-evidence backlog for exactly the five weak findings.

recommended next branch: `PR-DEMO-1F weak-evidence ERP data hardening spec`

hard ban reminder: Do not open Action Draft Schema, action import, provider execution, or production DB access.

## Risk 2 - Transcript Arithmetic Mismatch

risk: The original transcript prose says `6/6`, while validation table rows parse as `7/5`.

severity: `low`

current mitigation: Prompt 34 documented the mismatch and made validation table rows authoritative.

recommended next branch: No code branch needed; keep mismatch note in evidence.

hard ban reminder: Do not rewrite the original transcript as if it were the ChatGPT Web output.

## Risk 3 - Missing Visible ChatGPT Model Label

risk: The human operator note did not name the visible ChatGPT model label.

severity: `low`

current mitigation: Operator note still records upload method, artifact id, checksum, and safety observations.

recommended next branch: Add model-label capture to future manual loop checklist.

hard ban reminder: Do not infer or invent the model label.

## Risk 4 - Evidence Preservation During Cleanup

risk: Future cleanup may remove or overlook evidence folders.

severity: `medium`

current mitigation: Prompt 34 created `manual-transcript-quality-gate`; Prompt 35 creates this run folder.

recommended next branch: `PR-DEMO-1E reviewer acceptance packet or evidence handoff`

hard ban reminder: Do not move evidence into production runtime paths or commit secrets.

## Risk 5 - Demo Scope Only

risk: Manual ChatGPT Web loop is validated only for demo Director JSON, not production data.

severity: `medium`

current mitigation: Closeout decision explicitly limits acceptance to demo evidence.

recommended next branch: `PR-DEMO-1F production-readiness gap checklist for Director JSON only`

hard ban reminder: Do not use production/server DB, provider mutation, or OpenAI API upload.

