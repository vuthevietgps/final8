# Section Guard Design

Focused guard:

`keeps hardened operational risk findings read-only on the evidence schema contract`

Guard design:

1. Build deterministic fake in-memory collections.
2. Run `OperationsCapacityQuery.get("2026-06-14T00:00:00.000Z")`.
3. Validate the five hardened rows at query result level.
4. Feed the same operations result through `DirectorDataPackService.build()`.
5. Assert the exact Director path:

   `sections["16_operation_capacity"].data.operation_capacity.operational_risk_findings`

6. Filter targeted rows from that section path.
7. Assert all five finding keys are present at the section path.
8. Assert section-path targeted row count equals the query targeted row count.
9. Assert duplicate rows for the same targeted finding have distinct `affected_entity_type:affected_entity_id` identity.

Code references:

- Section assembly: `backend/src/ai-data-pack/director-data-pack.service.ts:89`
- Director section path assertion: `backend/src/ai-data-pack/ai-data-pack.service.spec.ts:637`
- Duplicate/path stability assertion: `backend/src/ai-data-pack/ai-data-pack.service.spec.ts:647`

The guard does not call provider APIs and does not access MongoDB.
