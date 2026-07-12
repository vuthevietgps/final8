import { Injectable } from '@nestjs/common';
import { AdsAutomationDecisionSourceAdapterService } from './ads-automation-decision-source-adapter.service';
import type {
  AdsAutomationAdGroupReadRow,
  AdsAutomationDecisionSourceAdapterInput,
  AdsAutomationDecisionSourceKey,
  AdsAutomationSourceStampedRow,
} from './contracts/ads-automation-decision-source-adapter.contract';
import type {
  AdsAutomationCampaignBudgetReadRow,
  AdsAutomationDecisionReadModelQuery,
  AdsAutomationDecisionReadModelQueryEvidence,
  AdsAutomationDecisionReadModelQueryResult,
  AdsAutomationDecisionReadModelRepository,
} from './contracts/ads-automation-decision-read-model-query.contract';

@Injectable()
export class AdsAutomationDecisionReadModelQueryService {
  constructor(private readonly adapter: AdsAutomationDecisionSourceAdapterService) {}

  async buildFromRepository(
    repository: AdsAutomationDecisionReadModelRepository,
    query: AdsAutomationDecisionReadModelQuery = {},
  ): Promise<AdsAutomationDecisionReadModelQueryResult> {
    const [
      adGroups,
      campaignBudgets,
      products,
      suppliers,
      policy,
      repositoryWatermarks,
    ] = await Promise.all([
      repository.findAdGroupPerformanceRows(query),
      repository.findCampaignBudgetRows(query),
      repository.findProductPerformanceRows(query),
      repository.findSupplierSafetyRows(query),
      repository.findCashflowPolicyRow(query),
      repository.findSourceWatermarks?.(query) || Promise.resolve({}),
    ]);

    const budgetJoin = this.attachVerifiedCampaignBudgets(adGroups, campaignBudgets);
    const sourceWatermarks = {
      ...this.inferWatermarks({
        adGroups,
        campaignBudgets,
        products,
        suppliers,
        policy: policy ? [policy] : [],
      }),
      ...repositoryWatermarks,
    };

    const input: AdsAutomationDecisionSourceAdapterInput = {
      snapshotDate: query.snapshotDate,
      evidenceWindow: query.evidenceWindow,
      policy,
      adGroups: budgetJoin.rows,
      products,
      suppliers,
      sourceWatermarks,
    };

    const adapterResult = this.adapter.build(input, {
      snapshotDate: query.snapshotDate,
      evidenceWindow: query.evidenceWindow,
      now: query.now,
      maxAgeHours: query.maxAgeHours,
    });

    return {
      ...adapterResult,
      queryEvidence: [
        ...budgetJoin.evidence,
        this.collectionEvidence('ads_performance', 'ad_group', 'ad_group_performance_rows', adGroups.length),
        this.collectionEvidence('product_performance', 'product', 'product_performance_rows', products.length),
        this.collectionEvidence('supplier_safety', 'supplier', 'supplier_safety_rows', suppliers.length),
        this.collectionEvidence('cashflow_policy', 'policy', 'cashflow_policy', policy ? 1 : 0, policy ? [] : ['cashflow_policy']),
      ],
    };
  }

  private attachVerifiedCampaignBudgets(
    adGroups: AdsAutomationAdGroupReadRow[],
    budgets: AdsAutomationCampaignBudgetReadRow[],
  ) {
    const byResourceName = new Map<string, AdsAutomationCampaignBudgetReadRow>();
    const byCustomerBudgetId = new Map<string, AdsAutomationCampaignBudgetReadRow>();
    const byBudgetId = new Map<string, AdsAutomationCampaignBudgetReadRow>();

    for (const budget of budgets) {
      const resourceName = this.text(budget.resourceName || budget.campaignBudgetResourceName);
      const budgetId = this.text(budget.campaignBudgetId);
      const customerId = this.text(budget.customerId || budget.accountId);
      if (resourceName) byResourceName.set(resourceName, budget);
      if (budgetId) byBudgetId.set(budgetId, budget);
      if (customerId && budgetId) byCustomerBudgetId.set(this.composite(customerId, budgetId), budget);
    }

    const evidence: AdsAutomationDecisionReadModelQueryEvidence[] = [];
    const rows = adGroups.map((row) => {
      const entityId = this.text(row.adGroupId || row.resourceName || row.campaignId) || 'unknown';
      const explicitResourceName = this.text(row.campaignBudgetResourceName);
      const explicitBudgetId = this.text(row.campaignBudgetId);
      const customerId = this.text(row.customerId || row.accountId);

      if (!explicitResourceName && !explicitBudgetId) {
        evidence.push({
          sourceKey: 'campaign_budgets',
          entityType: 'ad_group',
          entityId,
          status: 'missing',
          rowCount: 0,
          missingFields: ['campaignBudgetId_or_campaignBudgetResourceName'],
          rationale: 'Ad group row has no explicit campaign budget ID or resource name; campaign/ad group IDs are not used as fallbacks.',
        });
        return {
          ...row,
          campaignBudgetId: undefined,
          campaignBudgetResourceName: undefined,
        };
      }

      const budget = this.findBudget({
        explicitResourceName,
        explicitBudgetId,
        customerId,
        byResourceName,
        byCustomerBudgetId,
        byBudgetId,
      });

      if (!budget) {
        evidence.push({
          sourceKey: 'campaign_budgets',
          entityType: 'ad_group',
          entityId,
          status: 'unmatched',
          rowCount: 0,
          missingFields: ['verifiedCampaignBudgetReadRow'],
          rationale: 'Ad group references a budget ID/resource name, but no synced campaign budget row verified it.',
        });
        return {
          ...row,
          campaignBudgetId: undefined,
          campaignBudgetResourceName: undefined,
          currentBudgetVnd: undefined,
          dailyBudgetVnd: undefined,
          campaignBudgetAmountVnd: undefined,
        };
      }

      evidence.push({
        sourceKey: 'campaign_budgets',
        entityType: 'ad_group',
        entityId,
        status: 'loaded',
        rowCount: 1,
        missingFields: this.budgetMissingFields(budget),
        rationale: 'Campaign budget was verified from a synced campaign budget read row.',
      });

      const amountVnd = this.budgetAmountVnd(budget);
      return {
        ...row,
        campaignBudgetId: this.text(budget.campaignBudgetId) || explicitBudgetId,
        campaignBudgetResourceName: this.text(budget.resourceName || budget.campaignBudgetResourceName) || explicitResourceName,
        currentBudgetVnd: amountVnd ?? row.currentBudgetVnd ?? row.dailyBudgetVnd ?? row.campaignBudgetAmountVnd,
        dailyBudgetVnd: amountVnd ?? row.dailyBudgetVnd,
        campaignBudgetAmountVnd: amountVnd ?? row.campaignBudgetAmountVnd,
      };
    });

    return { rows, evidence };
  }

