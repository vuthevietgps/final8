# Definition Of Done

The current BA loop is done when all conditions below are true:

- JSON AI Data Pack can be produced by ERP.
- JSON artifact is rendered, redacted, and marked downloadable.
- Authorized human can download the JSON through ERP.
- Download is protected by RBAC, redaction, readiness, size, and checksum gates.
- Manual ChatGPT Web workflow is documented.
- ChatGPT Web analysis prompt exists.
- ChatGPT Web output is advisory and non-executable.
- ERP does not upload to OpenAI.
- ERP does not import ChatGPT Web output.
- ERP does not approve, dry-run, live execute, or mutate providers.
- Safety boundaries are documented and preserved.
- Known gaps are documented and classified.

Definition status:

```text
met_for_manual_json_chatgpt_web_export_loop
```

