import type {
  AdsAutomationDecisionSnapshot,
  AdsAutomationEvidenceWindow,
} from './ads-automation-decision.contract';
import type {
  AdsAutomationAdGroupReadRow,
  AdsAutomationCashflowPolicyReadRow,
  AdsAutomationDecisionMissingFieldEvidence,
  AdsAutomationDecisionSourceAdapterResult,
  AdsAutomationDecisionSourceEvidence,
  AdsAutomationDecisionSourceKey,
  AdsAutomationProductReadRow,
  AdsAutomationSourceStampedRow,
  AdsAutomationSupplierReadRow,
} from './ads-automation-decision-source-adapter.contract';

export interface AdsAutomationDecisionReadModelQuery {
  snapshotDate?: string;
  evidenceWindow?: AdsAutomationEvidenceWindow;
  customerIds?: string[];
  accountIds?: string[];
  productIds?: string[];
  now?: string | Date;
  maxAgeHours?: Partial<Record<AdsAutomationDecisionSourceKey, number>>;
}

export interface AdsAutomationCampaignBudgetReadRow extends AdsAutomationSourceStampedRow {
  customerId?: string;
  accountId?: string;
  campaignBudgetId?: string;
  resourceName?: string;
  campaignBudgetResourceName?: string;
  amountVnd?: number;
  amountMicros?: number;
  status?: string;
}

export interface AdsAutomationDecisionReadModelRepository {
  findAdGroupPerformanceRows(
    query: AdsAutomationDecisionReadModelQuery,
  ): Promise<AdsAutomationAdGroupReadRow[]>;
  findCampaignBudgetRows(
    query: AdsAutomationDecisionReadModelQuery,
  ): Promise<AdsAutomationCampaignBudgetReadRow[]>;
  findProductPerformanceRows(
    query: AdsAutomationDecisionReadModelQuery,
  ): Promise<AdsAutomationProductReadRow[]>;
  findSupplierSafetyRows(
    query: AdsAutomationDecisionReadModelQuery,
  ): Promise<AdsAutomationSupplierReadRow[]>;
  findCashflowPolicyRow(
    query: AdsAutomationDecisionReadModelQuery,
  ): Promise<AdsAutomationCashflowPolicyReadRow | undefined>;
  findSourceWatermarks?(
    query: AdsAutomationDecisionReadModelQuery,
  ): Promise<Partial<Record<AdsAutomationDecisionSourceKey, string | Date>>>;
}

export type AdsAutomationDecisionReadModelQueryEvidenceStatus =
  | 'loaded'
  | 'missing'
  | 'unmatched';

export interface AdsAutomationDecisionReadModelQueryEvidence {
  sourceKey: AdsAutomationDecisionSourceKey;
  entityType: 'ad_group' | 'product' | 'supplier' | 'policy';
  entityId: string;
  status: AdsAutomationDecisionReadModelQueryEvidenceStatus;
  rowCount: number;
  missingFields: string[];
  rationale: string;
}

export interface AdsAutomationDecisionReadModelQueryResult
  extends AdsAutomationDecisionSourceAdapterResult {
  queryEvidence: AdsAutomationDecisionReadModelQueryEvidence[];
}

export interface AdsAutomationDecisionReadModelSnapshotResponse {
  schemaVersion: 'ads_automation_decision_read_model_snapshot.v1';
  generatedAt: string;
  source: 'mongo_read_model';
  query: AdsAutomationDecisionReadModelQuery;
  safety: {
    read_only: true;
    dry_run: true;
    repository_read_only: true;
    provider_api_used: false;
    google_ads_api_used: false;
    live_ads_execution_used: false;
    erp_mutation_used: false;
    payment_mutation_used: false;
    production_ready: false;
    approval_required_for_future_actions: true;
  };
  sourceEvidence: AdsAutomationDecisionSourceEvidence[];
  missingFieldEvidence: AdsAutomationDecisionMissingFieldEvidence[];
  queryEvidence: AdsAutomationDecisionReadModelQueryEvidence[];
  snapshot: AdsAutomationDecisionSnapshot;
}
