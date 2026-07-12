# Next Recommendation

Stop after Prompt 23.

If accepted:

```text
PR-2.3B-5B - Download Endpoint Implementation, No OpenAI, No Action Import
```

Recommended starting design:

- Option A direct authenticated download/proxy.
- Keep official/partial downloads not ready until actual rendered redacted artifacts exist.
- Do not implement tokenized download unless real browser/storage constraints require it.

If review finds blockers:

```text
PR-2.3B-5A-FIX - Download Endpoint Spec Fix, No Code
```

Still forbidden:

- OpenAI upload.
- Action import.
- Approval workflow.
- Dry-run/live execution.
- Provider mutation.
- Provider validateOnly.
- New provider adapter.
- Performance Max, Shopping, Display, YouTube.
- Delete campaign/ad group/ad actions.
- Phase 3.

