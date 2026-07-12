# 02 Safe DB Check

The real/server DB was not used.

Rejected target:

- Repo `.env` MongoDB URI existed.
- Parsed DB name: `htxbachgia`.
- Decision: rejected for Prompt 31 because the name is not clearly throwaway/dev/test/demo.

Accepted target:

- Local Docker container: `erpdropshiping-mongodb-test`.
- Host/port: `127.0.0.1:27018`.
- Database: `aidp_demo_20260614`.
- Ping: ok.
- Initial collection count: 0.
- `NODE_ENV=test`.
- `ALLOW_DEMO_SEED=1`.

Decision: safe for Prompt 31 demo apply/export only.

