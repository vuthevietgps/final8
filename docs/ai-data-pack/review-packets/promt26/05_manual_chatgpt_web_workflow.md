# Manual ChatGPT Web Workflow

Created:

- `docs/ai-data-pack/manual-chatgpt-web-acceptance/04_manual_chatgpt_web_upload_guide.md`

Workflow:

1. Create ERP export job.
2. Wait for `completed` or `completed_with_warnings`.
3. Download rendered JSON artifact through ERP as an authorized human.
4. Manually upload JSON to ChatGPT Web.
5. Paste the provided analysis prompt.
6. Review recommendations as non-executable advisory output.
7. Do not import, approve, dry-run, live execute, or mutate providers from the output.

No ERP automation was added for ChatGPT Web upload.

