import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AiMarketingOverview {
  success: boolean;
  window: { from: string; to: string; lookbackDays: number };
  summary: {
    leads: number;
    orders: number;
    adsSpent: number;
    netProfit: number;
    roi: number;
    saleIssueAdGroups: number;
    pendingPlans: number;
    approvedItemsWaitingApply: number;
    pendingEvaluations: number;
  };
  assistantQuality?: any;
  readiness: {
    status: string;
    dataReadinessStatus?: string;
    providerExecutionEnabled?: boolean;
    executionMode?: string;
    canReadRealMoney: boolean;
    canDetectSalesIssues: string;
    canGeneratePlan: boolean;
    canApplyWithApproval: boolean;
    canDryRunPlan?: boolean;
    canEvaluateAfterApply: boolean;
    missing: string[];
    decisionStandard?: string[];
    dataQuality?: {
      totalRows: number;
      highQualityRows: number;
      mediumQualityRows: number;
      lowQualityRows: number;
      minScore: number;
      avgScore: number;
    };
  };
  creativeSummary?: {
    totalCreatives: number;
    creativesWithLeadAttribution: number;
    totalLeads: number;
    totalWon: number;
    totalEstimatedSpend: number;
    totalNetProfit: number;
  };
}

export interface LeadFunnelRow {
  adGroupId: string;
  adGroupName?: string;
  platform?: string;
  adsSpent: number;
  totalLeads: number;
  explicitLeads: number;
  inferredConversationLeads: number;
  pendingOrders: number;
  totalOrders: number;
  successOrders: number;
  revenue: number;
  netProfit: number;
  roi: number;
  closeRate: number;
  costPerLead: number;
  costPerOrder: number;
  saleIssue: boolean;
  saleIssueReason?: string;
  dataQuality: string;
  dataQualityScore: number;
  dataQualityGrade: string;
  dataQualityReasons: string[];
}

export interface LeadFunnelResponse {
  success: boolean;
  summary: {
    totalAdGroups: number;
    totalLeads: number;
    totalOrders: number;
    adsSpent: number;
    netProfit: number;
    roi: number;
    closeRate: number;
    saleIssueAdGroups: number;
  };
  rows: LeadFunnelRow[];
}

export interface AdsActionPlanItem {
  _id: string;
  approval_id?: string;
  approvalId?: string;
  actionType: string;
  adGroupId?: string;
  adGroupName?: string;
  platform?: string;
  currentValue?: number;
  targetValue?: number;
  expectedProfit?: number;
  expectedRoi?: number;
  confidence?: number;
  reason?: string;
  riskLevel?: string;
  status: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  metadata?: {
    eligibility?: string;
    blockers?: string[];
    dataQualityScore?: number;
    dataQualityGrade?: string;
    dataQualityReasons?: string[];
    executionMode?: string;
    providerExecutionEnabled?: boolean;
    task?: string;
    [key: string]: any;
  };
}

