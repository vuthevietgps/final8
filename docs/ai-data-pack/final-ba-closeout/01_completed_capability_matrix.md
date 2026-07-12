# Completed Capability Matrix

| Capability | Status | Evidence source | Acceptance | Notes |
|---|---|---|---|---|
| Export job creation | completed | Prompt 15-26 result chain; Prompt 26 acceptance packet | accepted | Official and partial lifecycle are available for JSON acceptance. |
| Status/detail/sync-summary | completed | Prompt 18/23/24/26 packets | accepted | Status/detail/sync-summary remain bounded and redacted. |
| Redacted rendered JSON artifact | completed | Prompt 25 implementation packet; Prompt 26 evidence | accepted | `downloadable_redacted_artifact`, `pre_rendered`, `rendered`, `downloadReady=true`. |
| Direct authenticated download | completed | Prompt 24 endpoint packet; Prompt 26 evidence | accepted | `GET /ai-data-pack/exports/:jobId/artifacts/:artifactId/download`. |
| RBAC/redaction/download gates | completed | Prompt 23 spec; Prompt 24 implementation; Prompt 26 negative tests | accepted | Manager/system/unassigned/checksum/manifest-only boundaries documented and tested. |
| Manual ChatGPT Web guide | completed | Prompt 26 manual acceptance docs | accepted_with_condition | External ChatGPT Web upload remains a human step. |
| ChatGPT Web analysis prompt | completed | Prompt 26 `chatgpt-web-analysis-prompt.md` | accepted | Produces non-executable advisory sections only. |
| Negative safety boundaries | completed | Prompt 24/25/26 tests and static checks | accepted | No OpenAI upload, action import, dry-run/live, provider mutation, token route. |
| Tests/build/static checks | completed | Prompt 25 and Prompt 26 packets | accepted | Prompt 26 recorded 20 service tests, 41 endpoint tests, build, JSON/static checks. |
| XLSX official/partial rendering | not built | Prompt 25/26 risks | not_in_scope | Not required for this closeout. |
| Human ChatGPT Web transcript | not attached | Prompt 26 risks | accepted_with_condition | Manual workflow accepted; transcript can be a future evidence branch. |

