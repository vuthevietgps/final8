# XLSX Guard

XLSX compatibility now proves:

- export does not throw
- sheet `16_operation_capacity` exists
- column `operation_capacity.operational_risk_findings` exists
- row count column exists
- finding keys summary contains all five hardened findings

Oversized cells are explicitly marked as truncated instead of crashing.
