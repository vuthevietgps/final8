# Next Recommendation

Stop after Prompt 23.

If this spec is accepted by review:

```text
PR-2.3B-5B - Download Endpoint Implementation, No OpenAI, No Action Import
```

Recommended default for PR-2.3B-5B:

- Implement Option A direct authenticated download/proxy first.
- Keep official/partial `download_ready=false` until rendered redacted artifacts exist.
- Consider cached artifact download only if explicitly approved and permissioned.
- Do not implement Option B token unless real browser/storage constraints require it.

Still forbidden by default:

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

If review finds blockers:

```text
PR-2.3B-5A-FIX - Download Endpoint Spec Fix, No Code
```

