import { AuthGuard } from '../../core/guards/auth.guard';
import { routes } from '../../app.routes';

describe('AdsFoundationReviewerDocs route', () => {
  it('registers a protected ai-data-pack marketer-read route for BA review', () => {
    const route = routes.find((item) => item.path === 'ai/ads-foundation-reviewer-docs');

    expect(route).toBeTruthy();
    expect(route?.canActivate).toContain(AuthGuard);
    expect(route?.data?.['permissions']).toEqual(['ai-data-pack.marketer.read']);
    expect(route?.data?.['featureModule']).toBe('ai-marketing');
  });
});
