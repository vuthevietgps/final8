# Scope

Included:

- Internal source-sync preparation input/result types.
- Internal source-sync policy service.
- Internal source-sync orchestrator service.
- ExportJob service delegate method.
- Focused orchestrator and ExportJob tests.
- Prompt 10 report artifacts.

Excluded:

- Public endpoints, polling, or download routes.
- Changes to existing GET exports.
- Public official/partial export flow.
- Cached export behavior changes.
- Action import, approval, dry-run, live execution, OpenAI/upload, or Phase 3.
- Provider mutation or validateOnly.
- Real provider calls in tests.
- Budget/campaign/status/provider-resource changes.
- Broad Director/Manager permission binding.
