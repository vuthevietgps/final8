# Scope Policy

The scope policy fails closed before credential loading or provider invocation.

## Validation

- Requires the narrow internal execute permission.
- Rejects `google-ads.read` as insufficient.
- Requires normalized, unique, non-empty 10-digit customer IDs.
- Requires each requested customer to match exactly one active local Google ad account.
- Validates configured login-customer IDs.
- Rejects unknown, inactive, ambiguous, malformed, duplicate, or unapproved scope.
- Defaults missing date range to report date only.
- Enforces date order and a maximum inclusive range of 31 days.
- Rejects missing/expired deadline and caps the effective deadline at 180 seconds.
- Recursively rejects forbidden caller-controlled transport, credential, query, action, and mutation fields.

An active local Google account is the current approval basis. A separate durable scope-approval store is not implemented in this phase.

