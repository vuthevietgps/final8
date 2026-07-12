# Manual ChatGPT Web Workflow

Download only enables an authorized human to retrieve the already-rendered redacted Data Pack file.

Workflow:

1. ERP creates export job.
2. ERP validates status/detail/sync-summary.
3. Future download endpoint lets an authorized human download JSON/XLSX only when eligibility passes.
4. Human manually uploads the file to ChatGPT Web.
5. ChatGPT Web analyzes and returns recommendation/action draft.

Boundaries:

- ERP does not upload to OpenAI in this phase.
- ERP does not import ChatGPT output in this phase.
- ERP does not approve, dry-run, live execute, mutate provider state, or validateOnly in this phase.
- ChatGPT Web output remains recommendation/action draft only.

