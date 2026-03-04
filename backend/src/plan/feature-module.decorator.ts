import { SetMetadata } from '@nestjs/common';

export const FEATURE_MODULE_KEY = 'featureModule';

/**
 * Decorator gắn vào Controller để khai báo controller thuộc module nào.
 * FeatureGateGuard sẽ đọc metadata này để kiểm tra plan có cho phép không.
 *
 * Ví dụ: @FeatureModule('finance') trên FinanceController
 * → Nếu PLAN_TYPE=starter, request sẽ bị chặn 403.
 */
export const FeatureModule = (moduleName: string) =>
  SetMetadata(FEATURE_MODULE_KEY, moduleName);
