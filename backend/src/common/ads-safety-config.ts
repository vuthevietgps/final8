export interface AdsSafetyConfig {
  requireApproval: boolean;
  dryRun: boolean;
  providerExecutionEnabled: boolean;
  googleAdsProductionEnabled: boolean;
}

export const CANONICAL_ADS_EXECUTION_REQUIRED = Object.freeze({
  code: 'CANONICAL_GOOGLE_ADS_V2_EXECUTION_REQUIRED',
  message:
    'Live ad provider mutations are only allowed through the Google Ads V2 execution plan workflow: import, provider validateOnly, per-action approval, then execute.',
  canonicalWorkflow: [
    'POST /google-ads/action-plans/import',
    'POST /google-ads/action-plans/:planId/validate',
    'PATCH /google-ads/action-plans/:planId/items/:actionId/approve',
    'POST /google-ads/action-plans/:planId/execute',
  ],
});

export function canonicalAdsExecutionRequiredPayload() {
  return {
    error: CANONICAL_ADS_EXECUTION_REQUIRED.code,
    message: CANONICAL_ADS_EXECUTION_REQUIRED.message,
    canonicalWorkflow: [...CANONICAL_ADS_EXECUTION_REQUIRED.canonicalWorkflow],
  };
}

export function readBooleanEnv(
  name: string,
  defaultValue: boolean,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env[name]?.trim().toLowerCase();
  if (!raw) return defaultValue;
  if (['true', '1', 'yes', 'on'].includes(raw)) return true;
  if (['false', '0', 'no', 'off'].includes(raw)) return false;
  return defaultValue;
}

export function getAdsSafetyConfig(env: NodeJS.ProcessEnv = process.env): AdsSafetyConfig {
  return {
    requireApproval: readBooleanEnv('AI_MARKETING_REQUIRE_APPROVAL', true, env),
    dryRun: readBooleanEnv('AI_MARKETING_DRY_RUN', true, env),
    providerExecutionEnabled: readBooleanEnv('AI_MARKETING_PROVIDER_EXECUTION_ENABLED', false, env),
    googleAdsProductionEnabled: readBooleanEnv('GOOGLE_ADS_PRODUCTION_ENABLED', false, env),
  };
}

export function assertApiTokenSecretForProduction(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV?.trim().toLowerCase() !== 'production') return;
  if (!env.API_TOKEN_SECRET?.trim()) {
    throw new Error('CRITICAL: API_TOKEN_SECRET must be set in production environment.');
  }
}