  private findBudget(params: {
    explicitResourceName?: string;
    explicitBudgetId?: string;
    customerId?: string;
    byResourceName: Map<string, AdsAutomationCampaignBudgetReadRow>;
    byCustomerBudgetId: Map<string, AdsAutomationCampaignBudgetReadRow>;
    byBudgetId: Map<string, AdsAutomationCampaignBudgetReadRow>;
  }) {
    if (params.explicitResourceName) {
      const byResource = params.byResourceName.get(params.explicitResourceName);
      if (byResource) return byResource;
    }
    if (params.customerId && params.explicitBudgetId) {
      const byCustomer = params.byCustomerBudgetId.get(this.composite(params.customerId, params.explicitBudgetId));
      if (byCustomer) return byCustomer;
    }
    return params.explicitBudgetId ? params.byBudgetId.get(params.explicitBudgetId) : undefined;
  }

  private budgetMissingFields(budget: AdsAutomationCampaignBudgetReadRow): string[] {
    const missing: string[] = [];
    if (!this.text(budget.campaignBudgetId) && !this.text(budget.resourceName || budget.campaignBudgetResourceName)) {
      missing.push('campaignBudgetId_or_campaignBudgetResourceName');
    }
    if (this.budgetAmountVnd(budget) === undefined) missing.push('currentBudgetVnd');
    return missing;
  }

  private collectionEvidence(
    sourceKey: AdsAutomationDecisionSourceKey,
    entityType: AdsAutomationDecisionReadModelQueryEvidence['entityType'],
    entityId: string,
    rowCount: number,
    missingFields: string[] = [],
  ): AdsAutomationDecisionReadModelQueryEvidence {
    return {
      sourceKey,
      entityType,
      entityId,
      status: rowCount > 0 && missingFields.length === 0 ? 'loaded' : 'missing',
      rowCount,
      missingFields,
      rationale: rowCount > 0
        ? 'Read-model rows were loaded from the repository contract.'
        : 'No read-model rows were returned by the repository contract.',
    };
  }

  private inferWatermarks(rows: {
    adGroups: AdsAutomationSourceStampedRow[];
    campaignBudgets: AdsAutomationSourceStampedRow[];
    products: AdsAutomationSourceStampedRow[];
    suppliers: AdsAutomationSourceStampedRow[];
    policy: AdsAutomationSourceStampedRow[];
  }): Partial<Record<AdsAutomationDecisionSourceKey, string>> {
    return {
      ads_performance: this.latestObservedAt(rows.adGroups),
      campaign_budgets: this.latestObservedAt(rows.campaignBudgets),
      pause_review: this.latestObservedAt(rows.adGroups),
      product_performance: this.latestObservedAt(rows.products),
      supplier_safety: this.latestObservedAt(rows.suppliers),
      cashflow_policy: this.latestObservedAt(rows.policy),
    };
  }

  private latestObservedAt(rows: AdsAutomationSourceStampedRow[]): string | undefined {
    const timestamps = rows
      .flatMap((row) => [row.lastSyncAt, row.lastSyncedAt, row.sourceUpdatedAt, row.updatedAt, row.createdAt])
      .map((value) => this.timestamp(value))
      .filter((value): value is number => value !== null);
    return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : undefined;
  }

  private budgetAmountVnd(budget: AdsAutomationCampaignBudgetReadRow): number | undefined {
    const amountVnd = this.numberOrUndefined(budget.amountVnd);
    if (amountVnd !== undefined) return amountVnd;
    const amountMicros = this.numberOrUndefined(budget.amountMicros);
    return amountMicros === undefined ? undefined : amountMicros / 1_000_000;
  }

  private composite(left: string, right: string): string {
    return `${left}:${right}`;
  }

  private text(value: unknown): string | undefined {
    const text = String(value ?? '').trim();
    return text ? text : undefined;
  }

  private numberOrUndefined(value: unknown): number | undefined {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : undefined;
  }

  private timestamp(value?: string | Date): number | null {
    if (!value) return null;
    const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }
}
