import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import {
  ADS_PLATFORM_SOURCE_SYNC_STATUS_DEFAULT_SOURCE_KEYS,
  ADS_PLATFORM_SOURCE_SYNC_STATUS_REVIEWER_ROUTE,
  buildAdsPlatformSourceSyncStatusDeeplinkQueryParams,
} from '../ads-platform-source-sync-status-reviewer/ads-platform-source-sync-status-deeplink.util';
import type {
  AdsPlatformSourceSyncEvidenceLike,
  AdsPlatformSourceSyncStatusDeeplinkQueryParams,
} from '../ads-platform-source-sync-status-reviewer/ads-platform-source-sync-status-deeplink.util';
import {
  AdsDecisionDraftApprovalQueueResponse,
  AdsDecisionDraftApprovalRecord,
  AdsActionEvaluation,
  AdsActionPlan,
  AdsActionPlanItem,
  AiMarketingOverview,
  AiMarketingService,
  CreativePerformanceResponse,
  LeadFunnelRow,
  LeadFunnelResponse,
} from './ai-marketing.service';

@Component({
  selector: 'app-ai-marketing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ai-marketing.component.html',
  styleUrl: './ai-marketing.component.css',
})
export class AiMarketingComponent implements OnInit {
  readonly evidenceReviewerRoute = '/ai/ads-approval-evidence-reviewer';
  readonly sourceSyncStatusReviewerRoute = ADS_PLATFORM_SOURCE_SYNC_STATUS_REVIEWER_ROUTE;

  lookbackDays = 7;
  overview = signal<AiMarketingOverview | null>(null);
  funnel = signal<LeadFunnelResponse | null>(null);
  plans = signal<AdsActionPlan[]>([]);
  evaluations = signal<AdsActionEvaluation[]>([]);
  creativePerformance = signal<CreativePerformanceResponse | null>(null);
  durableApprovalQueue = signal<AdsDecisionDraftApprovalQueueResponse | null>(null);
  selectedPlanId = signal<string | null>(null);
  loading = signal(false);
  actionLoading = signal<string | null>(null);
  error = signal<string | null>(null);

  selectedPlan = computed(() => {
    const id = this.selectedPlanId();
    return this.plans().find((plan) => plan._id === id) || this.plans()[0] || null;
  });

  saleIssueRows = computed(() => this.funnel()?.rows.filter((row) => row.saleIssue).slice(0, 6) || []);
  pendingItems = computed(() => this.selectedPlan()?.items.filter((item) => item.status === 'pending') || []);
  approvedItems = computed(() => this.selectedPlan()?.items.filter((item) => item.status === 'approved') || []);
  durableApprovals = computed(() => this.durableApprovalQueue()?.pendingApprovals || []);

