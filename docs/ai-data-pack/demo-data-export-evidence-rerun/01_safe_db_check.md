# 01 Safe DB Check

Prompt 31 did not use the repo `.env` MongoDB target.

The repo `.env` had a MongoDB URI, but the parsed database name was `htxbachgia`. That name is not a throwaway/dev/test/demo database name, so it was rejected for Prompt 31 apply/export work. The URI itself was not printed.

Selected target:

| Check | Result |
|---|---|
| Target | local Docker MongoDB |
| Container | `erpdropshiping-mongodb-test` |
| Host/port | `127.0.0.1:27018` |
| Database | `aidp_demo_20260614` |
| DB name contains demo marker | yes |
| Unsafe keywords detected | no |
| `NODE_ENV` | `test` |
| `ALLOW_DEMO_SEED` | `1` |
| Ping | ok |
| Initial collection count before apply | 0 |

Decision: safe for demo apply/export only.

