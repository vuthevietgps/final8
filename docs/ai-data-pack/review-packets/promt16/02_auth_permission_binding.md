# Auth Permission Binding

The implementation reused the existing centralized role-permission binding in `backend/src/auth/role-permissions.ts`.

Added grouped permission sets:

- `AI_DATA_PACK_EXPORT_DIRECTOR_PERMISSIONS`
- `AI_DATA_PACK_EXPORT_MANAGER_PERMISSIONS`
- `AI_DATA_PACK_EXPORT_INVESTOR_PERMISSIONS`

Role binding result:

- `director`: cached create, official create, partial create, status read, audit read, sync-detail read, and all non-worker AI Data Pack profiles.
- `manager`: cached create, partial create, status read, and manager-marketer profile.
- `investor`: status read and investor-redacted profile.

Fail-closed behavior:

- No public export permissions were added to employee, internal agent, external agent, supplier, lender, or other non-bound roles.
- Internal worker profile permission remains explicitly denied to normal public endpoint users.

Acceptance tests cover:

- Director role binding without explicit `user.permissions`.
- Manager and investor limited binding.
- Fail-closed defaults for unrelated roles.
- Explicit permission compatibility for existing test/user paths.
- Denial of internal worker profile access.
