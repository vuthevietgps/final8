# Cached Export Policy

Purpose:

- Preserve existing cached/read-only export behavior.

Required behavior:

- `exportMode=cached_export`.
- `syncPolicy=export_cached`.
- `cached_export=true`.
- Never call provider or internal adapter.
- Export from current DB state.
- Existing GET/cached behavior remains unchanged.
- Existing cached metadata may keep `freshness_gate_evaluated=false`.

Decision use:

- Cached export is not an official decision artifact by default.
- If freshness metadata is absent, ChatGPT Web must treat claims as cautious.
- Cached export must not trigger sync, action import, dry-run, live execution, or OpenAI/upload.
