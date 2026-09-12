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
      case 'update_search_campaign':
        return [this.updateSearchCampaign(customerId, payload)];
      case 'update_campaign_bidding_strategy':
        return [this.updateCampaignBiddingStrategy(customerId, payload)];
      case 'create_ad_group':
        return [this.createAdGroup(customerId, payload)];
      case 'update_ad_group':
        return [this.updateAdGroup(customerId, payload)];
      case 'create_keyword':
        return [this.createKeyword(customerId, payload)];
      case 'update_keyword':
        return [this.updateKeyword(customerId, payload)];
      case 'pause_keyword':
        return [this.updateKeywordStatus(customerId, payload, 'PAUSED')];
      case 'resume_keyword':
        return [this.updateKeywordStatus(customerId, payload, 'ENABLED')];
      case 'create_responsive_search_ad':
        return [this.createResponsiveSearchAd(customerId, payload)];
      case 'update_responsive_search_ad':
        return [this.updateResponsiveSearchAd(customerId, payload)];
      case 'pause_responsive_search_ad':
        return [this.updateResponsiveSearchAdStatus(customerId, payload, 'PAUSED')];
      case 'resume_responsive_search_ad':
        return [this.updateResponsiveSearchAdStatus(customerId, payload, 'ENABLED')];
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
      containsEuPoliticalAdvertising: this.euPoliticalAdvertising(payload),
      networkSettings: {
        targetGoogleSearch: true,
        targetSearchNetwork: payload.searchPartnersEnabled === true,
        targetContentNetwork: false,
        targetPartnerSearchNetwork: false,
      },
      geoTargetTypeSetting: {
        positiveGeoTargetType: this.positiveGeoTargetType(payload.positiveGeoTargetType),
        negativeGeoTargetType: 'PRESENCE',
      },
      ...this.biddingStrategy(payload),
    };
    if (payload.endDate) campaign.endDate = this.googleDate(payload.endDate, 'endDate');

    const operations: MutateOperation[] = [
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
    for (const geoTargetConstantId of this.providerIdArray(
      payload.geoTargetConstantIds,
      'geoTargetConstantIds',
    )) {
      operations.push({
        campaignCriterionOperation: {
          create: {
            campaign: campaign.resourceName,
            negative: false,
            location: {
              geoTargetConstant: `geoTargetConstants/${geoTargetConstantId}`,
            },
          },
        },
      });
    }
    for (const languageConstantId of this.providerIdArray(
      payload.languageConstantIds,
      'languageConstantIds',
    )) {
      operations.push({
        campaignCriterionOperation: {
          create: {
            campaign: campaign.resourceName,
            negative: false,
            language: {
              languageConstant: `languageConstants/${languageConstantId}`,
            },
          },
        },
      });
    }
    return operations;
  }

  private updateSearchCampaign(customerId: string, payload: Record<string, any>): MutateOperation {
    const update: Record<string, any> = {
      resourceName: this.resourceName(
        customerId,
        'campaigns',
        payload.campaignId,
        payload.campaignResourceName,
      ),
    };
    const updateMask: string[] = [];
    if (payload.campaignName !== undefined) {
      update.name = this.text(payload.campaignName, 'campaignName');
      updateMask.push('name');
    }
    if (payload.endDate !== undefined) {
      update.endDate = this.googleDate(payload.endDate, 'endDate');
      updateMask.push('end_date');
    }
    if (!updateMask.length) {
      throw new BadRequestException('update_search_campaign requires campaignName and/or endDate.');
    }
    return {
      campaignOperation: {
        updateMask: updateMask.join(','),
        update,
      },
    };
  }

  private updateCampaignBiddingStrategy(
    customerId: string,
    payload: Record<string, any>,
  ): MutateOperation {
    const update: Record<string, any> = {
      resourceName: this.resourceName(
        customerId,
        'campaigns',
        payload.campaignId,
        payload.campaignResourceName,
      ),
    };
    let updateMask: string;
    if (payload.biddingStrategyType === 'MAXIMIZE_CLICKS') {
      updateMask = 'target_spend.cpc_bid_ceiling_micros';
      if (payload.maxCpcBidCeilingMicros !== undefined) {
        update.targetSpend = {
          cpcBidCeilingMicros: this.positiveInteger(
            payload.maxCpcBidCeilingMicros,
            'maxCpcBidCeilingMicros',
          ),
        };
      }
    } else if (payload.biddingStrategyType === 'MAXIMIZE_CONVERSIONS') {
      updateMask = 'maximize_conversions.target_cpa_micros';
      if (payload.targetCpaMicros !== undefined) {
        update.maximizeConversions = {
          targetCpaMicros: this.positiveInteger(
            payload.targetCpaMicros,
            'targetCpaMicros',
          ),
        };
      }
    } else {
      throw new BadRequestException(
        'Campaign bidding updates support MAXIMIZE_CLICKS or MAXIMIZE_CONVERSIONS only.',
      );
    }
    return {
      campaignOperation: {
        updateMask,
        update,
      },
    };
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

  private updateAdGroup(customerId: string, payload: Record<string, any>): MutateOperation {
    const update: Record<string, any> = {
      resourceName: this.resourceName(
        customerId,
        'adGroups',
        payload.adGroupId,
        payload.adGroupResourceName,
      ),
    };
    const mask: string[] = [];
    if (payload.adGroupName !== undefined) {
      update.name = this.text(payload.adGroupName, 'adGroupName');
      mask.push('name');
    }
    if (payload.cpcBidMicros !== undefined) {
      update.cpcBidMicros = this.nonNegativeInteger(payload.cpcBidMicros, 'cpcBidMicros');
      mask.push('cpc_bid_micros');
    }
    if (!mask.length) throw new BadRequestException('update_ad_group requires a mutable field.');
    return { adGroupOperation: { updateMask: mask.join(','), update } };
  }

  private createKeyword(customerId: string, payload: Record<string, any>): MutateOperation {
    const matchType = String(payload.matchType || '').toUpperCase();
    if (!['EXACT', 'PHRASE', 'BROAD'].includes(matchType)) {
      throw new BadRequestException('Keyword matchType must be EXACT, PHRASE, or BROAD.');
    }
    const create: Record<string, any> = {
      adGroup: this.resourceName(customerId, 'adGroups', payload.adGroupId, undefined),
      status: 'PAUSED',
      negative: Boolean(payload.negative),
      keyword: {
        text: this.text(payload.keywordText, 'keywordText'),
        matchType,
      },
    };
    if (create.negative) {
      throw new BadRequestException(
        'Negative keyword creation is disabled because this ERP does not support delete or safe negative-criterion updates.',
      );
    }
    if (!create.negative && payload.cpcBidMicros !== undefined) {
      create.cpcBidMicros = this.nonNegativeInteger(payload.cpcBidMicros, 'cpcBidMicros');
    }
    if (!create.negative && payload.finalUrl !== undefined) {
      create.finalUrls = [this.httpsUrl(payload.finalUrl)];
    }
    return {
      adGroupCriterionOperation: {
        create,
      },
    };
  }

  private updateKeyword(customerId: string, payload: Record<string, any>): MutateOperation {
    const update: Record<string, any> = {
      resourceName: this.criterionResourceName(customerId, payload),
    };
    const mask: string[] = [];
    if (payload.cpcBidMicros !== undefined) {
      update.cpcBidMicros = this.nonNegativeInteger(payload.cpcBidMicros, 'cpcBidMicros');
      mask.push('cpc_bid_micros');
    }
    if (payload.finalUrl !== undefined) {
      update.finalUrls = [this.httpsUrl(payload.finalUrl)];
      mask.push('final_urls');
    }
    if (!mask.length) throw new BadRequestException('update_keyword requires a mutable field.');
    return { adGroupCriterionOperation: { updateMask: mask.join(','), update } };
  }

  private updateKeywordStatus(
    customerId: string,
    payload: Record<string, any>,
    status: 'PAUSED' | 'ENABLED',
  ): MutateOperation {
    return {
      adGroupCriterionOperation: {
        updateMask: 'status',
        update: {
          resourceName: this.criterionResourceName(customerId, payload),
          status,
        },
      },
    };
  }

  private createResponsiveSearchAd(customerId: string, payload: Record<string, any>): MutateOperation {
    const headlines = this.textArray(payload.headlines, 'headlines', 3);
    const descriptions = this.textArray(payload.descriptions, 'descriptions', 2);
    const finalUrl = this.httpsUrl(payload.finalUrl);
    const responsiveSearchAd: Record<string, any> = {
      headlines: this.pinnedAssets(
        headlines,
        payload.headlinePins,
        ['HEADLINE_1', 'HEADLINE_2', 'HEADLINE_3'],
        'headlinePins',
      ),
      descriptions: this.pinnedAssets(
        descriptions,
        payload.descriptionPins,
        ['DESCRIPTION_1', 'DESCRIPTION_2'],
        'descriptionPins',
      ),
    };
    if (payload.path1) responsiveSearchAd.path1 = this.text(payload.path1, 'path1');
    if (payload.path2) responsiveSearchAd.path2 = this.text(payload.path2, 'path2');
    const ad: Record<string, any> = {
      finalUrls: [finalUrl],
      responsiveSearchAd,
    };
    if (payload.trackingUrlTemplate !== undefined) {
      ad.trackingUrlTemplate = this.trackingTemplate(payload.trackingUrlTemplate);
    }
    if (payload.finalUrlSuffix !== undefined) {
      ad.finalUrlSuffix = this.finalUrlSuffix(payload.finalUrlSuffix);
    }
    return {
      adGroupAdOperation: {
        create: {
          adGroup: this.resourceName(customerId, 'adGroups', payload.adGroupId, undefined),
          status: 'PAUSED',
          ad,
        },
      },
    };
  }

  private updateResponsiveSearchAd(customerId: string, payload: Record<string, any>): MutateOperation {
    const update: Record<string, any> = {
      resourceName: `customers/${customerId}/ads/${this.providerId(payload.adId, 'adId')}`,
    };
    const mask: string[] = [];
    if (payload.finalUrl !== undefined) {
      update.finalUrls = [this.httpsUrl(payload.finalUrl)];
      mask.push('final_urls');
    }
    const responsiveSearchAd: Record<string, any> = {};
    if (payload.headlines !== undefined) {
      if (payload.headlinePins === undefined) {
        throw new BadRequestException(
          'RSA headline replacement requires headlinePins explicitly; use [] to clear pins.',
        );
      }
      responsiveSearchAd.headlines = this.pinnedAssets(
        this.textArray(payload.headlines, 'headlines', 3),
        payload.headlinePins,
        ['HEADLINE_1', 'HEADLINE_2', 'HEADLINE_3'],
        'headlinePins',
      );
      mask.push('responsive_search_ad.headlines');
    }
    if (payload.descriptions !== undefined) {
      if (payload.descriptionPins === undefined) {
        throw new BadRequestException(
          'RSA description replacement requires descriptionPins explicitly; use [] to clear pins.',
        );
      }
      responsiveSearchAd.descriptions = this.pinnedAssets(
        this.textArray(payload.descriptions, 'descriptions', 2),
        payload.descriptionPins,
        ['DESCRIPTION_1', 'DESCRIPTION_2'],
        'descriptionPins',
      );
      mask.push('responsive_search_ad.descriptions');
    }
    if (payload.path1 !== undefined) {
      responsiveSearchAd.path1 = this.text(payload.path1, 'path1');
      mask.push('responsive_search_ad.path1');
    }
    if (payload.path2 !== undefined) {
      responsiveSearchAd.path2 = this.text(payload.path2, 'path2');
      mask.push('responsive_search_ad.path2');
    }
    if (Object.keys(responsiveSearchAd).length) update.responsiveSearchAd = responsiveSearchAd;
    if (payload.trackingUrlTemplate !== undefined) {
      update.trackingUrlTemplate = this.trackingTemplate(payload.trackingUrlTemplate);
      mask.push('tracking_url_template');
    }
    if (payload.finalUrlSuffix !== undefined) {
      update.finalUrlSuffix = this.finalUrlSuffix(payload.finalUrlSuffix);
      mask.push('final_url_suffix');
    }
    if (!mask.length) throw new BadRequestException('update_responsive_search_ad requires a mutable field.');
    return { adOperation: { updateMask: mask.join(','), update } };
  }

  private updateResponsiveSearchAdStatus(
    customerId: string,
    payload: Record<string, any>,
    status: 'PAUSED' | 'ENABLED',
  ): MutateOperation {
    const expected = `customers/${customerId}/adGroupAds/${this.providerId(payload.adGroupId, 'adGroupId')}~${this.providerId(payload.adId, 'adId')}`;
    if (String(payload.adGroupAdResourceName || '') !== expected) {
      throw new BadRequestException('Invalid canonical Responsive Search Ad resource name.');
    }
    return {
      adGroupAdOperation: {
        updateMask: 'status',
        update: { resourceName: expected, status },
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

  private criterionResourceName(customerId: string, payload: Record<string, any>) {
    const adGroupId = this.providerId(payload.adGroupId, 'adGroupId');
    const criterionId = this.providerId(payload.criterionId, 'criterionId');
    const expected = `customers/${customerId}/adGroupCriteria/${adGroupId}~${criterionId}`;
    if (String(payload.criterionResourceName || '') !== expected) {
      throw new BadRequestException('Invalid canonical keyword criterion resource name.');
    }
    return expected;
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

  private providerIdArray(value: any, field: string) {
    if (!Array.isArray(value) || !value.length) {
      throw new BadRequestException(`${field} requires at least one numeric provider ID.`);
    }
    const values = value.map((item) => this.providerId(item, field));
    if (new Set(values).size !== values.length) {
      throw new BadRequestException(`${field} must not contain duplicate IDs.`);
    }
    return values;
  }

  private positiveGeoTargetType(value: any) {
    if (!['PRESENCE', 'PRESENCE_OR_INTEREST'].includes(value)) {
      throw new BadRequestException(
        'positiveGeoTargetType must be PRESENCE or PRESENCE_OR_INTEREST.',
      );
    }
    return value;
  }

  private euPoliticalAdvertising(payload: Record<string, any>) {
    if (payload.doesNotContainEuPoliticalAdvertising !== true) {
      throw new BadRequestException(
        'New Search campaigns must declare doesNotContainEuPoliticalAdvertising=true.',
      );
    }
    return 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING';
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

  private pinnedAssets(
    texts: string[],
    pins: unknown,
    allowedFields: string[],
    field: string,
  ) {
    const byIndex = new Map<number, string>();
    if (pins !== undefined) {
      if (!Array.isArray(pins) || pins.length > texts.length) {
        throw new BadRequestException(`${field} is invalid.`);
      }
      for (const pin of pins as any[]) {
        if (!pin || typeof pin !== 'object' || Array.isArray(pin)
          || Object.keys(pin).some((key) => !['index', 'pinnedField'].includes(key))
          || !Number.isInteger(pin.index) || pin.index < 0 || pin.index >= texts.length
          || byIndex.has(pin.index) || !allowedFields.includes(pin.pinnedField)) {
          throw new BadRequestException(`${field} contains an invalid or duplicate pin.`);
        }
        byIndex.set(pin.index, pin.pinnedField);
      }
    }
    return texts.map((text, index) => ({
      text,
      ...(byIndex.has(index) ? { pinnedField: byIndex.get(index) } : {}),
    }));
  }

  private httpsUrl(value: any) {
    try {
      const url = new URL(String(value || ''));
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
      this.rejectSecretLikeData(url.toString(), 'finalUrl');
      return url.toString();
    } catch {
      throw new BadRequestException('finalUrl must be a valid HTTPS URL without credentials or secret-like data.');
    }
  }

  private trackingTemplate(value: any) {
    const template = this.text(value, 'trackingUrlTemplate');
    if (template.length > 2048 || !template.includes('{lpurl}')
      || /[\u0000-\u001F\u007F]/.test(template)) {
      throw new BadRequestException('trackingUrlTemplate is invalid.');
    }
    this.rejectSecretLikeData(template, 'trackingUrlTemplate');
    const allowlist = [
      process.env.GOOGLE_ADS_TRACKING_DOMAIN_ALLOWLIST,
      process.env.GOOGLE_ADS_LANDING_PAGE_ALLOWLIST,
      process.env.AI_MARKETING_LANDING_PAGE_ALLOWLIST,
    ].flatMap((entry) => String(entry || '').split(','))
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
    if (!allowlist.length) {
      throw new BadRequestException('Tracking domain allowlist is empty.');
    }
    try {
      const parsed = new URL(template.replace(/\{[^{}]+\}/g, 'value'));
      const host = parsed.hostname.toLowerCase();
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password
        || !allowlist.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
        throw new Error();
      }
    } catch {
      throw new BadRequestException('trackingUrlTemplate domain is invalid or not allowlisted.');
    }
    return template;
  }

  private finalUrlSuffix(value: any) {
    const suffix = this.text(value, 'finalUrlSuffix');
    if (suffix.length > 2048 || /^[?#]/.test(suffix) || suffix.includes('://')
      || suffix.includes('#') || /[\u0000-\u001F\u007F]/.test(suffix)
      || suffix.split('&').some((part) => !part || !part.includes('='))) {
      throw new BadRequestException('finalUrlSuffix must be safe query-string key=value pairs.');
    }
    this.rejectSecretLikeData(suffix, 'finalUrlSuffix');
    return suffix;
  }

  private rejectSecretLikeData(value: string, field: string) {
    let decoded = value;
    try { decoded = decodeURIComponent(value); } catch { /* keep raw value */ }
    if (/(access_?token|refresh_?token|api_?key|client_?secret|password|authorization)/i
      .test(decoded)) {
      throw new BadRequestException(`${field} must not contain secret-like parameter names or values.`);
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

  private biddingStrategy(payload: Record<string, any>) {
    switch (payload.biddingStrategyType) {
      case 'MAXIMIZE_CLICKS':
        return {
          targetSpend: payload.maxCpcBidCeilingMicros === undefined
            ? {}
            : {
              cpcBidCeilingMicros: this.positiveInteger(
                payload.maxCpcBidCeilingMicros,
                'maxCpcBidCeilingMicros',
              ),
            },
        };
      case 'MAXIMIZE_CONVERSIONS':
        return {
          maximizeConversions: payload.targetCpaMicros === undefined
            ? {}
            : {
              targetCpaMicros: this.positiveInteger(
                payload.targetCpaMicros,
                'targetCpaMicros',
              ),
            },
        };
      case 'MAXIMIZE_CONVERSION_VALUE':
        return { maximizeConversionValue: {} };
      case 'MANUAL_CPC':
        return { manualCpc: { enhancedCpcEnabled: false } };
      default:
        throw new BadRequestException('Unsupported biddingStrategyType.');
    }
  }

  private positiveInteger(value: any, field: string) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number <= 0) {
      throw new BadRequestException(`${field} must be a positive safe integer.`);
    }
    return number;
  }
}
