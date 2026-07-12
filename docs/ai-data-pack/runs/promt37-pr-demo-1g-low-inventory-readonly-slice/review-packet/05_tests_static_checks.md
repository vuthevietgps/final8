# Tests And Static Checks

Passed:

```text
npm test -- --runTestsByPath src/ai-data-pack/ai-data-pack.service.spec.ts --runInBand
```

Result:

```text
1 suite passed
21 tests passed
```

Passed:

```text
npm run build
```

Static checks:

- no OpenAI upload/call path added
- no action import path added
- no provider validateOnly/execution/mutation path added
- no destructive DB call matched
- `mutate` appears only in `do_not_mutate_inventory` safety strings

