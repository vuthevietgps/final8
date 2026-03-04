import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_MODULE_KEY } from './feature-module.decorator';
import { getCurrentPlan, isModuleAllowed, PLAN_CONFIG } from './plan-config';

@Injectable()
export class FeatureGateGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Lấy featureModule từ controller-level metadata
    const moduleName = this.reflector.get<string>(
      FEATURE_MODULE_KEY,
      context.getClass(),
    );

    // Nếu controller không gắn @FeatureModule → luôn cho phép (core modules)
    if (!moduleName) {
      return true;
    }

    if (isModuleAllowed(moduleName)) {
      return true;
    }

    const plan = getCurrentPlan();
    throw new ForbiddenException(
      `Module "${moduleName}" không khả dụng trong gói "${plan}". Vui lòng nâng cấp gói để sử dụng tính năng này.`,
    );
  }
}
