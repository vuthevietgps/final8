# Risks and Assumptions

- The local sample remains sparse for `2026-06-12`: no report-date orders/leads/Google Ads metrics/sync runs.
- Populated ads attribution and populated report-date profit paths are covered by focused fixtures, not by this local sample.
- The sample uses the existing local MongoDB and repository test Director account.
- No full-repository test suite was run; verification was the required backend build plus focused AI Data Pack suite.
- Reviewer should manually inspect v2 XLSX readability and confirm finance/value-state terminology.
- ChatGPT Web upload and interpretation remain manual review tasks.
- The existing working tree contains extensive unrelated user changes; PR-2.2 did not revert or modify them.

