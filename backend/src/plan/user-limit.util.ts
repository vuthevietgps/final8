import { ForbiddenException } from '@nestjs/common';
import { getCurrentPlan, PLAN_CONFIG } from './plan-config';

/**
 * Enforce active-user quota for current plan.
 * `additionalActiveUsers` is how many active users will be added by the action.
 */
export async function enforceActiveUserLimit(
  countActiveUsers: () => Promise<number>,
  additionalActiveUsers = 1,
): Promise<void> {
  if (additionalActiveUsers <= 0) {
    return;
  }

  const plan = getCurrentPlan();
  const maxUsers = PLAN_CONFIG[plan].maxUsers;
  if (maxUsers === Infinity) {
    return;
  }

  const currentCount = await countActiveUsers();
  if (currentCount + additionalActiveUsers > maxUsers) {
    throw new ForbiddenException(
      `Goi "${plan}" chi cho phep toi da ${maxUsers} users. Hien tai da co ${currentCount} users. Vui long nang cap goi.`,
    );
  }
}
