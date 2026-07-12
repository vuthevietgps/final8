# Credential, RBAC, and Security Review

## Credential storage and OAuth

`ApiTokenService.getGoogleAdsRuntimeConfig()` resolves Google Ads configuration
from environment variables first, then from active Google token/settings records.
The repository implements OAuth 2.0 refresh-token exchange through
`google.auth.OAuth2`; no Google Ads service-account implementation was found.

Database storage for Google settings uses:

- refresh token in `tokenEnc`;
- client secret, developer token, client ID, login customer ID, and API version
  in encrypted `providerConfigEnc`;
- AES-256-GCM with a key derived from `API_TOKEN_SECRET`;
- token hash for lookup/audit; and
- production startup failure when `API_TOKEN_SECRET` is absent.

Do not introduce service-account support in the adapter PR. It requires a
separate authentication and delegated-access review. The adapter must obtain
credentials internally; credentials must never be adapter input/output.

## Security findings

| Finding | Risk | Required future treatment |
|---|---|---|
| `ApiToken` schema still permits plaintext `token` and `notes` | Legacy Google records may remain readable through fallback logic | Remove/migrate Google plaintext fallback in a separately approved security change |
| `getRawToken()` falls back to `doc.token`; `readStoredConfig()` falls back to `doc.notes` | Plaintext compatibility weakens invariant | Fail closed for Google after migration |
| Non-production crypto fallback is `DEV_TOKEN_SECRET` | Shared/default local key can expose copied data | Never use production data with fallback; keep production assertion |
| Runtime config can mix env and DB values while `configSource` reports `env` if any env field exists | Provenance/audit ambiguity | Record field-level source or a mixed source state |
| Access-token exchange returns `undefined` on all errors | Weak diagnosability and audit classification | Return a sanitized typed auth error internally |
| Error redaction is pattern/key based | Arbitrary provider payloads or customer IDs may still appear | Store bounded typed errors; never persist raw headers/body |
| Customer and login-customer IDs are not secrets but reveal account topology | Over-broad read access can disclose account scope | Treat as restricted identifiers in sync-run detail responses |
| Existing sync route uses `google-ads.read` | Manager can currently trigger provider sync | Create a dedicated internal sync permission and do not add a public adapter endpoint |

`SecretRedactionInterceptor`, `redactSecrets`, and `redactSecretString` provide
useful response/log protection. They do not replace typed, allowlisted error
serialization.

## Current permissions

| Capability | Permission | Current roles |
|---|---|---|
| Read Google Ads routes, trigger current readonly sync, read latest run | `google-ads.read` | Director, Manager |
| Import/validate plans | `google-ads.plan` | Director, Manager |
| Approve/reject | `google-ads.approve` | Director |
| Execute | `google-ads.execute` | Director |
| Credential read/write | `google-ads.credentials.read/write` | Director |

## Required future permissions

- Internal adapter execution: `ai-data-pack.source-sync.google-ads.readonly.execute`
  or an equivalently narrow permission. Grant only to an internal worker and
  explicitly approved technical/Director role.
- Sanitized sync-detail read:
  `ai-data-pack.export.sync-detail.read`.
- Keep credential read/write permissions separate.
- Do not allow `google-ads.read`, `google-ads.plan`, or ordinary export-read
  permissions to trigger provider sync.
- Do not add a public adapter endpoint in the adapter PR.

## Customer scope

The adapter must accept only normalized customer IDs that are:

1. present as active local Google ad accounts;
2. allowed by the adapter policy;
3. paired with an approved login-customer ID; and
4. authorized for the requesting export-job scope.

Unknown, duplicate, malformed, or unapproved requested IDs must fail closed.

