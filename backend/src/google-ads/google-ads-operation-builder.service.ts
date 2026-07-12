import { BadRequestException, Injectable } from '@nestjs/common';
import { GoogleAdsActionPlanItem } from './schemas/google-ads-action-plan.schema';

type MutateOperation = Record<string, any>;

@Injectable()
export class GoogleAdsOperationBuilderService {
  build(action: GoogleAdsActionPlanItem): MutateOperation[] {
    const payload = action.typedPayload || {};
    const customerId = this.providerId(action.customerId, 'customerId');

    switch (action.actionType) {
      case 'create_search_campaign':
        return this.createSearchCampaign(customerId, payload);
      case 'create_ad_group':
        return [this.createAdGroup(customerId, payload)];
      case 'create_keyword':
        return [this.createKeyword(customerId, payload)];
      case 'create_responsive_search_ad':
        return [this.createResponsiveSearchAd(customerId, payload)];
      case 'update_campaign_budget':
        return [this.updateCampaignBudget(customerId, payload)];
      case 'pause_campaign':
        return [this.updateCampaignStatus(customerId, payload, 'PAUSED')];
      case 'resume_campaign':
        return [this.updateCampaignStatus(customerId, payload, 'ENABLED')];
      case 'pause_ad_group':
        return [this.updateAdGroupStatus(customerId, payload, 'PAUSED')];
      case 'resume_ad_group':
        return [this.updateAdGroupStatus(customerId, payload, 'ENABLED')];
      case 'monitor_only':
        return [];
      default:
        throw new BadRequestException(`Unsupported Google Ads action type: ${action.actionType}`);
    }
  }

  private createSearchCampaign(customerId: string, payload: Record<string, any>): MutateOperation[] {
    if (payload.status !== 'PAUSED' || payload.advertisingChannelType !== 'SEARCH') {
      throw new BadRequestException('New Google Search campaigns must use status PAUSED and channel SEARCH.');
    }
    const budgetResourceName = `customers/${customerId}/campaignBudgets/-1`;
    const campaign: Record<string, any> = {
      resourceName: `customers/${customerId}/campaigns/-2`,
      name: this.text(payload.campaignName, 'campaignName'),
      campaignBudget: budgetResourceName,
      advertisingChannelType: 'SEARCH',
      status: 'PAUSED',
      startDate: this.googleDate(payload.startDate, 'startDate'),
      ...this.biddingStrategy(payload.biddingStrategyType),
    };
    if (payload.endDate) campaign.endDate = this.googleDate(payload.endDate, 'endDate');

    return [
      {
        campaignBudgetOperation: {
          create: {
            resourceName: budgetResourceName,
            name: this.text(payload.budgetName, 'budgetName'),
            amountMicros: this.amountMicros(payload.dailyBudget),
            deliveryMethod: 'STANDARD',
            explicitlyShared: false,
          },
        },
      },
      { campaignOperation: { create: campaign } },
    ];
  }

  private createAdGroup(customerId: string, payload: Record<string, any>): MutateOperation {
    if (payload.status !== 'PAUSED') throw new BadRequestException('New ad groups must use status PAUSED.');
    const create: Record<string, any> = {
      campaign: this.resourceName(customerId, 'campaigns', payload.campaignId, undefined),
      name: this.text(payload.adGroupName, 'adGroupName'),
      status: 'PAUSED',
      type: 'SEARCH_STANDARD',
    };
    if (payload.cpcBidMicros !== undefined) create.cpcBidMicros = this.nonNegativeInteger(payload.cpcBidMicros, 'cpcBidMicros');
    return { adGroupOperation: { create } };
  }

  private createKeyword(customerId: string, payload: Record<string, any>): MutateOperation {
    const matchType = String(payload.matchType || '').toUpperCase();
    if (!['EXACT', 'PHRASE', 'BROAD'].includes(matchType)) {
      throw new BadRequestException('Keyword matchType must be EXACT, PHRASE, or BROAD.');
    }
    return {
      adGroupCriterionOperation: {
        create: {
          adGroup: this.resourceName(customerId, 'adGroups', payload.adGroupId, undefined),
          status: 'PAUSED',
          negative: Boolean(payload.negative),
          keyword: {
            text: this.text(payload.keywordText, 'keywordText'),
            matchType,
          },
        },
      },
    };
  }