  constructor(private readonly service: AiMarketingService) {}

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(refreshEvaluations = false): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      overview: this.service.getOverview(this.lookbackDays),
      funnel: this.service.getLeadFunnel(this.lookbackDays),
      plans: this.service.listPlans(),
      evaluations: this.service.listEvaluations(refreshEvaluations),
      creativePerformance: this.service.getCreativePerformance(this.lookbackDays),
      decisionDraftApprovals: this.service.listDecisionDraftApprovals().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ overview, funnel, plans, evaluations, creativePerformance, decisionDraftApprovals }) => {
        this.overview.set(overview);
        this.funnel.set(funnel);
        this.plans.set(plans.plans || []);
        this.evaluations.set(evaluations.evaluations || []);
        this.creativePerformance.set(creativePerformance);
        this.durableApprovalQueue.set(decisionDraftApprovals);
        if (!this.selectedPlanId() && plans.plans?.length) {
          this.selectedPlanId.set(plans.plans[0]._id);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Không tải được dữ liệu AI Marketing');
        this.loading.set(false);
      },
    });
  }

  syncLeads(): void {
    this.actionLoading.set('sync-leads');
    this.error.set(null);
    this.service.syncLeads(this.lookbackDays).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.loadAll(true);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Không đồng bộ được lead');
        this.actionLoading.set(null);
      },
    });
  }

  generatePlan(): void {
    this.actionLoading.set('generate');
    this.error.set(null);
    this.service.generatePlan(this.lookbackDays).subscribe({
      next: (res) => {
        this.selectedPlanId.set(res.plan._id);
        this.actionLoading.set(null);
        this.loadAll();
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Không tạo được kế hoạch');
        this.actionLoading.set(null);
      },
    });
  }

  approve(plan: AdsActionPlan, item: AdsActionPlanItem, approved: boolean): void {
    this.actionLoading.set(`${approved ? 'approve' : 'reject'}-${item._id}`);
    this.service.approveItem(plan._id, item._id, approved, item.targetValue).subscribe({
      next: (res) => {
        this.replacePlan(res.plan);
        this.actionLoading.set(null);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Không cập nhật được phê duyệt');
        this.actionLoading.set(null);
      },
    });
  }

  apply(plan: AdsActionPlan, dryRun: boolean): void {
    this.actionLoading.set(dryRun ? `dry-${plan._id}` : `apply-${plan._id}`);
    this.service.applyPlan(plan._id, dryRun).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.loadAll(true);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Không áp dụng được kế hoạch');
        this.actionLoading.set(null);
      },
    });
  }

  runProviderAction(row: LeadFunnelRow, action: 'pause' | 'resume', dryRun = false): void {
    const key = `${dryRun ? 'dry-' : ''}${action}-${row.adGroupId}`;
    this.actionLoading.set(key);
    this.error.set(null);
    this.service.runAdGroupAction(row.adGroupId, {
      action,
      dryRun,
      note: `${dryRun ? 'Chạy thử' : 'Trực tiếp'} ${this.statusText(action).toLowerCase()} từ bảng AI Marketing`,
    }).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.loadAll(true);
      },
      error: (err) => {
        this.error.set(err?.error?.message || `Không thể ${this.statusText(action).toLowerCase()} nhóm quảng cáo`);
        this.actionLoading.set(null);
      },
    });
  }

  selectPlan(plan: AdsActionPlan): void {
    this.selectedPlanId.set(plan._id);
  }

  formatCurrency(value?: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(value || 0);
  }

  formatPercent(value?: number): string {
    return `${Number(value || 0).toFixed(1)}%`;
  }

  closeRate(row: LeadFunnelRow): string {
    return `${(row.closeRate * 100).toFixed(1)}%`;
  }

  statusText(value?: unknown): string {
    const raw = this.text(value);
    if (!raw) return '';

    const labels: Record<string, string> = {
      production_ready_after_live_provider_validation: 'Sẵn sàng sau kiểm chứng live',
      manual_or_dry_run_only: 'Chỉ thủ công hoặc chạy thử',
      pending: 'Chờ duyệt',
      approved: 'Đã duyệt',
      rejected: 'Đã từ chối',
      draft: 'Bản nháp',
      ready: 'Sẵn sàng',
      blocked: 'Bị chặn',
      hold: 'Giữ lại',
      paused: 'Đã tạm dừng',
      active: 'Đang hoạt động',
      enabled: 'Đang bật',
      disabled: 'Đang tắt',
      complete: 'Hoàn tất',
      completed: 'Hoàn tất',
      failed: 'Thất bại',
      running: 'Đang chạy',
      waiting: 'Đang chờ',
      pause: 'Tạm dừng',
      resume: 'Chạy lại',
      increase_budget: 'Tăng ngân sách',
      decrease_budget: 'Giảm ngân sách',
      budget_update: 'Cập nhật ngân sách',
      bid_update: 'Cập nhật giá thầu',
      monitor_only: 'Chỉ giám sát',
      dry_run: 'Chạy thử',
      local: 'Lưu cục bộ',
      durable: 'Lưu bền vững',
      high: 'Cao',
      medium: 'Trung bình',
      low: 'Thấp',
      good: 'Tốt',
      warning: 'Cảnh báo',
      poor: 'Kém',
      valid: 'Hợp lệ',
      invalid: 'Không hợp lệ',
      eligible: 'Đủ điều kiện',
      ineligible: 'Không đủ điều kiện',
      safe: 'An toàn',
      risky: 'Rủi ro',
      positive: 'Tích cực',
      negative: 'Tiêu cực',
      neutral: 'Trung tính',
      direct: 'Trực tiếp',
      estimated: 'Ước tính',
      blended: 'Tổng hợp',
    };

    return labels[raw] || raw.replace(/_/g, ' ');
  }

  approvalEvidenceQueryParams(item: AdsActionPlanItem): { approval_id: string } | null {
    const approvalId = this.approvalIdForItem(item);
    return approvalId ? { approval_id: approvalId } : null;
  }

  durableApprovalEvidenceQueryParams(record: AdsDecisionDraftApprovalRecord): { approval_id: string } {
    return { approval_id: record.approval_id };
  }

  planSourceSyncStatusQueryParams(
    plan: AdsActionPlan,
    item: AdsActionPlanItem,
  ): AdsPlatformSourceSyncStatusDeeplinkQueryParams | null {
    const metadata = item.metadata || {};
    const reportDate = this.firstMetadataValue(metadata, [
      'reportDate',
      'report_date',
      'snapshotDate',
      'snapshot_date',
      'draftReportDate',
      'draft_report_date',
    ]);
    const sourceKeys = this.firstMetadataValue(metadata, [
      'sourceKeys',
      'source_keys',
      'sourceSyncSourceKeys',
      'source_sync_source_keys',
    ]);
    const evidence = this.sourceSyncEvidenceFromUnknown(
      metadata['sourceSyncDecisionEvidence'] || metadata['source_sync_decision_evidence'],
    );
    const hasDeeplinkSeed = this.text(reportDate)
      || this.text(sourceKeys)
      || evidence.length > 0
      || this.approvalIdForItem(item);
    if (!hasDeeplinkSeed) return null;

    return buildAdsPlatformSourceSyncStatusDeeplinkQueryParams({
      reportDate,
      now: this.firstMetadataValue(metadata, [
        'sourceSyncEvaluatedAt',
        'source_sync_evaluated_at',
        'generatedAt',
        'generated_at',
      ]) || plan.updatedAt || plan.createdAt,
      sourceKeys,
      evidence,
      fallbackReportDate: plan.createdAt || plan.updatedAt,
      fallbackSourceKeys: ADS_PLATFORM_SOURCE_SYNC_STATUS_DEFAULT_SOURCE_KEYS,
    });
  }

  durableApprovalSourceSyncStatusQueryParams(
    record: AdsDecisionDraftApprovalRecord,
  ): AdsPlatformSourceSyncStatusDeeplinkQueryParams | null {
    const typedPayload = record.typedPayload || {};
    return buildAdsPlatformSourceSyncStatusDeeplinkQueryParams({
      reportDate: this.firstMetadataValue(typedPayload, [
        'reportDate',
        'report_date',
        'snapshotDate',
        'snapshot_date',
        'draftReportDate',
        'draft_report_date',
      ]),
      now: record.persistedAt || record.createdAt,
      sourceKeys: this.firstMetadataValue(typedPayload, [
        'sourceKeys',
        'source_keys',
        'sourceSyncSourceKeys',
        'source_sync_source_keys',
      ]),
      evidence: record.sourceSyncDecisionEvidence || [],
      fallbackReportDate: record.createdAt,
      fallbackSourceKeys: ADS_PLATFORM_SOURCE_SYNC_STATUS_DEFAULT_SOURCE_KEYS,
    });
  }

  durableApprovalTitle(record: AdsDecisionDraftApprovalRecord): string {
    return record.typedPayload?.['title'] as string
      || record.rationale
      || `${record.action_type} ${record.entity_id}`;
  }

  trackById(
    _: number,
    item: { _id?: string; adGroupId?: string; creativeId?: string; approval_id?: string; source_decision_id?: string },
  ): string {
    return item._id || item.approval_id || item.source_decision_id || item.adGroupId || item.creativeId || String(_);
  }

  private replacePlan(plan: AdsActionPlan): void {
    const next = this.plans().map((item) => (item._id === plan._id ? plan : item));
    if (!next.some((item) => item._id === plan._id)) next.unshift(plan);
    this.plans.set(next);
  }

  private approvalIdForItem(item: AdsActionPlanItem): string {
    return (
      this.text(item.approval_id)
      || this.text(item.approvalId)
      || this.text(item.metadata?.['approval_id'])
      || this.text(item.metadata?.['approvalId'])
      || this.text(item.metadata?.['adsAutomationApprovalId'])
    );
  }

  private firstMetadataValue(source: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
      const value = source[key];
      if (Array.isArray(value) && value.length) return value;
      if (this.text(value)) return value;
    }
    return '';
  }

  private sourceSyncEvidenceFromUnknown(value: unknown): AdsPlatformSourceSyncEvidenceLike[] {
    return Array.isArray(value)
      ? value.filter((item): item is AdsPlatformSourceSyncEvidenceLike => (
        item !== null && typeof item === 'object'
      ))
      : [];
  }

  private text(value: unknown): string {
    return String(value ?? '').trim();
  }
}
