# 14 - Ads Automation Control Center Plan

Status: BA/truc approved for next auto-code slice
Date: 2026-07-06
Owner: ERP / AI Ads V2

## 1. Decision

Upgrade `/ads-settings` into the single Ads Automation Control Center.

The old split is no longer enough:

- `/api-tokens` stores provider tokens and account-level metadata.
- `/ads-settings` stores one Google MCC settings panel and one TikTok BC settings panel.
- `/ad-accounts`, `/ad-groups`, and `/advertising-cost` display operational ads data.

The target is one coherent control plane:

```text
/ads-settings
  -> Manager Accounts: Google MCC / Meta BM / TikTok BC
  -> Credentials / API Tokens: redacted vault metadata only
  -> Child Ad Accounts: authorized accounts under each manager
  -> Import Schedule: read-only sync jobs and freshness
  -> Mapping Health: account/campaign/ad group -> product/supplier/order/profit
  -> Approval & Execution Gates: validateOnly, approval, kill switch, production flag
  -> Audit & Incident Evidence: last sync, failures, rollback readiness
```

`/api-tokens` may remain as a technical route, but product navigation should treat it as a sub-surface of `/ads-settings`.

## 2. Business Goal

The business goal is not just to store API tokens. The goal is to let ERP safely control all authorized advertising assets through manager accounts:

- Google Ads MCC controls child Google Ads customer accounts.
- Meta Business Manager controls child ad accounts, campaigns, ad sets, and ads.
- TikTok Business Center controls child advertiser accounts, campaigns, ad groups, and ads.

ERP must know which manager credential controls which child account before it can import cost, evaluate profit, draft actions, or later call provider APIs.

## 3. Current State

Current system state:

- Google settings are stored as one `Google Ads System Settings` token record.
- TikTok settings are stored as one `TikTok Ads System Settings` token record.
- Facebook/Meta tokens are stored as multiple `ApiToken` records.
- `AdAccount` can already represent many child accounts and has `managementMode` values `direct`, `bm`, `mcc`, and `bc`.
- Operational pages already exist for ad accounts, ad groups, and advertising costs.

Current limitation:

- UI does not yet present one clear MCC/BM/BC control center.
- UI does not clearly distinguish manager credentials from child ad accounts.
- UI does not show import readiness, mapping health, and execution gates in the same decision surface.
- `/api-tokens` still feels like a standalone technical page rather than part of ads automation governance.

## 4. Target Information Architecture

### `/ads-settings` tabs

1. Overview
   - provider readiness summary.
   - production disabled by default.
   - execution allowed now false unless every gate passes.
   - last sync and import freshness.

2. Manager Accounts
   - list Google MCC, Meta BM, and TikTok BC manager records.
   - show only redacted credential/vault metadata.
   - show number of authorized child accounts.
   - show status: not_configured, ready_for_import, needs_mapping, blocked.

3. Credentials
   - embedded API token list and create/edit modal.
   - support provider values: facebook, google, tiktok, zalo, other.
   - support tokenType values: system_settings, business_center, ad_account, refresh_token, access_token, other.
   - no plaintext token display after save.

4. Child Ad Accounts
   - show accounts imported or manually linked from MCC/BM/BC.
   - show manager relationship and account readiness.
   - link to existing `/ad-accounts`.

5. Import Schedule
   - Google Ads read-only import first.
   - Meta and TikTok after Google path is stable.
   - show last run, next run, failures, data freshness, and row counts.

6. Mapping Health
   - child account -> campaign -> ad group -> product/supplier/order/profit/cashflow.
   - identify missing product mapping, missing supplier evidence, stale cost, stale orders, stale stock, and stale refund data.

7. Approval & Execution Gates
   - validateOnly readiness.
   - approval queue readiness.
   - kill switch.
   - idempotency.
   - production flag status.
   - daily/monthly loss limits.

8. Audit
   - before/after evidence.
   - sync/import audit.
   - credential metadata audit without secrets.
   - rollback and incident evidence.

## 5. Data Flow

Credential activation must only unlock read-only import by default:

```text
Manager credential metadata
  -> child account discovery/import readiness
  -> read-only metrics import
  -> operational tables: ad accounts, campaigns, ad groups, costs
  -> mapping to product/supplier/order/profit/cashflow
  -> pending actions
  -> approval + validateOnly + dry-run preflight
  -> live execution only after explicit production gates
```

Entering a token must not enable live execution.

## 6. Safety Rules

1. Do not enter real credentials in Codex, prompts, tests, logs, or runner artifacts.
2. UI and API responses must never return plaintext token material after save.
3. Codex runner remains local-only and fixture/redacted-only.
4. Provider API calls are disabled in the auto-code job.
5. Real MCC/BM/BC onboarding is a later ERP human-admin secret-store step.
6. `GOOGLE_ADS_PRODUCTION_ENABLED` remains false or absent.
7. `execution_allowed_now` remains false unless future ERP gates pass.
8. Scaling is downgraded to `monitor_only` if margin, cashflow, stock, supplier reliability, fulfillment capacity, refund risk, data freshness, or loss limits are unsafe or unknown.

## 7. Next Auto-Code Slice

Next runner job:

```text
ERP_JOB_000116 - ADS_AUTOMATION_CONTROL_CENTER_UI_FOUNDATION_LOCAL_ONLY
```

Scope:

- Update `/ads-settings` into the Control Center shell.
- Embed or link token management as a first-class tab.
- Expose current manager-account readiness using existing backend surfaces.
- Make current limitation explicit in UI state, not marketing text.
- Keep `/api-tokens` backward compatible.
- Do not add real provider calls.
- Do not store or print real credentials.
- Include focused frontend tests where practical, backend contract tests if touched, build, and safety grep.

Out of scope for job 116:

- real token entry by Codex.
- real Google/Meta/TikTok API calls.
- live execution worker.
- production flag enablement.
- PMax, Shopping, Display, YouTube, delete actions, or auto-publish.

## 8. Acceptance Criteria

Job 116 is accepted only when:

- `/ads-settings` clearly communicates MCC/BM/BC manager-account control-plane direction.
- `/ads-settings` shows credential/token, child account, import, mapping, and safety gate surfaces in one place.
- existing `/api-tokens` still works.
- user can understand that ad accounts, ad groups, and advertising costs are operational data imported daily after credential activation.
- activation of a token does not imply live execution.
- tests/build/safety grep are recorded in the runner result.

