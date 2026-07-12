# Operator SOP

Created:

- `docs/ai-data-pack/final-ba-closeout/02_operator_sop_manual_chatgpt_web_loop.md`

SOP includes:

- Create AI Data Pack export job.
- Wait for `completed` or `completed_with_warnings`.
- Open export detail/status.
- Download rendered JSON artifact as authorized human.
- Upload JSON manually to ChatGPT Web.
- Paste the analysis prompt.
- Review recommendation/action draft.
- Keep human decision outside automated execution.
- Do not import/execute through ERP in this phase.

Troubleshooting includes:

- `409 not_ready`
- `403/404` denial
- checksum mismatch
- missing artifact
- manager/investor permission issue
- ChatGPT Web missing data

