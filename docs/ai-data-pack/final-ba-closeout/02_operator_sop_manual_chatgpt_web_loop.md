# Operator SOP - Manual ChatGPT Web Loop

Use this SOP for the current accepted manual JSON workflow.

## Steps

1. Create an AI Data Pack export job in ERP.
2. Wait for the job to reach `completed` or `completed_with_warnings`.
3. Open the export detail/status page or API result.
4. Confirm the JSON artifact is rendered and downloadable:
   - `artifactClass=downloadable_redacted_artifact`
   - `redactionRuntime=pre_rendered`
   - `artifactRendering=rendered`
   - `downloadReady=true`
5. Download the rendered JSON artifact as an authorized human user.
6. Open ChatGPT Web manually in the browser.
7. Upload the JSON file manually.
8. Paste the ChatGPT Web analysis prompt from `docs/ai-data-pack/manual-chatgpt-web-acceptance/chatgpt-web-analysis-prompt.md`.
9. Review the recommendation/action draft.
10. Human decides what to do outside of this automated branch.
11. Do not import, approve, dry-run, live execute, or mutate providers through ERP in this phase.

## Troubleshooting

| Symptom | Meaning | Operator response |
|---|---|---|
| `409 not_ready` | Job or artifact is not ready, manifest-only, deferred, missing, or checksum/size failed. | Wait for completion, verify artifact readiness, or escalate to technical owner. |
| `403 denied` | Actor lacks permission/profile/section access. | Use an authorized role or request explicit access review. |
| `404 not found` | Job/artifact is unknown or hidden by no-leak policy. | Confirm job ID/artifact ID and actor assignment. |
| Checksum mismatch | Stored file does not match artifact metadata. | Do not use the file; escalate as artifact integrity issue. |
| Missing artifact | Rendered artifact is absent or not downloadable. | Recreate export if appropriate; do not use manifest-only placeholder as a data pack. |
| Manager permission issue | Manager cannot access official/full director artifacts. | Use partial/assigned marketer scope or director/admin user. |
| Investor permission issue | Investor is status-only by default unless explicitly assigned redacted summary access. | Do not use director/full export for investor. |
| ChatGPT Web says missing data | The JSON may be redacted, stale, incomplete, or demo/local data. | Record missing data and decide whether to create a fresher export. |

## Non-Execution Rule

ChatGPT Web output is advisory. It is not approved, not imported, not dry-run, and not live-executed by ERP in this BA branch.

