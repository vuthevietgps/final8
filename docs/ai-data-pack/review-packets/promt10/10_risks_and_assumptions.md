# Risks And Assumptions

- Module-level wiring was not added because `ai-data-pack.module.ts` is outside Prompt 10's allowed implementation scope.
- Future callers must pass approved Google Ads customer IDs; this phase does not discover customer scope automatically.
- Official/partial export creation is still absent; the new method is an internal preparation delegate only.
- DB assessment quality depends on existing `SourceRegistryService`, `DbWatermarkService`, and `CoverageGateService` definitions.
- Existing public Google Ads routes from older phases remain present; this phase did not add or remove routes.
- The new source-sync policy does not execute provider mutations, validateOnly, action import, dry-run, or live execution.
