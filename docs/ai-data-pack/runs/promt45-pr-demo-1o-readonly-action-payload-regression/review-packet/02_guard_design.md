# Guard Design

The guard builds all five targeted evidence rows from fake collections and recursively rejects exact banned keys such as `action_payload`, `provider_operation`, `execute_live`, `dry_run`, `mutate`, and `openai_call`.

It also asserts `not_allowed_actions` remains present as advisory safety text.

