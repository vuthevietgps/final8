# Risks And Open Questions

1. Auth binding

   The global auth role-permission map was not edited because Prompt 15 scoped code changes to `backend/src/ai-data-pack/**/*`. The endpoint policy reads explicit `user.permissions` plus existing role permissions. Production JWT/current-user claims must include the Prompt 15 permission names, or a later auth-scoped patch must bind them globally.

2. Jobless audit persistence

   Job-known events are appended to export jobs. Denied or invalid requests without a job are sanitized but in-process only. A later hardening patch should route these to a central persistent audit sink.

3. In-memory rate limits

   Current controls are conservative and named, but per-process. Clustered production should use shared Redis or the platform standard limiter.

4. Missing referenced addendum

   The referenced Prompt 13/14 addendum was not present. This implementation used Prompt 15 and available Prompt 13/14 outputs.

5. Download remains out of scope

   There is no download route, token, public URL, artifact byte response, or artifact rendering implementation.
