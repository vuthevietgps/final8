import AdmZip = require('adm-zip');
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { GOOGLE_ADS_EXPORT_REQUIRED_FILES, GoogleAdsExportService } from './google-ads-export.service';

describe('GoogleAdsExportService', () => {
  const outputDir = join(process.cwd(), '.test-google-ads-exports');
  const records: any[] = [];
  const collections: Record<string, any[]> = {
    adaccounts: [{ accountId: '123-456-7890', loginCustomerId: '999-888-7777', name: 'Test Google', currency: 'VND', timezoneId: 'Asia/Ho_Chi_Minh', managementMode: 'mcc', isActive: true }],
    google_ads_campaigns: [{ customerId: '1234567890', campaignId: '10', resourceName: 'customers/1234567890/campaigns/10', campaignName: 'Search', status: 'ENABLED', campaignBudgetId: '20', campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/20' }],
    google_ads_campaign_budgets: [{ customerId: '1234567890', campaignBudgetId: '20', resourceName: 'customers/1234567890/campaignBudgets/20', amountMicros: 1000000, amountVnd: 1 }],
    google_ads_ad_groups: [{ customerId: '1234567890', campaignId: '10', adGroupId: '30', resourceName: 'customers/1234567890/adGroups/30', adGroupName: 'Group' }],
    google_ads_keywords: [{ customerId: '1234567890', campaignId: '10', adGroupId: '30', criterionId: '40', resourceName: 'customers/1234567890/adGroupCriteria/30~40', keywordText: 'sample', matchType: 'EXACT' }],
    google_ads_ads: [{ customerId: '1234567890', campaignId: '10', adGroupId: '30', adId: '50', resourceName: 'customers/1234567890/adGroupAds/30~50', finalUrls: ['https://htxbachgia.shop/path?token=secret'] }],
    google_ads_daily_metrics: [{
      date: '2026-06-12', level: 'campaign', customerId: '1234567890', campaignId: '10',
      costMicros: 1000000, conversions: 1, revenue: 500, grossProfit: 300, netProfit: 200,
      erpEnrichedAt: new Date(), profitUpdatedAt: new Date(),
    }],
    products: [{ _id: 'product-1', name: 'Product', totalCost: 100, minStock: 2, maxStock: 20, resourceLink: 'https://htxbachgia.shop/product?customer=email@example.com' }],
    inventorysummaries: [{ productId: 'product-1', onHand: 10 }],
    ordertest2: [{
      _id: 'order-1', productId: 'product-1', adGroupId: '30', orderDate: new Date('2026-06-12T00:00:00.000Z'),
      confirmedAt: new Date('2026-06-14T12:34:56.000Z'),
      businessConfirmedAt: new Date('2026-06-13T08:00:00.000Z'),
      quantity: 1, codAmount: 500, grossProfit: 300, netProfit: 200,
      customerName: 'Private Customer', receiverPhone: '0901234567', receiverAddress: 'Private Address',
    }],
    creative_assets: [],
    google_ads_change_logs: [],
    google_ads_action_evaluations: [],
    business_daily_notes: [],
    landing_pages: [],
  };

  const connection = {
    collection: (name: string) => ({
      find: () => ({
        toArray: async () => collections[name] || [],
      }),
    }),
  };
  const exportModel = {
    create: jest.fn(async (record) => {
      records.push(record);
      return record;
    }),
    findOne: jest.fn((filter) => ({
      lean: async () => records.find((record) => record.exportId === filter.exportId),
    })),
  };

  beforeAll(() => {
    process.env.GOOGLE_ADS_EXPORT_DIR = outputDir;
    process.env.GOOGLE_ADS_LANDING_PAGE_ALLOWLIST = 'htxbachgia.shop';
  });

  afterAll(() => {
    delete process.env.GOOGLE_ADS_EXPORT_DIR;
    delete process.env.GOOGLE_ADS_LANDING_PAGE_ALLOWLIST;
    if (existsSync(outputDir)) rmSync(outputDir, { recursive: true, force: true });
  });

  it('creates and verifies a complete ZIP without exporting customer PII', async () => {
    const service = new GoogleAdsExportService(connection as any, exportModel as any);

    const result = await service.createLiveAnalysisExport({
      provider: 'google',
      dateRange: { from: '2026-06-12', to: '2026-06-12' },
      format: 'zip',
    });
    const download = await service.getDownload(result.exportId);
    const verify = await service.verifyExport(result.exportId);
    const zip = new AdmZip(download.filePath);
    const names = zip.getEntries().map((entry) => entry.entryName);
    const orderCsv = zip.readAsText('order_profit_attribution.csv');
    const manifest = JSON.parse(zip.readAsText('manifest.json'));

    expect(names).toEqual(expect.arrayContaining([...GOOGLE_ADS_EXPORT_REQUIRED_FILES]));
    expect(names).toHaveLength(GOOGLE_ADS_EXPORT_REQUIRED_FILES.length);
    expect(zip.readAsText('expert_analysis_prompt.md')).toContain('senior Google Search Ads performance analyst');
    expect(manifest.exportId).toBe(result.exportId);
    expect(verify).toEqual(expect.objectContaining({
      success: true,
      requiredFilesPresent: true,
      checksumPassed: true,
      missingFiles: [],
    }));
    expect(orderCsv).not.toContain('Private Customer');
    expect(orderCsv).not.toContain('0901234567');
    expect(orderCsv).not.toContain('Private Address');
    expect(orderCsv).not.toContain('2026-06-14T12:34:56.000Z');
    expect(orderCsv).toContain('2026-06-13T08:00:00.000Z');
    expect(zip.readAsText('responsive_search_ads.csv')).not.toContain('token=secret');
  });

  it('reports empty source datasets as data quality warnings', async () => {
    const service = new GoogleAdsExportService(connection as any, exportModel as any);
    const result = await service.createLiveAnalysisExport({
      dateRange: { from: '2026-06-12', to: '2026-06-12' },
    });

    expect(result.dataQualityStatus).toBe('passed_with_warnings');
    expect(result.dataQualityWarnings).toEqual(expect.arrayContaining([
      expect.stringContaining('change_log.csv has no rows'),
      expect.stringContaining('business_daily_notes.csv has no rows'),
    ]));
  });

  it('puts the export on hold when ERP profit provenance is missing', async () => {
    const metric = collections.google_ads_daily_metrics[0];
    const previousEnrichedAt = metric.erpEnrichedAt;
    const previousProfitUpdatedAt = metric.profitUpdatedAt;
    delete metric.erpEnrichedAt;
    delete metric.profitUpdatedAt;
    try {
      const service = new GoogleAdsExportService(connection as any, exportModel as any);
      const result = await service.createLiveAnalysisExport({
        dateRange: { from: '2026-06-12', to: '2026-06-12' },
      });
      const zip = new AdmZip((await service.getDownload(result.exportId)).filePath);
      const quality = JSON.parse(zip.readAsText('data_quality_report.json'));

      expect(result.dataQualityStatus).toBe('hold');
      expect(result.dataQualityWarnings).toEqual(expect.arrayContaining([
        expect.stringContaining('missing ERP profit provenance'),
      ]));
      expect(quality.profitEnrichment).toEqual(expect.objectContaining({
        status: 'hold',
        missingProvenanceRows: 1,
      }));
    } finally {
      metric.erpEnrichedAt = previousEnrichedAt;
      metric.profitUpdatedAt = previousProfitUpdatedAt;
    }
  });

  it('includes previous action evaluation results in change_log.csv', async () => {
    collections.google_ads_change_logs.push({
      planId: 'PLAN-001',
      actionId: 'ACT-001',
      actionType: 'update_campaign_budget',
      provider: 'google',
      customerId: '1234567890',
      campaignId: '10',
      beforeValue: { amountVnd: 100000 },
      afterValue: { amountVnd: 110000 },
      reason: 'Improve profitable campaign coverage',
      changedBy: 'director@example.com',
      executedAt: new Date('2026-06-12T08:00:00.000Z'),
    });
    collections.google_ads_action_evaluations.push({
      planId: 'PLAN-001',
      actionId: 'ACT-001',
      evaluationDays: 3,
      status: 'completed',
      result: 'success',
      executedAt: new Date('2026-06-12T08:00:00.000Z'),
      beforeMetrics: { netProfit: 100 },
      afterMetrics: { netProfit: 130 },
    });
    try {
      const service = new GoogleAdsExportService(connection as any, exportModel as any);
      const result = await service.createLiveAnalysisExport({
        dateRange: { from: '2026-06-12', to: '2026-06-12' },
      });
      const zip = new AdmZip((await service.getDownload(result.exportId)).filePath);
      const changeLog = zip.readAsText('change_log.csv');

      expect(changeLog).toContain('ACT-001');
      expect(changeLog).toContain('success');
      expect(changeLog).toContain('netProfit');
      expect(changeLog).not.toContain('director@example.com');
    } finally {
      collections.google_ads_change_logs.length = 0;
      collections.google_ads_action_evaluations.length = 0;
    }
  });

  it('exports canonical ERP business notes and approved landing page context', async () => {
    collections.business_daily_notes.push({
      date: '2026-06-12',
      summary: 'Demand increased',
      notes: 'Monitor fulfillment capacity',
      anomalies: ['COD settlement delayed'],
      source: 'operations',
      affectedAdGroupId: '30',
      severity: 'warning',
      createdBy: 'private@example.com',
    });
    collections.landing_pages.push({
      _id: 'landing-1',
      url: 'https://htxbachgia.shop/offer?token=secret',
      domain: 'htxbachgia.shop',
      title: 'Offer',
      productId: 'product-1',
      approvalStatus: 'approved',
      status: 'approved',
      approvedForAds: true,
      mainCta: 'Buy now',
      notes: 'Approved commercial context',
    });
    try {
      const service = new GoogleAdsExportService(connection as any, exportModel as any);
      const result = await service.createLiveAnalysisExport({
        dateRange: { from: '2026-06-12', to: '2026-06-12' },
      });
      const zip = new AdmZip((await service.getDownload(result.exportId)).filePath);
      const notesCsv = zip.readAsText('business_daily_notes.csv');
      const landingCsv = zip.readAsText('landing_pages.csv');

      expect(notesCsv).toContain('Demand increased');
      expect(notesCsv).toContain('COD settlement delayed');
      expect(notesCsv).toContain('operations');
      expect(notesCsv).not.toContain('private@example.com');
      expect(landingCsv).toContain('landing-1');
      expect(landingCsv).toContain('approved');
      expect(landingCsv).toContain('Buy now');
      expect(landingCsv).not.toContain('token=secret');
    } finally {
      collections.business_daily_notes.pop();
      collections.landing_pages.pop();
    }
  });

  it('treats adGroupId=0 as unattributed and only falls back through a unique product mapping', async () => {
    const originalProductIds = collections.google_ads_ad_groups[0].internalProductIds;
    collections.google_ads_ad_groups[0].internalProductIds = ['product-1'];
    collections.ordertest2.push({
      _id: 'order-placeholder',
      productId: 'product-1',
      adGroupId: '0',
      orderDate: new Date('2026-06-12T00:00:00.000Z'),
      quantity: 1,
      codAmount: 250,
    });

    try {
      const service = new GoogleAdsExportService(connection as any, exportModel as any);
      const result = await service.createLiveAnalysisExport({
        dateRange: { from: '2026-06-12', to: '2026-06-12' },
      });
      const zip = new AdmZip((await service.getDownload(result.exportId)).filePath);
      const orderLine = zip.readAsText('order_profit_attribution.csv')
        .split(/\r?\n/)
        .find((line) => line.includes('order-placeholder')) || '';
      const quality = JSON.parse(zip.readAsText('data_quality_report.json'));

      expect(orderLine).toContain('"30"');
      expect(orderLine).toContain('"product_mapping"');
      expect(orderLine).toContain('"0.5"');
      expect(quality.warnings).toEqual(expect.arrayContaining([
        expect.stringContaining('placeholder adGroupId=0'),
        expect.stringContaining('unique product-to-ad-group fallback'),
      ]));
    } finally {
      collections.google_ads_ad_groups[0].internalProductIds = originalProductIds;
      collections.ordertest2.pop();
    }
  });

  it('does not assign an order when its adGroupId exists in multiple customer accounts', async () => {
    collections.google_ads_ad_groups.push({
      customerId: '2222222222',
      campaignId: '99',
      adGroupId: '30',
      resourceName: 'customers/2222222222/adGroups/30',
      adGroupName: 'Same provider ID in another account',
    });
    collections.ordertest2.push({
      _id: 'order-ambiguous',
      productId: 'product-1',
      adGroupId: '30',
      orderDate: new Date('2026-06-12T00:00:00.000Z'),
      quantity: 1,
      codAmount: 250,
    });

    try {
      const service = new GoogleAdsExportService(connection as any, exportModel as any);
      const result = await service.createLiveAnalysisExport({
        dateRange: { from: '2026-06-12', to: '2026-06-12' },
      });
      const zip = new AdmZip((await service.getDownload(result.exportId)).filePath);
      const orderLine = zip.readAsText('order_profit_attribution.csv')
        .split(/\r?\n/)
        .find((line) => line.includes('order-ambiguous')) || '';
      const quality = JSON.parse(zip.readAsText('data_quality_report.json'));

      expect(orderLine).toContain('"ambiguous_ad_group"');
      expect(orderLine).toContain('"0"');
      expect(orderLine).not.toContain('"1234567890"');
      expect(orderLine).not.toContain('"2222222222"');
      expect(quality.warnings).toEqual(expect.arrayContaining([
        expect.stringContaining('shared by multiple Google Ads accounts'),
      ]));
    } finally {
      collections.google_ads_ad_groups.pop();
      collections.ordertest2.pop();
    }
  });
});
