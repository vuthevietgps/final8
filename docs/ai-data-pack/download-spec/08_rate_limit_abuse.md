# Rate Limit And Abuse Controls

Future download implementation must add dedicated download limits. Existing create/status/sync limits are not enough.

## Required Buckets

- Per actor download attempts.
- Per actor/job download attempts.
- Per artifact download attempts.
- Per actor denied download attempts.
- Per actor failed download attempts.
- Per actor token creation attempts, if tokenized.
- Per token use attempts, if tokenized.
- Concurrent downloads per actor.
- Concurrent downloads per job/artifact.
- Large file download throttling.
- Status/detail/download burst correlation, to catch polling then download abuse.

## Existing Platform Caveat

Prompt 18 classifies high-volume multi-pod public exposure as not accepted because:

- CacheManager-backed limiter is non-atomic.
- No platform atomic Redis `INCR` limiter was found.
- No central security ledger was found.

This applies to download too. Any future download endpoint must remain controlled internal/admin unless platform gates are resolved or explicitly accepted.

## Suggested Initial Direction

- Official artifacts: strictest quota.
- Partial artifacts: strict but slightly broader than official.
- Cached artifacts: bounded; cached must not become a free renderer/downloader.
- Denied downloads: tighter throttling after repeated denials.
- Large files: stream with backpressure and cap concurrent transfers.
- Token creation: very strict; one-time tokens by default.
- Token replay: deny, audit, and throttle.

## Abuse Scenarios To Cover

- Actor repeatedly guesses `jobId` or `artifactId`.
- Actor repeatedly requests non-ready artifacts.
- Manager attempts director/finance/employee/supplier files.
- Investor attempts full director artifact.
- Token replay after successful use.
- Download attempt after artifact revocation or expiry.
- Large XLSX repeated download.
- Parallel download bursts from the same actor or artifact.

