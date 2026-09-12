import { UserRole } from '../user/user.enum';
import { getPermissionsForRole } from './role-permissions';

describe('Meta Ads role permissions', () => {
  it('allows a manager to make and validate plans but not approve or execute them', () => {
    const permissions = getPermissionsForRole(UserRole.MANAGER);

    expect(permissions).toEqual(expect.arrayContaining([
      'meta-ads.read',
      'meta-ads.plan',
      'meta-ads.validate',
    ]));
    expect(permissions).not.toContain('meta-ads.approve');
    expect(permissions).not.toContain('meta-ads.execute');
  });

  it('grants directors the explicit Meta approval and execution permissions', () => {
    expect(getPermissionsForRole(UserRole.DIRECTOR)).toEqual(expect.arrayContaining([
      'meta-ads.read',
      'meta-ads.plan',
      'meta-ads.validate',
      'meta-ads.approve',
      'meta-ads.execute',
    ]));
  });
});
