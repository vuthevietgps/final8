# Transcript Required

Codex cannot operate ChatGPT Web interactively and must not fake a ChatGPT Web transcript.

To complete Prompt 33, a human operator must:

1. Upload or paste the redacted Director JSON into ChatGPT Web:

```text
tmp/ai-data-pack-prompt32-exports/AIDP-20260614045658-a295d333/director_data_pack.json
```

2. Use the prompt:

```text
docs/ai-data-pack/manual-chatgpt-web-transcript/prompt33_chatgptweb_input.md
```

3. Save the full ChatGPT Web answer as:

```text
docs/ai-data-pack/manual-chatgpt-web-transcript/chatgptweb_director_demo_analysis_transcript.md
```

4. Save a short human operator note as:

```text
docs/ai-data-pack/manual-chatgpt-web-transcript/human_operator_note.md
```

The note must record the model used, upload-or-paste method, response truncation status, whether continuation was needed, whether an upload limit occurred, and date/time of run.

5. Rerun this prompt or a follow-up validation prompt only after the transcript exists.

Until the transcript file exists, Prompt 33 status is:

`packet_prepared_transcript_pending`
