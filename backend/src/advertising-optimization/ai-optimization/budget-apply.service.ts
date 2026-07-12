import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AdGroup, AdGroupDocument } from '../../ad-group/schemas/ad-group.schema';
import { AdAccount, AdAccountDocument } from '../../ad-account/schemas/ad-account.schema';
import { CANONICAL_ADS_EXECUTION_REQUIRED } from '../../common/ads-safety-config';

export interface ProviderActionResult {
  ok: boolean;
  action: 'set_budget' | 'pause' | 'resume';
  code?: string;
  platform?: string;
  message?: string;
  request?: Record<string, any>;
  response?: Record<string, any>;
}

@Injectable()
export class BudgetApplyService {
  private readonly logger = new Logger(BudgetApplyService.name);

  constructor(
    @InjectModel(AdGroup.name) private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(AdAccount.name) private readonly adAccountModel: Model<AdAccountDocument>,
  ) {}

  async resolveContext(adGroupId: string): Promise<{ adGroup?: AdGroup | null; adAccount?: AdAccount | null }> {
    if (!adGroupId) return {};
    const adGroup = await this.adGroupModel.findOne({ adGroupId }).lean();
    const adAccount = adGroup?.adAccountId ? await this.adAccountModel.findById(adGroup.adAccountId).lean() : null;
    return { adGroup, adAccount };
  }

  async applyBudgetToProvider(
    adGroup: AdGroup | null | undefined,
    adAccount: AdAccount | null,
    newBudget: number,
  ): Promise<boolean> {
    const result = await this.applyBudgetToProviderDetailed(adGroup, adAccount, newBudget);
    return result.ok;
  }

  async applyBudgetToProviderDetailed(
    adGroup: AdGroup | null | undefined,
    _adAccount: AdAccount | null,
    _newBudget: number,
  ): Promise<ProviderActionResult> {
    if (!adGroup) {
      this.logger.warn('applyBudgetToProvider: missing adGroup context');
      return { ok: false, action: 'set_budget', message: 'Missing adGroup context' };
    }

    return this.canonicalBlock('set_budget', adGroup.platform);
  }

  async pauseAdGroupOnProvider(
    adGroup: AdGroup | null | undefined,
    _adAccount: AdAccount | null,
  ): Promise<ProviderActionResult> {
    if (!adGroup) return { ok: false, action: 'pause', message: 'Missing adGroup context' };
    return this.canonicalBlock('pause', adGroup.platform);
  }

  async resumeAdGroupOnProvider(
    adGroup: AdGroup | null | undefined,
    _adAccount: AdAccount | null,
  ): Promise<ProviderActionResult> {
    if (!adGroup) return { ok: false, action: 'resume', message: 'Missing adGroup context' };
    return this.canonicalBlock('resume', adGroup.platform);
  }

  private canonicalBlock(
    action: ProviderActionResult['action'],
    platform?: string,
  ): ProviderActionResult {
    return {
      ok: false,
      action,
      platform,
      code: CANONICAL_ADS_EXECUTION_REQUIRED.code,
      message: CANONICAL_ADS_EXECUTION_REQUIRED.message,
    };
  }
}
