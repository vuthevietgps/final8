# Manual Upload Steps

Use these steps for the manual ChatGPT Web transcript test.

## Inputs

Director JSON artifact:

`tmp/ai-data-pack-prompt32-exports/AIDP-20260614045658-a295d333/director_data_pack.json`

ChatGPT Web prompt:

`docs/ai-data-pack/manual-chatgpt-web-transcript/prompt33_chatgptweb_input.md`

## Steps

1. Open ChatGPT Web manually in a browser.
2. Start a new chat for the Director demo analysis.
3. Upload the Director JSON artifact, or paste its contents if upload is unavailable.
4. Paste the full content of `prompt33_chatgptweb_input.md`.
5. Wait for ChatGPT Web to answer.
6. Save the full ChatGPT Web answer as:

```text
docs/ai-data-pack/manual-chatgpt-web-transcript/chatgptweb_director_demo_analysis_transcript.md
```

7. Save a short human operator note as:

```text
docs/ai-data-pack/manual-chatgpt-web-transcript/human_operator_note.md
```

The note should record:

- date/time of the manual run
- ChatGPT Web model or visible product label, if shown
- whether upload or paste was used
- whether the answer completed without truncation
- whether a continuation prompt was needed
- whether any upload limit occurred
- any manual edits made while saving the transcript

8. Rerun Prompt 33 or a follow-up validation prompt after the transcript exists.

## Bans

Do not use OpenAI API. Do not create action files. Do not import actions. Do not run provider validation. Do not mutate ads platforms. Do not start Phase 3.
