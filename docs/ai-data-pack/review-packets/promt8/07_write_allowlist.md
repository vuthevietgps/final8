# Write Allowlist

```text
local_write_allowlist_enforcement=instrumented
local_write_allowlist_limitation_documented=true
```

The sync-port instrumentation declares only the approved Google cache/sync-run targets. The audit collection is separately allowlisted.

The adapter:

- rejects missing write-target telemetry;
- rejects forbidden targets;
- rejects delete-named targets;
- emits only the audit target on a telemetry failure.

The legacy sync service does not expose actual persistence telemetry, so this is not complete interception. That service is disconnected from the adapter module, preventing a current bypass. A separate refactor is required before integration.
