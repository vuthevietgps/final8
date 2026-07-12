# 08 Tests And Static Checks

Passed:

- `npm test -- --runTestsByPath src/ai-data-pack/demo-seed/director-demo-seed.spec.ts --runInBand`
- `npm run build`
- Static check for OpenAI/API/action/import/provider execution strings in demo seed: no matches.
- Static check for broad delete/drop in demo seed: no matches.
- Static check for `download-token|downloadToken` in export endpoint controller/service: no matches.

No export/download source code was changed.

