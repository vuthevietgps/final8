# Risks And Open Questions

- No safe throwaway MongoDB URI is available, so apply/export evidence remains blocked.
- Runtime idempotency against MongoDB is not checked.
- Director JSON export from demo data is not checked.
- JSON download/parse validation from demo export is not checked.
- Expected AI findings are not verified against an actual exported Director JSON.
- Export harness availability was not exercised because DB apply was blocked upstream.

No production DB was touched.
