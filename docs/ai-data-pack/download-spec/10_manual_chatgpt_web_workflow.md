# Manual ChatGPT Web Workflow

This phase family keeps ChatGPT Web manual and non-executable.

## Workflow

1. ERP creates an AI Data Pack export job.
2. ERP exposes status/detail/sync-summary metadata only.
3. After future download implementation and only when artifact eligibility passes, an authorized human downloads a rendered redacted JSON/XLSX file.
4. The human manually uploads that file to ChatGPT Web.
5. ChatGPT Web analyzes the pack and produces recommendations or action drafts.
6. ERP does not import or execute ChatGPT Web output in this phase.

## Boundaries

- ERP does not upload to OpenAI.
- ERP does not store an OpenAI API key for this workflow.
- ERP does not create an action import from the downloaded file.
- ERP does not approve, dry-run, or live execute any ChatGPT output.
- ChatGPT Web output remains `recommendation`, `action_draft`, `investigation_request`, `monitoring_task`, or `needs_director_approval`.
- The downloaded file must already be redacted for the human actor.

## User-Facing Note For Future UI/API Docs

The future download button/API should tell users, in product copy or documentation:

```text
Download is for authorized manual analysis only. Upload to ChatGPT Web is manual. ERP does not upload this file to OpenAI and does not execute recommendations from ChatGPT Web in this phase.
```

