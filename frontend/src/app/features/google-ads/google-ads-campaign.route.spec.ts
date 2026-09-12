import { routes } from '../../app.routes';

describe('Google Ads campaign route', () => {
  it('is guarded by Google Ads read permission and AI Marketing feature gate', () => {
    const route = routes.find((candidate) => candidate.path === 'google-ads/campaigns');

    expect(route).toBeDefined();
    expect(route?.data?.['permissions']).toEqual(['google-ads.read']);
    expect(route?.data?.['featureModule']).toBe('ai-marketing');
  });
});
