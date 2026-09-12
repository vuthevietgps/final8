import { getPermissionsForRole } from '../auth/role-permissions';
import { AiOperatorAuthContext } from './ai-operator.interfaces';

export function buildAuthContext(currentUser?: any, requestedRole?: string): AiOperatorAuthContext {
  const role = String(currentUser?.role || '').toLowerCase() || null;
  const userId = currentUser?.id || currentUser?._id || currentUser?.userId || currentUser?.sub || null;
  return {
    userId: userId ? String(userId) : null,
    role,
    requestedRole: requestedRole || null,
    fullName: currentUser?.fullName || null,
    permissions: getPermissionsForRole(role || undefined),
  };
}