  private createResponsiveSearchAd(customerId: string, payload: Record<string, any>): MutateOperation {
    const headlines = this.textArray(payload.headlines, 'headlines', 3);
    const descriptions = this.textArray(payload.descriptions, 'descriptions', 2);
    const finalUrl = this.httpsUrl(payload.finalUrl);
    const responsiveSearchAd: Record<string, any> = {
      headlines: headlines.map((text) => ({ text })),
      descriptions: descriptions.map((text) => ({ text })),
    };
    if (payload.path1) responsiveSearchAd.path1 = this.text(payload.path1, 'path1');
    if (payload.path2) responsiveSearchAd.path2 = this.text(payload.path2, 'path2');
    return {
      adGroupAdOperation: {
        create: {
          adGroup: this.resourceName(customerId, 'adGroups', payload.adGroupId, undefined),
          status: 'PAUSED',
          ad: {
            finalUrls: [finalUrl],
            responsiveSearchAd,
          },
        },
      },
    };
  }

  private updateCampaignBudget(customerId: string, payload: Record<string, any>): MutateOperation {
    const resourceName = this.resourceName(
      customerId,
      'campaignBudgets',
      payload.campaignBudgetId,
      payload.campaignBudgetResourceName,
    );
    return {
      campaignBudgetOperation: {
        updateMask: 'amount_micros',
        update: {
          resourceName,
          amountMicros: this.amountMicros(payload.dailyBudget),
        },
      },
    };
  }

  private updateCampaignStatus(customerId: string, payload: Record<string, any>, status: 'PAUSED' | 'ENABLED') {
    return {
      campaignOperation: {
        updateMask: 'status',
        update: {
          resourceName: this.resourceName(customerId, 'campaigns', payload.campaignId, payload.campaignResourceName),
          status,
        },
      },
    };
  }

  private updateAdGroupStatus(customerId: string, payload: Record<string, any>, status: 'PAUSED' | 'ENABLED') {
    return {
      adGroupOperation: {
        updateMask: 'status',
        update: {
          resourceName: this.resourceName(customerId, 'adGroups', payload.adGroupId, payload.adGroupResourceName),
          status,
        },
      },
    };
  }

  private resourceName(customerId: string, collection: string, id: any, supplied: any) {
    const expected = new RegExp(`^customers/${customerId}/${collection}/\\d+$`);
    if (supplied !== undefined && supplied !== null && supplied !== '') {
      const value = String(supplied).trim();
      if (!expected.test(value)) throw new BadRequestException(`Invalid ${collection} resource name.`);
      if (id !== undefined && id !== null && id !== '') {
        const providerId = this.providerId(id, `${collection}Id`);
        if (!value.endsWith(`/${providerId}`)) {
          throw new BadRequestException(`${collection} resource name does not match its provider ID.`);
        }
      }
      return value;
    }
    return `customers/${customerId}/${collection}/${this.providerId(id, `${collection}Id`)}`;
  }

  private providerId(value: any, field: string) {
    const normalized = String(value || '').trim();
    if (!/^\d+$/.test(normalized)) throw new BadRequestException(`${field} must be a numeric provider ID.`);
    return normalized;
  }

  private text(value: any, field: string) {
    const normalized = String(value || '').trim();
    if (!normalized) throw new BadRequestException(`${field} is required.`);
    return normalized;
  }

  private textArray(value: any, field: string, minimum: number) {
    if (!Array.isArray(value) || value.length < minimum) {
      throw new BadRequestException(`${field} requires at least ${minimum} values.`);
    }
    return value.map((item) => this.text(item, field));
  }

  private httpsUrl(value: any) {
    try {
      const url = new URL(String(value || ''));
      if (url.protocol !== 'https:') throw new Error();
      return url.toString();
    } catch {
      throw new BadRequestException('finalUrl must be a valid HTTPS URL.');
    }
  }

  private amountMicros(value: any) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('dailyBudget must be greater than zero.');
    return Math.round(amount * 1_000_000);
  }

  private nonNegativeInteger(value: any, field: string) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0) throw new BadRequestException(`${field} must be a non-negative integer.`);
    return number;
  }

  private googleDate(value: any, field: string) {
    const normalized = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new BadRequestException(`${field} must use YYYY-MM-DD.`);
    return normalized.replace(/-/g, '');
  }

  private biddingStrategy(value: any) {
    switch (value) {
      case 'MAXIMIZE_CONVERSIONS':
        return { maximizeConversions: {} };
      case 'MAXIMIZE_CONVERSION_VALUE':
        return { maximizeConversionValue: {} };
      case 'MANUAL_CPC':
        return { manualCpc: { enhancedCpcEnabled: false } };
      default:
        throw new BadRequestException('Unsupported biddingStrategyType.');
    }
  }
}
