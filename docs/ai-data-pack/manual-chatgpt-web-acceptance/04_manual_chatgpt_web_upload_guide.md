# Manual ChatGPT Web Upload Guide

Use this guide only after the ERP export job has completed and the artifact is downloadable.

## Steps

1. In ERP, create an AI Data Pack export job using official or partial JSON mode.
2. Wait until the job status is `completed` or `completed_with_warnings`.
3. Confirm the artifact metadata says:
   - `artifactClass=downloadable_redacted_artifact`
   - `redactionRuntime=pre_rendered`
   - `artifactRendering=rendered`
   - `downloadReady=true`
4. Download the JSON artifact through the ERP download endpoint while authenticated as an allowed human actor.
5. Open ChatGPT Web manually in the browser.
6. Upload the downloaded JSON file manually.
7. Paste the prompt from `chatgpt-web-analysis-prompt.md`.
8. Review ChatGPT Web output as advisory only.
9. Do not import the output into ERP.
10. Do not approve, dry-run, live execute, or mutate ads/providers from the output in this phase.

## Human Review Rule

The ChatGPT Web result is a recommendation/action draft only. It is not an ERP action file and it is not executable.

## Forbidden

- Do not upload through ERP.
- Do not call OpenAI API from ERP.
- Do not add OpenAI keys or env vars.
- Do not import the ChatGPT Web output.
- Do not execute live changes.
- Do not call Google Ads, Facebook Ads, or other provider mutation APIs from this workflow.

