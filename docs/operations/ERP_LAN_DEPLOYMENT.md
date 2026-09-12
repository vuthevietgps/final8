# Current ERP deployment: LAN-only

As of 2026-09-04, the production ERP runs at:

http://192.168.100.236:8090/

Server: admin001-ProLiant-DL360-Gen9, Ubuntu 22.04.5 LTS.
The allowed client subnet is 192.168.100.0/24.

## Deployment entry point

On the server, use `/home/admin-001/erp-lan/deploy.sh`.
It combines `/opt/websites/sites/htxbachgia-shop/docker-compose.yml` with
`/home/admin-001/erp-lan/compose.lan.yml` and recreates only frontend/backend.

The LAN overlay pins the image IDs that were running at migration time, mounts
`nginx.lan.conf`, disables Traefik exposure, removes its shared network, publishes
only explicit IPv4 addresses, and updates public/media origin settings.

**Do not run the old public deployment configuration by itself.** It would
remove the LAN restrictions. For future releases, preserve the overlay and
update its pinned image IDs deliberately. The old `/tmp/htxbachgia-override.yml`
no longer exists and must not be used as a deployment dependency.

The shared root-owned Cloudflare configuration still contains the old domain
routes, but all their origin requests receive 403. Nginx checks actual TCP peer
addresses, not forwarded headers. Other sites keep their public routes.

MongoDB, secrets, and advertising execution flags were not changed. Rollback is
available at `/home/admin-001/erp-lan/rollback.sh`; it restores public access.

## Verification

From an office machine, the root link must redirect to `/login` on port 8090
and display the login form. An unauthenticated `/api/users` request must return
401. Both old public hostnames must return 403 for `/login`, including requests
with a forged LAN `X-Forwarded-For` header. Both ERP containers must remain healthy.

The other 27 containers were unchanged; seven other public websites returned
HTTP 200 before and after migration.

## Remaining operational limits

- Reserve 192.168.100.236 in the modem DHCP configuration; this has not been done.
- The LAN URL currently uses HTTP; internal HTTPS is not configured.
- Incoming third-party webhooks/OAuth callbacks and public media delivery need
  a separately designed endpoint if still required. Existing stored URLs and
  public-site links in the application may still refer to the old hostname.
- No full authenticated business-flow test or independent WAN/modem audit was
  performed during the migration.

The detailed local report is in the `server` project:
`outputs/htxbachgia-lan-migration-20260904.md`.
