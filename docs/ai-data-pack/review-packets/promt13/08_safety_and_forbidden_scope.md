# 08 Safety And Forbidden Scope

Forbidden input fields are rejected at the internal lifecycle boundary:

- credentials
- tokens
- authorization fields
- raw provider query / GAQL
- action plan
- approval payload
- dry-run/live flags
- OpenAI/upload payload
- provider mutation
- validateOnly

Forbidden scope not implemented:

- public endpoint
- status endpoint
- download endpoint
- download token endpoint
- OpenAI upload
- action import
- approval workflow
- dry-run/live execution
- provider mutation
- Performance Max, Shopping, Display, YouTube
- delete campaign/ad group actions

New Google Search campaign creation was not touched.
