# Manual ChatGPT Web Acceptance Overview

Phase: `PR-2.3B-5D`.

Purpose: confirm the minimum manual BA loop for JSON AI Data Pack exchange without adding any OpenAI upload, action import, approval, dry-run, live execution, provider mutation, provider `validateOnly`, new provider adapter, tokenized download, or Phase 3 behavior.

Accepted loop boundary:

1. ERP creates an official or partial AI Data Pack export job.
2. ERP renders a redacted JSON artifact marked as `downloadable_redacted_artifact`.
3. An authorized human downloads the JSON artifact through the ERP endpoint.
4. The human manually uploads the JSON to ChatGPT Web.
5. ChatGPT Web produces analysis and a non-executable recommendation/action draft.
6. ERP does not import, approve, dry-run, execute, or mutate providers from that draft in this phase.

Evidence basis:

- Automated Jest coverage for official rendered JSON artifact creation.
- Automated Jest coverage for partial rendered JSON artifact creation.
- Automated Jest coverage for direct authenticated artifact download of rendered JSON.
- Automated Jest coverage for security denial and checksum mismatch paths.
- Manual workflow and ChatGPT Web analysis prompt created in this folder.

External manual step:

- Codex did not upload any file to ChatGPT Web.
- Codex did not call OpenAI APIs.
- Human upload remains manual by design.

