# Tests And Static Checks

Focused regression test:

```text
cd backend
npm test -- --runTestsByPath src/ai-data-pack/ai-data-pack.service.spec.ts --runInBand
```

Result:

```text
PASS src/ai-data-pack/ai-data-pack.service.spec.ts
Test Suites: 1 passed, 1 total
Tests: 37 passed, 37 total
```

Build:

```text
cd backend
npm run build
```

Result:

```text
PASS: nest build
```

Static checks:

- OpenAI/action/provider/live/upload scan: completed and classified in `05_readonly_safety_surface_audit.md`.
- Mutation scan: completed and classified in `05_readonly_safety_surface_audit.md`.
- Secret scan: completed and classified in `05_readonly_safety_surface_audit.md`.

Code/test changes in Prompt44:

- None.

