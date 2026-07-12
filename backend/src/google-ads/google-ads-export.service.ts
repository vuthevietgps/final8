import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import AdmZip = require('adm-zip');
import { createHash, randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { Connection, Model } from 'mongoose';
import { join, resolve } from 'path';
import { getAdsSafetyConfig } from '../common/ads-safety-config';
import { redactSecretString } from '../common/utils/secret-redaction.util';
import { GoogleAdsExport, GoogleAdsExportDocument } from './schemas/google-ads-export.schema';

export const GOOGLE_ADS_EXPORT_REQUIRED_FILES = [
  'manifest.json',
  'operator_readme.md',
  'expert_analysis_prompt.md',
  'data_dictionary.md',
  'decision_rules.json',
  'data_quality_report.json',
  'google_accounts.csv',
  'campaigns.csv',
  'campaign_budgets.csv',
  'ad_groups.csv',
  'keywords.csv',
  'responsive_search_ads.csv',
  'daily_metrics_campaign.csv',
  'daily_metrics_ad_group.csv',
  'daily_metrics_keyword.csv',
  'daily_metrics_ad.csv',
  'products.csv',
  'inventory.csv',
  'order_profit_attribution.csv',
  'landing_pages.csv',
  'creative_assets.csv',
  'change_log.csv',
  'business_daily_notes.csv',
  'export_summary.md',
] as const;

type ExportRequest = {
  provider?: string;
  dateRange?: { preset?: string; from?: string; to?: string };
  liveOnly?: boolean;
  includeRecentlyPausedDays?: number;
  format?: string;
};

type CsvDefinition = { headers: string[]; rows: Record<string, any>[] };

@Injectable()
export class GoogleAdsExportService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(GoogleAdsExport.name) private readonly exportModel: Model<GoogleAdsExportDocument>,
  ) {}

  async createLiveAnalysisExport(request: ExportRequest = {}) {
    this.validateRequest(request);
    const exportId = this.newExportId();
    const { dateFrom, dateTo } = this.resolveDateRange(request.dateRange);
    const generatedAt = new Date();
    const datasets = await this.loadDatasets(dateFrom, dateTo);
    const csv = this.buildCsvDefinitions(datasets);
    const rowCounts = Object.fromEntries(Object.entries(csv).map(([name, data]) => [name, data.rows.length]));
    const dataQuality = this.buildDataQualityReport(exportId, dateFrom, dateTo, csv, datasets);
    const contents = this.buildPackageContents({
      exportId,
      generatedAt,
      dateFrom,
      dateTo,
      liveOnly: request.liveOnly !== false,
      includeRecentlyPausedDays: this.clamp(Number(request.includeRecentlyPausedDays ?? 3), 0, 30),
      csv,
      rowCounts,
      dataQuality,
    });

    const manifest = {
      schemaVersion: '2.0',
      exportId,
      generatedAt: generatedAt.toISOString(),
      generator: 'erp-google-ads-export',
      provider: 'google',
      timezone: 'Asia/Ho_Chi_Minh',
      currency: 'VND',
      dateFrom,
      dateTo,
      liveOnly: request.liveOnly !== false,
      includeRecentlyPausedDays: this.clamp(Number(request.includeRecentlyPausedDays ?? 3), 0, 30),
      analysisPromptFile: 'expert_analysis_prompt.md',
      decisionRulesFile: 'decision_rules.json',
      files: Object.entries(contents).map(([name, value]) => ({
        name,
        sha256: this.sha256(Buffer.from(value, 'utf8')),
      })),
    };
    contents['manifest.json'] = this.json(manifest);

    const zip = new AdmZip();
    for (const fileName of GOOGLE_ADS_EXPORT_REQUIRED_FILES) {
      zip.addFile(fileName, Buffer.from(contents[fileName] ?? '', 'utf8'));
    }
    const zipBuffer = zip.toBuffer();
    const outputDir = resolve(process.env.GOOGLE_ADS_EXPORT_DIR || join(process.cwd(), 'exports', 'google-ads'));
    await mkdir(outputDir, { recursive: true });
    const fileName = `ads_live_export_${exportId}.zip`;
    const filePath = join(outputDir, fileName);
    await writeFile(filePath, zipBuffer);
    const checksumSha256 = this.sha256(zipBuffer);

    await this.exportModel.create({
      exportId,
      fileName,
      filePath,
      status: 'ready',
      checksumSha256,
      rowCounts,
      dataQualityWarnings: dataQuality.warnings,
      manifest,
    });

    return {
      success: true,
      exportId,
      downloadUrl: `/api/google-ads/operator/exports/${exportId}/download`,
      fileName,
      rowCounts,
      dataQualityStatus: dataQuality.status,
      dataQualityWarnings: dataQuality.warnings,
    };
  }

  async getDownload(exportId: string) {
    const record = await this.exportModel.findOne({ exportId, status: 'ready' }).lean();
    if (!record || !existsSync(record.filePath)) throw new NotFoundException('Google Ads export file not found.');
    return { fileName: record.fileName, filePath: record.filePath };
  }

  async verifyExport(exportId: string) {
    const record = await this.exportModel.findOne({ exportId, status: 'ready' }).lean();
    if (!record || !existsSync(record.filePath)) throw new NotFoundException('Google Ads export file not found.');
    const zip = new AdmZip(record.filePath);
    const names = zip.getEntries().map((entry) => entry.entryName);
    const unsafeEntries = names.filter((name) => name.includes('..') || name.startsWith('/') || name.startsWith('\\'));
    const missingFiles = GOOGLE_ADS_EXPORT_REQUIRED_FILES.filter((name) => !names.includes(name));
    const archiveChecksumPassed = this.sha256(await readFile(record.filePath)) === record.checksumSha256;
    let entryChecksumsPassed = false;
    try {
      const manifest = JSON.parse(zip.readAsText('manifest.json'));
      entryChecksumsPassed = Array.isArray(manifest.files) && manifest.files.every((file: any) => {
        const entry = zip.getEntry(String(file.name || ''));
        return entry && this.sha256(entry.getData()) === file.sha256;
      });
    } catch {
      entryChecksumsPassed = false;
    }
    const checksumPassed = archiveChecksumPassed && entryChecksumsPassed;
    return {
      success: missingFiles.length === 0 && unsafeEntries.length === 0 && checksumPassed,
      exportId,
      requiredFilesPresent: missingFiles.length === 0,
      missingFiles,
      unsafeEntries,
      checksumPassed,
      archiveChecksumPassed,
      entryChecksumsPassed,
      dataQualityWarnings: record.dataQualityWarnings || [],
    };
  }

  private async loadDatasets(dateFrom: string, dateTo: string) {
    const dateFromValue = new Date(`${dateFrom}T00:00:00.000Z`);
    const dateToValue = new Date(`${dateTo}T23:59:59.999Z`);
    const metricFilter = { date: { $gte: dateFrom, $lte: dateTo } };
    const orderFilter = { orderDate: { $gte: dateFromValue, $lte: dateToValue } };
    const changeFilter = { executedAt: { $gte: dateFromValue, $lte: dateToValue } };

    const [
      accounts, campaigns, budgets, adGroups, keywords, ads, metrics,
      products, inventory, orders, creativeAssets, changeLogs, evaluations, businessNotes, landingPages,
    ] = await Promise.all([
      this.find('adaccounts', { accountType: 'google', isActive: true }, {
        accountId: 1, loginCustomerId: 1, name: 1, currency: 1, timezoneId: 1,
        managementMode: 1, accountStatus: 1, lastSyncAt: 1,
      }),
      this.find('google_ads_campaigns', {}, {
        customerId: 1, campaignId: 1, resourceName: 1, campaignName: 1, status: 1,
        advertisingChannelType: 1, biddingStrategyType: 1, campaignBudgetId: 1,
        campaignBudgetResourceName: 1, startDate: 1, endDate: 1, internalProductId: 1, lastSyncAt: 1,
      }),
      this.find('google_ads_campaign_budgets', {}, {
        customerId: 1, campaignBudgetId: 1, resourceName: 1, name: 1, amountMicros: 1,
        amountVnd: 1, deliveryMethod: 1, explicitlyShared: 1, status: 1, lastSyncAt: 1,
      }),
      this.find('google_ads_ad_groups', {}, {
        customerId: 1, campaignId: 1, adGroupId: 1, resourceName: 1, adGroupName: 1,
        status: 1, type: 1, cpcBidMicros: 1, internalAdGroupId: 1, internalProductIds: 1, lastSyncAt: 1,
      }),
      this.find('google_ads_keywords', {}, {
        customerId: 1, campaignId: 1, adGroupId: 1, criterionId: 1, resourceName: 1,
        keywordText: 1, matchType: 1, negative: 1, status: 1, qualityScore: 1, lastSyncAt: 1,
      }),
      this.find('google_ads_ads', {}, {
        customerId: 1, campaignId: 1, adGroupId: 1, adId: 1, resourceName: 1, status: 1,
        headlines: 1, descriptions: 1, finalUrls: 1, path1: 1, path2: 1,
        policyApprovalStatus: 1, policyReviewStatus: 1, creativeAssetId: 1, lastSyncAt: 1,
      }),
      this.find('google_ads_daily_metrics', metricFilter, {
        _id: 0, date: 1, level: 1, customerId: 1, campaignId: 1, adGroupId: 1, criterionId: 1,
        adId: 1, keywordText: 1, matchType: 1, costMicros: 1, costVnd: 1, impressions: 1,
        clicks: 1, ctr: 1, averageCpc: 1, conversions: 1, allConversions: 1,
        conversionValue: 1, costPerConversion: 1, revenue: 1, grossProfit: 1, netProfit: 1,
        orders: 1, confirmedOrders: 1, cancelledOrders: 1, returnedOrders: 1,
        profitPerSpend: 1, roas: 1, erpEnrichedAt: 1, profitUpdatedAt: 1,
      }),
      this.find('products', {}, {
        _id: 1, name: 1, categoryId: 1, importPrice: 1, shippingCost: 1, packagingCost: 1,
        totalCost: 1, minStock: 1, maxStock: 1, status: 1, notes: 1, resourceLink: 1, fanpageVariations: 1,
      }),
      this.find('inventorysummaries', {}, { _id: 0, productId: 1, onHand: 1, updatedAt: 1 }),
      this.find('ordertest2', orderFilter, {
        _id: 1, productId: 1, quantity: 1, adGroupId: 1, orderDate: 1, businessConfirmedAt: 1,
        depositAmount: 1, codAmount: 1, manualPayment: 1, grossProfit: 1, advertisingCost: 1,
        laborCostAllocation: 1, otherCostAllocation: 1, shippingFee: 1, returnFee: 1,
        agentCommissionAmount: 1, netProfit: 1, orderStatus: 1, supplierPaymentStatus: 1, agentPaymentStatus: 1,
      }),
      this.find('creative_assets', { platform: 'google' }, {
        _id: 0, creativeId: 1, landingPage: 1, headline: 1, caption: 1, cta: 1,
        status: 1, notes: 1, createdAt: 1, adGroupIds: 1,
      }),
      this.find('google_ads_change_logs', changeFilter, {
        _id: 0, planId: 1, actionId: 1, actionType: 1, provider: 1, customerId: 1,
        campaignId: 1, adGroupId: 1, adId: 1, criterionId: 1, beforeValue: 1,
        afterValue: 1, reason: 1, changedBy: 1, providerRequestId: 1, syncResult: 1,
        evaluationDueAt: 1, executedAt: 1,
      }),
      this.find('google_ads_action_evaluations', changeFilter, {
        _id: 0, planId: 1, actionId: 1, evaluationDays: 1, status: 1, result: 1,
        dueAt: 1, evaluatedAt: 1, beforeMetrics: 1, afterMetrics: 1, delta: 1,
        insight: 1,
      }),
      this.find('business_daily_notes', { date: { $gte: dateFrom, $lte: dateTo } }, {
        _id: 0, date: 1, summary: 1, notes: 1, anomalies: 1, source: 1,
        noteType: 1, note: 1, affectedCustomerId: 1, affectedCampaignId: 1,
        affectedAdGroupId: 1, affectedProductId: 1, severity: 1,
      }),
      this.find('landing_pages', {}, {
        _id: 1, url: 1, domain: 1, title: 1, productId: 1, status: 1,
        approvalStatus: 1, approvedForAds: 1, mainCta: 1, notes: 1, lastCheckedAt: 1,
      }),
    ]);
    return { accounts, campaigns, budgets, adGroups, keywords, ads, metrics, products, inventory, orders, creativeAssets, changeLogs, evaluations, businessNotes, landingPages };
  }

  private buildCsvDefinitions(data: any): Record<string, CsvDefinition> {
    const adGroupsByProviderId = new Map<string, any[]>();
    const productToAdGroups = new Map<string, any[]>();
    const campaignsByIdentity = new Map(
      data.campaigns.map((row: any) => [`${row.customerId}:${row.campaignId}`, row]),
    );
    for (const row of data.adGroups as any[]) {
      const adGroupId = normalizedAttributionId(row.adGroupId);
      if (!adGroupId) continue;
      adGroupsByProviderId.set(adGroupId, [...(adGroupsByProviderId.get(adGroupId) || []), row]);
      const campaign: any = campaignsByIdentity.get(`${row.customerId}:${row.campaignId}`) || {};
      const productIds = uniqueText([...(row.internalProductIds || []), campaign.internalProductId]);
      for (const productId of productIds) {
        const existing = productToAdGroups.get(productId) || [];
        const identity = googleAdGroupIdentity(row);
        if (!existing.some((item) => googleAdGroupIdentity(item) === identity)) {
          productToAdGroups.set(productId, [...existing, row]);
        }
      }
    }
    const productsMap = new Map(data.products.map((row: any) => [String(row._id), row]));
    const evaluationsMap = new Map<string, any[]>();
    for (const evaluation of data.evaluations || []) {
      const key = `${evaluation.planId}:${evaluation.actionId}`;
      evaluationsMap.set(key, [...(evaluationsMap.get(key) || []), evaluation]);
    }
    const derivedLandingPages = this.deriveLandingPages(data);
    const metricRows = (level: string) => data.metrics.filter((row: any) => row.level === level);
    const metricHeaders = ['date','customerId','campaignId','adGroupId','criterionId','adId','keywordText','matchType','costMicros','costVnd','impressions','clicks','ctr','averageCpc','conversions','allConversions','conversionValue','costPerConversion','revenue','grossProfit','netProfit','orders','confirmedOrders','cancelledOrders','returnedOrders','profitPerSpend','roas','erpEnrichedAt','profitUpdatedAt'];

    return {
      google_accounts: {
        headers: ['customerId','loginCustomerId','accountName','currencyCode','timeZone','managerAccountId','isMccLinked','status','lastSyncAt'],
        rows: data.accounts.map((row: any) => ({
          customerId: this.digits(row.accountId), loginCustomerId: this.digits(row.loginCustomerId),
          accountName: this.safeText(row.name), currencyCode: row.currency, timeZone: row.timezoneId,
          managerAccountId: this.digits(row.loginCustomerId), isMccLinked: row.managementMode === 'mcc',
          status: row.accountStatus ?? (row.isActive === false ? 'INACTIVE' : 'ACTIVE'), lastSyncAt: row.lastSyncAt,
        })),
      },
      campaigns: { headers: ['customerId','campaignId','resourceName','campaignName','status','advertisingChannelType','biddingStrategyType','campaignBudgetId','campaignBudgetResourceName','startDate','endDate','internalProductId','lastSyncAt'], rows: data.campaigns },
      campaign_budgets: { headers: ['customerId','campaignBudgetId','resourceName','name','amountMicros','amountVnd','deliveryMethod','explicitlyShared','status','lastSyncAt'], rows: data.budgets },
      ad_groups: { headers: ['customerId','campaignId','adGroupId','resourceName','adGroupName','status','type','cpcBidMicros','internalAdGroupId','internalProductIds','lastSyncAt'], rows: data.adGroups },
      keywords: { headers: ['customerId','campaignId','adGroupId','criterionId','resourceName','keywordText','matchType','negative','status','qualityScore','lastSyncAt'], rows: data.keywords },
      responsive_search_ads: { headers: ['customerId','campaignId','adGroupId','adId','resourceName','status','headlines','descriptions','finalUrls','path1','path2','policyApprovalStatus','policyReviewStatus','creativeAssetId','lastSyncAt'], rows: data.ads.map((row: any) => ({ ...row, finalUrls: (row.finalUrls || []).map((url: string) => this.safeUrl(url)) })) },
      daily_metrics_campaign: { headers: metricHeaders.filter((name) => !['adGroupId','criterionId','adId','keywordText','matchType'].includes(name)), rows: metricRows('campaign') },
      daily_metrics_ad_group: { headers: metricHeaders.filter((name) => !['criterionId','adId','keywordText','matchType'].includes(name)), rows: metricRows('ad_group') },
      daily_metrics_keyword: { headers: metricHeaders.filter((name) => name !== 'adId'), rows: metricRows('keyword') },
      daily_metrics_ad: { headers: metricHeaders.filter((name) => !['criterionId','keywordText','matchType','allConversions','cancelledOrders'].includes(name)), rows: metricRows('ad') },
      products: {
        headers: ['productId','productName','category','sellingPrice','costOfGoods','grossMarginPercent','minStock','priority','isActive','defaultLandingPage','note'],
        rows: data.products.map((row: any) => {
          const prices = (row.fanpageVariations || []).map((item: any) => Number(item.customPrice || 0)).filter((value: number) => value > 0);
          const sellingPrice = prices.length ? Math.max(...prices) : 0;
          const cost = Number(row.totalCost ?? (Number(row.importPrice || 0) + Number(row.shippingCost || 0) + Number(row.packagingCost || 0)));
          return {
            productId: String(row._id), productName: this.safeText(row.name), category: String(row.categoryId || ''),
            sellingPrice, costOfGoods: cost, grossMarginPercent: sellingPrice > 0 ? ((sellingPrice - cost) / sellingPrice) * 100 : 0,
            minStock: row.minStock, priority: 0, isActive: !String(row.status || '').toLowerCase().includes('ngừng'),
            defaultLandingPage: this.safeUrl(row.resourceLink), note: this.safeText(row.notes),
          };
        }),
      },
      inventory: {
        headers: ['productId','onHand','available','reserved','minStock','maxStock','lastUpdatedAt','stockRisk'],
        rows: data.inventory.map((row: any) => {
          const product: any = productsMap.get(String(row.productId)) || {};
          const onHand = Number(row.onHand || 0);
          const minStock = Number(product.minStock || 0);
          return { productId: String(row.productId), onHand, available: onHand, reserved: 0, minStock, maxStock: Number(product.maxStock || 0), lastUpdatedAt: row.updatedAt, stockRisk: onHand <= minStock ? 'low_stock' : 'ok' };
        }),
      },
      order_profit_attribution: {
        headers: ['orderId','orderDate','confirmedDate','customerId','campaignId','adGroupId','adId','criterionId','productId','quantity','revenue','grossProfit','adsCostAllocated','fulfillmentCost','saleCommission','refundAmount','netProfit','orderStatus','paymentStatus','attributionType','attributionConfidence'],
        rows: data.orders.map((row: any) => {
          const explicitAdGroupId = normalizedAttributionId(row.adGroupId);
          const productId = String(row.productId || '').trim();
          const explicitMatches = explicitAdGroupId ? adGroupsByProviderId.get(explicitAdGroupId) || [] : [];
          let group: any = {};
          let attributionType = 'unattributed';
          let attributionConfidence = 0;

          if (explicitAdGroupId && explicitMatches.length === 1) {
            group = explicitMatches[0];
            attributionType = 'ad_group';
            attributionConfidence = 1;
          } else if (explicitAdGroupId && explicitMatches.length > 1) {
            // Orders do not currently carry customerId/provider, so a repeated
            // provider adGroupId is unsafe to assign to any account.
            attributionType = 'ambiguous_ad_group';
          } else if (explicitAdGroupId) {
            attributionType = 'invalid_ad_group';
          } else {
            const productMatches = productToAdGroups.get(productId) || [];
            if (productId && productMatches.length === 1) {
              group = productMatches[0];
              attributionType = 'product_mapping';
              attributionConfidence = 0.5;
            }
          }

          const resolvedAdGroupId = group.adGroupId ? String(group.adGroupId) : '';
          return {
            orderId: String(row._id), orderDate: row.orderDate, confirmedDate: row.businessConfirmedAt || '',
            customerId: group.customerId, campaignId: group.campaignId, adGroupId: resolvedAdGroupId,
            adId: '', criterionId: '', productId, quantity: Number(row.quantity || 0),
            revenue: Number(row.depositAmount || 0) + Number(row.codAmount || 0) + Number(row.manualPayment || 0),
            grossProfit: Number(row.grossProfit || 0), adsCostAllocated: Number(row.advertisingCost || 0),
            fulfillmentCost: Number(row.shippingFee || 0) + Number(row.returnFee || 0) + Number(row.laborCostAllocation || 0) + Number(row.otherCostAllocation || 0),
            saleCommission: Number(row.agentCommissionAmount || 0), refundAmount: Number(row.returnFee || 0),
            netProfit: Number(row.netProfit || 0), orderStatus: this.safeText(row.orderStatus),
            paymentStatus: `${row.supplierPaymentStatus || 'unknown'}/${row.agentPaymentStatus || 'unknown'}`,
            attributionType,
            attributionConfidence,
          };
        }),
      },
      landing_pages: { headers: ['landingPageId','url','domain','title','productId','status','approvedForAds','mainCta','notes','lastCheckedAt'], rows: derivedLandingPages },
      creative_assets: {
        headers: ['creativeAssetId','productId','landingPageUrl','angle','hook','offer','proof','cta','complianceNote','approvedForAds','createdAt'],
        rows: data.creativeAssets.map((row: any) => ({
          creativeAssetId: row.creativeId, productId: '', landingPageUrl: this.safeUrl(row.landingPage),
          angle: '', hook: this.safeText(row.headline), offer: '', proof: this.safeText(row.caption),
          cta: this.safeText(row.cta), complianceNote: this.safeText(row.notes),
          approvedForAds: ['approved','active'].includes(row.status), createdAt: row.createdAt,
        })),
      },
      change_log: {
        headers: ['changeTime','provider','customerId','campaignId','adGroupId','adId','criterionId','changeType','beforeValue','afterValue','reason','changedBy','sourcePlanId','sourceActionId','expectedResult'],
        rows: data.changeLogs.map((row: any) => {
          return {
            changeTime: row.executedAt, provider: row.provider || 'google', customerId: row.customerId,
            campaignId: row.campaignId, adGroupId: row.adGroupId, adId: row.adId,
            criterionId: row.criterionId, changeType: row.actionType,
            beforeValue: row.beforeValue, afterValue: row.afterValue, reason: this.safeText(row.reason),
            changedBy: this.safeText(row.changedBy), sourcePlanId: String(row.planId || ''),
            sourceActionId: String(row.actionId || ''),
            expectedResult: {
              providerRequestId: row.providerRequestId,
              postExecutionSync: row.syncResult,
              evaluations: this.evaluationExportSummaries(evaluationsMap.get(`${row.planId}:${row.actionId}`) || []),
            },
          };
        }),
      },
      business_daily_notes: {
        headers: ['date','noteType','note','affectedCustomerId','affectedCampaignId','affectedAdGroupId','affectedProductId','severity'],
        rows: data.businessNotes.map((row: any) => ({
          date: row.date,
          noteType: row.noteType || row.source || 'manual',
          note: this.safeText(row.note || [
            row.summary,
            row.notes,
            ...(row.anomalies || []).map((item: string) => `Anomaly: ${item}`),
          ].filter(Boolean).join('\n')),
          affectedCustomerId: row.affectedCustomerId,
          affectedCampaignId: row.affectedCampaignId,
          affectedAdGroupId: row.affectedAdGroupId,
          affectedProductId: row.affectedProductId,
          severity: row.severity || 'info',
        })),
      },
    };
  }

  private evaluationExportSummaries(evaluations: any[]) {
    return evaluations
      .sort((left, right) => Number(left.evaluationDays) - Number(right.evaluationDays))
      .map((row) => ({
        evaluationDays: row.evaluationDays,
        status: row.status,
        result: row.result,
        dueAt: row.dueAt,
        evaluatedAt: row.evaluatedAt,
        beforeMetrics: row.beforeMetrics,
        afterMetrics: row.afterMetrics,
        delta: row.delta,
        insight: this.safeText(row.insight),
      }));
  }

  private deriveLandingPages(data: any) {
    const rows: any[] = data.landingPages.map((row: any) => ({
      landingPageId: String(row._id), url: this.safeUrl(row.url), domain: row.domain,
      title: this.safeText(row.title), productId: String(row.productId || ''), status: row.approvalStatus || row.status,
      approvedForAds: Boolean(row.approvedForAds) && this.isAllowedLandingPage(this.safeUrl(row.url)), mainCta: this.safeText(row.mainCta),
      notes: this.safeText(row.notes), lastCheckedAt: row.lastCheckedAt,
    }));
    const seen = new Set(rows.map((row) => row.url).filter(Boolean));
    const add = (url: string, source: string) => {
      const safe = this.safeUrl(url);
      if (!safe || seen.has(safe)) return;
      seen.add(safe);
      rows.push({
        landingPageId: `derived-${rows.length + 1}`, url: safe, domain: this.domain(safe), title: '',
        productId: '', status: 'derived', approvedForAds: this.isAllowedLandingPage(safe),
        mainCta: '', notes: `Derived from ${source}`, lastCheckedAt: '',
      });
    };
    data.ads.forEach((ad: any) => (ad.finalUrls || []).forEach((url: string) => add(url, 'responsive_search_ads')));
    data.creativeAssets.forEach((asset: any) => add(asset.landingPage, 'creative_assets'));
    data.products.forEach((product: any) => add(product.resourceLink, 'products'));
    return rows;
  }

  private buildDataQualityReport(exportId: string, dateFrom: string, dateTo: string, csv: Record<string, CsvDefinition>, data: any) {
    const warnings: string[] = [];
    let profitHold = false;
    for (const name of ['google_accounts','campaigns','campaign_budgets','ad_groups','keywords','responsive_search_ads','daily_metrics_campaign','daily_metrics_ad_group','daily_metrics_keyword','daily_metrics_ad','products','inventory','order_profit_attribution','landing_pages','creative_assets']) {
      if (!csv[name].rows.length) warnings.push(`${name}.csv has no rows.`);
    }
    if (!csv.change_log.rows.length) warnings.push('change_log.csv has no rows; previous action outcomes cannot be evaluated.');
    if (data.changeLogs.length && !data.evaluations.length) {
      warnings.push('Previous Google Ads actions have no scheduled or completed evaluation records.');
    }
    const pendingEvaluations = data.evaluations.filter((row: any) => ['pending', 'evaluating'].includes(row.status)).length;
    if (pendingEvaluations) warnings.push(`${pendingEvaluations} previous action evaluation(s) are not complete yet.`);
    const failedEvaluations = data.evaluations.filter((row: any) => row.status === 'failed').length;
    if (failedEvaluations) warnings.push(`${failedEvaluations} previous action evaluation(s) failed and require review.`);
    if (!csv.business_daily_notes.rows.length) warnings.push('business_daily_notes.csv has no rows; business anomalies may be missing.');
    if (!this.allowedDomains().length) warnings.push('Landing page allowlist is not configured; derived landing pages are not approved for ads.');
    const unapprovedLandingPages = csv.landing_pages.rows.filter((row: any) => !row.approvedForAds).length;
    if (unapprovedLandingPages) warnings.push(`${unapprovedLandingPages} landing page(s) are not approved by the configured allowlist.`);
    const missingBudgetLinks = data.campaigns.filter((row: any) => !row.campaignBudgetId && !row.campaignBudgetResourceName).length;
    if (missingBudgetLinks) warnings.push(`${missingBudgetLinks} campaign(s) are missing campaign budget identifiers.`);
    const profitMetrics = data.metrics.filter((row: any) => ['campaign', 'ad_group'].includes(row.level));
    const missingProfitMetrics = profitMetrics.filter((row: any) => !row.erpEnrichedAt || !row.profitUpdatedAt).length;
    const maxProfitAgeHours = Math.max(1, Number(process.env.GOOGLE_ADS_PROFIT_FRESHNESS_HOURS || 48));
    const staleProfitMetrics = profitMetrics.filter((row: any) => {
      if (!row.profitUpdatedAt) return false;
      const updatedAt = new Date(row.profitUpdatedAt);
      return Number.isNaN(updatedAt.getTime())
        || Date.now() - updatedAt.getTime() > maxProfitAgeHours * 60 * 60 * 1000;
    }).length;
    if (!profitMetrics.length) {
      profitHold = true;
      warnings.push('ERP profit enrichment is unavailable because campaign/ad-group metric rows are missing.');
    }
    if (missingProfitMetrics) {
      profitHold = true;
      warnings.push(`${missingProfitMetrics} campaign/ad-group metric row(s) are missing ERP profit provenance.`);
    }
    if (staleProfitMetrics) {
      profitHold = true;
      warnings.push(`${staleProfitMetrics} campaign/ad-group metric row(s) have stale ERP profit enrichment.`);
    }
    const orders = csv.order_profit_attribution.rows;
    const placeholderOrderCount = data.orders.filter((row: any) => String(row.adGroupId ?? '').trim() === '0').length;
    if (placeholderOrderCount) {
      warnings.push(`${placeholderOrderCount} order(s) use placeholder adGroupId=0 and were treated as unattributed unless a unique product mapping existed.`);
    }
    const ambiguousOrderCount = orders.filter((row: any) => row.attributionType === 'ambiguous_ad_group').length;
    if (ambiguousOrderCount) {
      warnings.push(`${ambiguousOrderCount} order(s) have an adGroupId shared by multiple Google Ads accounts and were left unattributed.`);
    }
    const productFallbackCount = orders.filter((row: any) => row.attributionType === 'product_mapping').length;
    if (productFallbackCount) {
      warnings.push(`${productFallbackCount} order(s) used a unique product-to-ad-group fallback with low attribution confidence.`);
    }
    const percent = (count: number) => orders.length ? Math.round((count / orders.length) * 10000) / 100 : 0;
    return {
      exportId,
      status: profitHold ? 'hold' : warnings.length ? 'passed_with_warnings' : 'passed',
      dateFrom,
      dateTo,
      warnings,
      missingFiles: [],
      missingColumns: [],
      duplicateKeys: [],
      attributionCoverage: {
        ordersWithAdGroupIdPercent: percent(orders.filter((row: any) => row.adGroupId).length),
        ordersWithKeywordIdPercent: percent(orders.filter((row: any) => row.criterionId).length),
      },
      profitEnrichment: {
        status: profitHold ? 'hold' : 'fresh',
        eligibleMetricRows: profitMetrics.length,
        missingProvenanceRows: missingProfitMetrics,
        staleRows: staleProfitMetrics,
        maxAgeHours: maxProfitAgeHours,
      },
    };
  }

  private buildPackageContents(params: any): Record<string, string> {
    const contents: Record<string, string> = {};
    for (const [name, definition] of Object.entries(params.csv) as Array<[string, CsvDefinition]>) {
      contents[`${name}.csv`] = this.toCsv(definition);
    }
    contents['operator_readme.md'] = `# Operator Readme\n\nExport ID: ${params.exportId}\nDate range: ${params.dateFrom} to ${params.dateTo}\n\nUpload this ZIP to ChatGPT Web for analysis. Do not edit provider IDs. ERP remains the only system allowed to validate, approve, and execute actions.\n`;
    contents['expert_analysis_prompt.md'] = this.expertPrompt(params);
    contents['data_dictionary.md'] = this.dataDictionary(params.csv);
    contents['decision_rules.json'] = this.json(this.decisionRules());
    contents['data_quality_report.json'] = this.json(params.dataQuality);
    contents['export_summary.md'] = `# Export Summary\n\n- Export ID: ${params.exportId}\n- Generated at: ${params.generatedAt.toISOString()}\n- Date range: ${params.dateFrom} to ${params.dateTo}\n- Data quality: ${params.dataQuality.status}\n- Warnings: ${params.dataQuality.warnings.length}\n\n## Row counts\n\n${Object.entries(params.rowCounts).map(([name, count]) => `- ${name}.csv: ${count}`).join('\n')}\n`;
    return contents;
  }

  private expertPrompt(params: any) {
    return `# Expert Analysis Prompt\n\nYou are a senior Google Search Ads performance analyst. Analyze all ERP data in this export (${params.dateFrom} to ${params.dateTo}) using net profit before ROAS.\n\nMandatory rules:\n- Review data_quality_report.json first. Use monitor_only when data is insufficient.\n- Never output raw Google Ads API requests.\n- New Search campaigns must be PAUSED.\n- Every proposed action must require approval and include evidence, risk, idempotencyKey, rollbackIf, and typedPayload.\n- Do not propose delete, Performance Max, Shopping, Display, YouTube, or auto-publish actions.\n- Return a structured ads_execution_plan.zip for ERP validation; do not execute anything.\n`;
  }

  private decisionRules() {
    const safety = getAdsSafetyConfig();
    return {
      schemaVersion: '2.0',
      currency: 'VND',
      timezone: 'Asia/Ho_Chi_Minh',
      allowedLandingPageDomains: this.allowedDomains(),
      approvalRequired: safety.requireApproval,
      dryRunDefault: safety.dryRun,
      providerExecutionEnabled: safety.providerExecutionEnabled,
      googleAdsProductionEnabled: safety.googleAdsProductionEnabled,
      maxBudgetIncreasePercentPerAction: Number(process.env.GOOGLE_ADS_MAX_BUDGET_INCREASE_PERCENT || 20),
      maxDailyBudgetPerCampaign: Number(process.env.GOOGLE_ADS_MAX_DAILY_BUDGET_VND || 5_000_000),
      allowedActions: ['create_search_campaign','create_ad_group','create_keyword','create_responsive_search_ad','update_campaign_budget','pause_campaign','resume_campaign','pause_ad_group','resume_ad_group','monitor_only'],
      blockedActions: ['delete_campaign','delete_ad_group','delete_ad','create_performance_max','create_shopping_campaign','create_display_campaign','auto_publish_without_approval'],
    };
  }

  private dataDictionary(csv: Record<string, CsvDefinition>) {
    return `# Data Dictionary\n\n${Object.entries(csv).map(([name, value]) => `## ${name}.csv\n\n${value.headers.map((header) => `- ${header}`).join('\n')}`).join('\n\n')}\n`;
  }

  private async find(collectionName: string, filter: Record<string, any>, projection: Record<string, any>) {
    return this.connection.collection(collectionName).find(filter, { projection }).toArray();
  }

  private toCsv(definition: CsvDefinition) {
    const lines = [definition.headers.map((header) => this.csvCell(header)).join(',')];
    for (const row of definition.rows) lines.push(definition.headers.map((header) => this.csvCell(row[header])).join(','));
    return `\uFEFF${lines.join('\r\n')}\r\n`;
  }

  private csvCell(value: any) {
    let text = value === undefined || value === null ? '' : value instanceof Date ? value.toISOString() : typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  private validateRequest(request: ExportRequest) {
    if (request.provider && request.provider !== 'google') throw new BadRequestException('Only provider=google is supported.');
    if (request.format && request.format !== 'zip') throw new BadRequestException('Only format=zip is supported.');
  }

  private resolveDateRange(range?: ExportRequest['dateRange']) {
    const to = range?.to ? new Date(range.to) : new Date();
    if (Number.isNaN(to.getTime())) throw new BadRequestException('Invalid dateRange.to.');
    const presetDays: Record<string, number> = { last_7_days: 7, last_14_days: 14, last_30_days: 30, last_90_days: 90 };
    const days = this.clamp(presetDays[range?.preset || 'last_14_days'] || 14, 1, 90);
    const from = range?.from ? new Date(range.from) : new Date(to);
    if (!range?.from) from.setUTCDate(from.getUTCDate() - days + 1);
    if (Number.isNaN(from.getTime()) || from > to) throw new BadRequestException('Invalid export date range.');
    return { dateFrom: from.toISOString().slice(0, 10), dateTo: to.toISOString().slice(0, 10) };
  }

  private newExportId() {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `EXP-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private safeText(value: any) {
    const redacted = redactSecretString(String(value || ''));
    return redacted
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL_REDACTED]')
      .replace(/(?:\+?84|0)(?:[\s.-]?\d){8,10}/g, '[PHONE_REDACTED]');
  }

  private safeUrl(value: any) {
    try {
      const url = new URL(String(value || ''));
      if (!['https:', 'http:'].includes(url.protocol)) return '';
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch {
      return '';
    }
  }

  private allowedDomains() {
    return String(process.env.GOOGLE_ADS_LANDING_PAGE_ALLOWLIST || process.env.AI_MARKETING_LANDING_PAGE_ALLOWLIST || '')
      .split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  }

  private isAllowedLandingPage(value: string) {
    const domain = this.domain(value);
    return Boolean(domain && this.allowedDomains().some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`)));
  }

  private domain(value: string) {
    try { return new URL(value).hostname.toLowerCase(); } catch { return ''; }
  }

  private digits(value: any) {
    return String(value || '').replace(/\D/g, '');
  }

  private json(value: any) {
    return `${JSON.stringify(value, null, 2)}\n`;
  }

  private sha256(value: Buffer) {
    return createHash('sha256').update(value).digest('hex');
  }

  private clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
  }
}

function normalizedAttributionId(value: unknown): string | undefined {
  const normalized = String(value ?? '').trim();
  return normalized && normalized !== '0' ? normalized : undefined;
}

function uniqueText(values: unknown[]): string[] {
  return Array.from(new Set(
    values
      .map((value) => String(value ?? '').trim())
      .filter(Boolean),
  ));
}

function googleAdGroupIdentity(row: any): string {
  return `${String(row?.customerId || '').trim()}:${String(row?.adGroupId || '').trim()}`;
}