export interface AdsActionPlan {
  _id: string;
  title: string;
  status: string;
  summary?: any;
  items: AdsActionPlanItem[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdsActionEvaluation {
  _id: string;
  adGroupId?: string;
  platform?: string;
  status: string;
  verdict?: string;
  insight?: string;
  beforeMetrics?: any;
  afterMetrics?: any;
  delta?: any;
  createdAt?: string;
  evaluatedAt?: string;
}

export interface AdsDecisionDraftSourceSyncEvidence {
  sourceKey?: string;
  reportDate?: string;
  freshnessStatus?: string;
  coverageStatus?: string;
  lastSuccessfulSyncAt?: string | null;
  latestRecordDate?: string | null;
  blockingReason?: string | null;
  blockingReasons?: string[];
  canUseForAdsAutomationDecision?: boolean;
}

export interface CreativePerformanceRow {
  creativeId: string;
  platform: string;
  name?: string;
  status: string;
  adGroupIds: string[];
  totalLeads: number;
  contactedLeads: number;
  wonLeads: number;
  lostLeads: number;
  revenue: number;
  grossProfit: number;
  netProfit: number;
  estimatedSpend: number;
  roi: number;
  closeRate: number;
  attributionMode: string;
}

export interface CreativePerformanceResponse {
  success: boolean;
  summary: {
    totalCreatives: number;
    creativesWithLeadAttribution: number;
    totalLeads: number;
    totalWon: number;
    totalEstimatedSpend: number;
    totalNetProfit: number;
  };
  rows: CreativePerformanceRow[];
  notes: string[];
}

export interface AdsDecisionDraftApprovalRecord {
  approval_id: string;
  source_draft_id: string;
  source_decision_id: string;
  action_type: string;
  action_family: string;
  provider: string | null;
  resource_type: string;
  entity_type: string;
  entity_id: string;
  accountId: string | null;
  productId: string | null;
  supplierId: string | null;
  platform: string | null;
  status: string;
  approval_required: boolean;
  execution_allowed_now: boolean;
  validate_only_required: boolean;
  future_provider_validateOnly_required: boolean;
  provider_api_called: boolean;
  google_ads_api_called: boolean;
  live_ads_execution_used: boolean;
  erp_mutation_used: boolean;
  payment_mutation_used: boolean;
  persistence_used: boolean;
  durable_storage_used: boolean;
  erp_local_persistence_used: boolean;
  provider_persistence_used: boolean;
  storage: string;
  typedPayload?: Record<string, unknown>;
  sourceSyncDecisionEvidence?: AdsDecisionDraftSourceSyncEvidence[];
  sourceSyncDecisionGates?: Record<string, unknown> | null;
  blockers?: string[];
  missing_data_blockers?: string[];
  idempotency_key: string;
  rationale: string;
  createdAt: string;
  persistedAt: string;
}

export interface AdsDecisionDraftApprovalQueueResponse {
  schemaVersion: 'ads_automation_decision_draft_approval_queue.v1';
  generatedAt: string;
  query: Record<string, unknown>;
  safety: {
    read_only: boolean;
    dry_run: boolean;
    persistence_used: boolean;
    durable_storage_used: boolean;
    erp_local_persistence_used: boolean;
    provider_persistence_used: boolean;
    provider_api_called: boolean;
    google_ads_api_called: boolean;
    validateOnly_called: boolean;
    live_ads_execution_used: boolean;
    erp_mutation_used: boolean;
    payment_mutation_used: boolean;
    production_ready: boolean;
    approval_required_for_all_records: boolean;
    execution_allowed_now: boolean;
  };
  summary: {
    total_pending_approvals: number;
    pending_approvals_listed: number;
    provider_action_approvals: number;
    internal_task_approvals: number;
    monitoring_approvals: number;
  };
  pendingApprovals: AdsDecisionDraftApprovalRecord[];
}

@Injectable({ providedIn: 'root' })
export class AiMarketingService {
  private readonly baseUrl = `${environment.apiUrl}/ai-marketing`;
  private readonly adsAutomationApprovalBaseUrl = `${environment.apiUrl}/ai/ads-automation/decision-draft-approvals`;

  constructor(private readonly http: HttpClient) {}

  getOverview(lookbackDays: number): Observable<AiMarketingOverview> {
    return this.http.get<AiMarketingOverview>(`${this.baseUrl}/overview`, {
      params: this.windowParams(lookbackDays),
    });
  }

  getLeadFunnel(lookbackDays: number): Observable<LeadFunnelResponse> {
    return this.http.get<LeadFunnelResponse>(`${this.baseUrl}/leads/funnel`, {
      params: this.windowParams(lookbackDays),
    });
  }

  syncLeads(lookbackDays: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/leads/sync`, {
      lookbackDays,
      limit: 3000,
    });
  }

  getCreativePerformance(lookbackDays: number): Observable<CreativePerformanceResponse> {
    return this.http.get<CreativePerformanceResponse>(`${this.baseUrl}/creatives/performance`, {
      params: this.windowParams(lookbackDays),
    });
  }

  listPlans(): Observable<{ success: boolean; plans: AdsActionPlan[]; total: number }> {
    return this.http.get<{ success: boolean; plans: AdsActionPlan[]; total: number }>(`${this.baseUrl}/plans`);
  }

  generatePlan(lookbackDays: number): Observable<{ success: boolean; plan: AdsActionPlan }> {
    return this.http.post<{ success: boolean; plan: AdsActionPlan }>(`${this.baseUrl}/plans/generate`, {
      lookbackDays,
    });
  }

  approveItem(
    planId: string,
    itemId: string,
    approved: boolean,
    confirmedTargetValue?: number,
  ): Observable<{ success: boolean; plan: AdsActionPlan }> {
    return this.http.patch<{ success: boolean; plan: AdsActionPlan }>(
      `${this.baseUrl}/plans/${planId}/items/${itemId}/approve`,
      {
        approved,
        confirmedTargetValue,
      },
    );
  }

  applyPlan(planId: string, dryRun: boolean): Observable<any> {
    return this.http.post(`${this.baseUrl}/plans/${planId}/apply`, {
      dryRun,
      evaluationDays: 3,
    });
  }

  runAdGroupAction(
    adGroupId: string,
    body: { action: 'pause' | 'resume' | 'set_budget'; dryRun?: boolean; targetBudget?: number; note?: string },
  ): Observable<any> {
    return this.http.post(`${this.baseUrl}/ad-groups/${encodeURIComponent(adGroupId)}/actions`, body);
  }

  listEvaluations(refresh = false): Observable<{ success: boolean; summary: any; evaluations: AdsActionEvaluation[] }> {
    return this.http.get<{ success: boolean; summary: any; evaluations: AdsActionEvaluation[] }>(
      `${this.baseUrl}/actions/evaluations`,
      {
        params: refresh ? new HttpParams().set('refresh', 'true') : undefined,
      },
    );
  }

  listDecisionDraftApprovals(): Observable<AdsDecisionDraftApprovalQueueResponse> {
    return this.http.get<AdsDecisionDraftApprovalQueueResponse>(this.adsAutomationApprovalBaseUrl);
  }

  private windowParams(lookbackDays: number): HttpParams {
    return new HttpParams().set('lookbackDays', String(lookbackDays || 7));
  }
}
