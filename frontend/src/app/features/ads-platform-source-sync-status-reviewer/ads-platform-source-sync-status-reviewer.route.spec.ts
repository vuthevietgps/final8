import { routes } from '../../app.routes';

describe('AdsPlatformSourceSyncStatusReviewer route', () => {
  it('is protected as an ai-marketing local reviewer route', () => {
    const route = routes.find((candidate) => (
      candidate.path === 'ai/ads-platform-source-sync-status-reviewer'
    ));

    expect(route).toBeTruthy();
    expect(route?.data?.['permissions']).toEqual(['ai-data-pack.marketer.read']);
    expect(route?.data?.['featureModule']).toBe('ai-marketing');
    expect(route?.loadComponent).toBeTruthy();
  });
});
