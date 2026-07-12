import { assertApiTokenSecretForProduction, getAdsSafetyConfig } from './ads-safety-config';

describe('ads safety config', () => {
  it('uses fail-closed defaults when flags are missing', () => {
    expect(getAdsSafetyConfig({})).toEqual({
      requireApproval: true,
      dryRun: true,
      providerExecutionEnabled: false,
      googleAdsProductionEnabled: false,
    });
  });

  it('fails production startup when API_TOKEN_SECRET is missing', () => {
    expect(() => assertApiTokenSecretForProduction({ NODE_ENV: 'production' })).toThrow(
      'API_TOKEN_SECRET must be set',
    );
    expect(() =>
      assertApiTokenSecretForProduction({ NODE_ENV: 'production', API_TOKEN_SECRET: 'configured-secret' }),
    ).not.toThrow();
  });
});
