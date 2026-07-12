# 10 Test Plan

Future implementation tests:

- unauthorized create official denied
- manager cannot create official by default
- partial creator permission enforced
- idempotency returns same job
- cached create never triggers sync
- official create calls internal lifecycle only
- status denied to unrelated user
- status response redacted by profile
- sync summary denied to manager/investor
- sync summary sanitized
- create rejects `dryRun`, `liveExecution`, OpenAI, and action payloads
- create rejects raw provider query and credentials
- no download token returned
- no artifact bytes returned
- no public storage path returned
- no provider mutation or validateOnly
- no existing GET export behavior changed

Prompt 14 verification command:

```text
JSON.parse(fs.readFileSync('docs/ai-data-pack/ketquapromt14.json', 'utf8'))
```
