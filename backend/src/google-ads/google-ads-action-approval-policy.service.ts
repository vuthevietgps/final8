import { BadRequestException, Injectable } from '@nestjs/common';
import { GoogleAdsActionPlanItem } from './schemas/google-ads-action-plan.schema';

@Injectable()
export class GoogleAdsActionApprovalPolicyService {
  assertCanApprove(action: GoogleAdsActionPlanItem) {
    if (action.providerValidationStatus !== 'provider_validate_passed') {
      throw new BadRequestException('Action must pass provider validateOnly before approval.');
    }
    const expiresAt = action.providerValidationExpiresAt
      ? new Date(action.providerValidationExpiresAt)
      : null;
    if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Provider validateOnly evidence is missing or expired.');
    }
    if (!/^[a-f0-9]{64}$/.test(String(action.providerValidationOperationHash || ''))
      || !String(action.providerValidationApiVersion || '').trim()
      || !/^[a-f0-9]{64}$/.test(String(action.providerValidationCredentialBindingHash || ''))
      || !String(action.providerValidationCredentialReferenceId || '').trim()) {
      throw new BadRequestException('Provider validateOnly evidence is not bound to operations and credentials.');
    }
  }
}
