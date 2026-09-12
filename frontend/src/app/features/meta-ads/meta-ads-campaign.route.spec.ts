import { routes } from '../../app.routes';

describe('Meta Ads campaign route', () => {
  it('is guarded by the dedicated read permission and AI Marketing feature gate', () => {
    const route = routes.find((candidate) => candidate.path === 'meta-ads/campaigns');

    expect(route).toBeDefined();
    expect(route?.data?.['permissions']).toEqual(['meta-ads.read']);
    expect(route?.data?.['featureModule']).toBe('ai-marketing');
  });
});
