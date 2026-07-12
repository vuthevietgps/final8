# Director Section Guard

The guard checks:

`sections["16_operation_capacity"].data.operation_capacity.operational_risk_findings`

It asserts all targeted findings are visible there and not only at query-local level.

Duplicate targeted rows must have distinct affected entity identity.
