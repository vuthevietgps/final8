import {
  googleAdsCredentialBindingHash,
  googleAdsOperationHash,
} from './google-ads-integrity.util';

describe('Google Ads integrity binding', () => {
  it('produces a stable operation hash independent of object key order', () => {
    const first = googleAdsOperationHash([{ campaignOperation: { update: { status: 'PAUSED', resourceName: 'x' } } }]);
    const second = googleAdsOperationHash([{ campaignOperation: { update: { resourceName: 'x', status: 'PAUSED' } } }]);

    expect(first).toBe(second);
  });

  it('changes the operation hash when an executable value changes', () => {
    const paused = googleAdsOperationHash([{ campaignOperation: { update: { status: 'PAUSED' } } }]);
    const enabled = googleAdsOperationHash([{ campaignOperation: { update: { status: 'ENABLED' } } }]);

    expect(paused).not.toBe(enabled);
  });

  it('binds validation evidence to credential material without returning it', () => {
    const config: any = {
      clientId: 'client',
      clientSecret: 'secret-a',
      refreshToken: 'refresh',
      developerToken: 'developer',
      loginCustomerId: '123-456-7890',
      apiVersion: 'v24',
      configSource: 'database',
      refreshTokenSource: 'database',
    };
    const first = googleAdsCredentialBindingHash(config);
    const second = googleAdsCredentialBindingHash({ ...config, clientSecret: 'secret-b' });

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain('secret-a');
    expect(first).not.toBe(second);
  });
});
