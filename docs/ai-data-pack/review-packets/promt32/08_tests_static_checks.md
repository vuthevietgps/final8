# Tests And Static Checks

## Tests

- `npm test -- --runTestsByPath src/ai-data-pack/demo-seed/director-demo-seed.spec.ts --runInBand`: passed, 5 tests.
- `npm test -- --runTestsByPath src/ai-data-pack/ai-data-pack.service.spec.ts --runInBand`: passed, 19 tests.
- `npm run build`: passed.

## Static Checks

The broad Prompt 32 scan had existing matches in read-only provider adapter/test guard strings and explicit false capability fields. Changed-file scans were clean.

Clean checks:

- No OpenAI/action/provider mutation/live execution pattern in Prompt 32 diff.
- No OpenAI/action/provider mutation/live execution pattern in changed runtime files.
- No broad destructive database pattern in demo seed files.
- No `download-token` or `downloadToken` in export endpoint files.

