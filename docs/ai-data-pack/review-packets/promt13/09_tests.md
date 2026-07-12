# 09 Tests

Required commands run:

```text
npm run build
npm test -- --runInBand export-job
npm test -- --runInBand source-sync
npm test -- --runInBand ai-data-pack
npm test -- --runInBand google-ads-readonly
npm test -- --runInBand source-registry
npm test -- --runInBand rbac
npm test -- --runInBand redaction
```

Result: all passed.

Coverage added:

- official lifecycle success with `sync_required`
- partial lifecycle with `sync_if_stale`
- official source block
- explicit downgrade with audit
- RBAC fail-closed without source sync or artifact
- forbidden input rejection
- manifest-only artifact metadata
- cached export does not call source sync
- no controller POST endpoint
- redaction profile resolution
- profile permission guard
