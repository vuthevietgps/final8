import { BadRequestException, Injectable } from '@nestjs/common';
import { GoogleAdsActionPlanItem } from './schemas/google-ads-action-plan.schema';

@Injectable()
export class GoogleAdsActionApprovalPolicyService {
  assertCanApprove(action: GoogleAdsActionPlanItem) {
    if (action.providerValidationStatus !== 'provider_validate_passed') {
      throw new BadRequestException('Action must pass provider validateOnly before approval.');
    }
  }
}
