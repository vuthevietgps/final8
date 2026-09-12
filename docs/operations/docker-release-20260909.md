# Docker release 2026-09-09

## Built and verified

- Backend: `htxbachgia/backend:20260909-deploy`
- Frontend: `htxbachgia/frontend:20260909-deploy`
- Backend image ID: `sha256:1baa2dd2a62893b02f709975487be7b2edc7deb50db5c2c62b006d5c7be4dd4e`
- Frontend image ID: `sha256:ffbe668bef8e870f65109c1ad47940b9c3a57fcd90b45555f703e6a12836f538`
- Image archive SHA256: `9ab1fab045d3fc1e99bee9f77bfb1f0a741298861deb537e99a8b4c92669bde4`
- Server release directory: `/home/admin-001/erp-releases/20260909-deploy/`
- This release includes the current working tree, including pre-existing uncommitted application changes. No commit or push to Git was made.

Verification commands:

```powershell
docker build -f backend/Dockerfile -t htxbachgia/backend:20260909-deploy .
docker build -f Dockerfile -t htxbachgia/frontend:20260909-deploy .
npm.cmd --prefix backend test -- --runInBand health.service.spec.ts ads-safety-config.spec.ts
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-docker-release.ps1
```

Both builds succeeded; 2 test suites / 10 tests passed. Isolated Docker smoke passed frontend `/`, SPA `/login`, protected API proxy (401), and `/health/ready` with transaction topology and critical indexes. Backend, frontend and MongoDB containers were healthy. Image layout checks passed, including runtime contracts and absence of `/app/.env`.

The smoke database is separate from production and existing local ERP databases. Test secrets are generated in memory. Ads provider execution and message sending are disabled. Smoke URLs: `http://localhost:18090/login` and `http://127.0.0.1:13090/health/ready`.

## Production preflight: blocked before activation

`http://192.168.100.236:8090/` is the existing ERP frontend. Its backend connects to `mongo:27017`, database `management-system`, on the existing Docker network. Read-only connection and `hello` probes succeeded.

The existing MongoDB 7.0 container is standalone with authentication. It does not support the transactions required by the new financial workflows. The index preflight reports 32 missing required indexes. The existing backend environment also lacks `API_TOKEN_SECRET`, which the new production startup requires. Do not substitute a health/liveness probe for strict readiness or disable the production checks.

No production database records, indexes, container configuration or running application images were changed during preflight. Transferring/loading images does not activate them.

## Proposed maintenance and activation

1. Reserve a maintenance window. Record the current backend/frontend image IDs and both Compose inputs. Keep the current containers/images available for rollback.
2. Stop application writes and scheduled workers. Create and verify an encrypted database backup plus protected configuration/media backup before any database topology change. Verify the restore procedure on isolated storage.
3. Convert the existing MongoDB 7.0 deployment to a single-node authenticated replica set, retaining the existing named data volume and authentication. Do not combine this operation with a MongoDB major-version upgrade. Provision replica-set authentication material through approved secret storage; do not log or commit it.
4. Verify writable primary, sessions and an actual commit/abort transaction against the replica set. Preserve the database name, credentials and existing application data.
5. Provision persistent `API_TOKEN_SECRET` through secure secret storage. Check compatibility with any existing encrypted token records before choosing the key; do not silently rotate an existing encryption key.
6. Run `ensure-production-indexes.js` with the database URI injected securely. Review duplicate/conflicting index failures; never delete business records to force index creation. Apply the required indexes only after backup and checks succeed.
7. Merge the release override AFTER `/opt/websites/sites/htxbachgia-shop/docker-compose.yml` and `/home/admin-001/erp-lan/compose.lan.yml`. Preserve the current MongoDB URI, LAN bindings, uploads/media mounts and other required settings. Set replica-set connection options if needed. Do not print resolved Compose configuration containing secrets.
8. Update only backend/frontend. Require backend `/health/ready` and frontend health to pass. Verify login, protected API access and representative read-only ERP screens. Ads execution remains disabled/dry-run.
9. If app readiness fails, restore the prior application image selection. If database conversion fails, stop the attempted database instance and restore the verified pre-conversion backup/configuration; do not run two database instances against the same data directory.

Activation is pending authorization for the database maintenance and secure key provisioning. A replica-set migration requires a short service interruption; the database backup size and restore verification determine the duration.
