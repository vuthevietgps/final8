import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, Optional, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {
  ADS_PLATFORM_SOURCE_SYNC_STATUS_DEFAULT_SOURCE_KEYS,
  ADS_PLATFORM_SOURCE_SYNC_STATUS_REVIEWER_ROUTE,
  buildAdsPlatformSourceSyncStatusDeeplinkQueryParams,
} from '../ads-platform-source-sync-status-reviewer/ads-platform-source-sync-status-deeplink.util';
import {
  ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY,
  buildAdsApprovalSourceSyncHandoffPrefillBundle,
} from '../ads-platform-source-sync-status-reviewer/ads-approval-source-sync-handoff-prefill.util';
import type {
  AdsPlatformSourceSyncStatusDeeplinkQueryParams,
} from '../ads-platform-source-sync-status-reviewer/ads-platform-source-sync-status-deeplink.util';
import {
  AdsApprovalEvidenceFixtureOption,
  AdsApprovalEvidenceSourceSyncGateStatus,
  AdsApprovalEvidenceReviewerDocsLocalSnapshot,
  AdsApprovalEvidenceReviewerDocsLocalSnapshotCompareAuditExport,
  AdsApprovalEvidenceReviewerDocsLocalSnapshotCompareResult,
  AdsApprovalEvidenceReviewerDocsLocalSnapshotMetricDelta,
  AdsApprovalEvidenceReviewerDocsLocalSnapshotSafetyDelta,
  AdsApprovalEvidenceReviewerDocsLocalSnapshotSafetyKey,
  AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSyncDelta,
  AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSyncListDelta,
  AdsApprovalEvidenceReviewerDocsResponse,
  AdsApprovalEvidenceReviewerDocsRouteExample,
  AdsApprovalEvidenceReviewerDocsSection,
  AdsApprovalEvidenceReviewerService,
} from './ads-approval-evidence-reviewer.service';

type SafetyGateKey =
  | 'future_live_execution_allowed'
  | 'execution_allowed_now'
  | 'live_path_implemented'
  | 'provider_api_called'
  | 'google_ads_api_called'
  | 'validateOnly_called'
  | 'live_ads_execution_used'
  | 'erp_mutation_used'
  | 'payment_mutation_used'
  | 'production_ready'
  | 'reviewer_docs_persistence_performed'
  | 'reviewer_export_persistence_performed';

interface SafetyGateRow {
  key: SafetyGateKey;
  label: string;
  value: boolean;
  pass: boolean;
}

interface SummaryCard {
  label: string;
  value: string;
  tone: 'neutral' | 'good' | 'warn';
}

@Component({
  selector: 'app-ads-approval-evidence-reviewer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ads-approval-evidence-reviewer.component.html',
  styleUrl: './ads-approval-evidence-reviewer.component.css',
})
export class AdsApprovalEvidenceReviewerComponent implements OnInit, OnDestroy {
  readonly demoApprovalId = 'ADSAPPROVAL-review-fixture';
  readonly sourceSyncStatusReviewerRoute = ADS_PLATFORM_SOURCE_SYNC_STATUS_REVIEWER_ROUTE;
  readonly fixtureOptions: Array<{ value: AdsApprovalEvidenceFixtureOption | ''; label: string }> = [
    { value: '', label: 'Đọc dữ liệu thật' },
    { value: 'linked', label: 'Demo có liên kết' },
    { value: 'empty', label: 'Demo trống' },
  ];

  approvalId = this.demoApprovalId;
  fixture: AdsApprovalEvidenceFixtureOption | '' = '';
  docs = signal<AdsApprovalEvidenceReviewerDocsResponse | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  lastExportName = signal<string | null>(null);
  lastCompareExportName = signal<string | null>(null);
  lastCompareCopyStatus = signal<string | null>(null);
  leftSnapshotText = '';
  rightSnapshotText = '';
  compareAuditText = '';
  compareError = signal<string | null>(null);
  compareResult = signal<AdsApprovalEvidenceReviewerDocsLocalSnapshotCompareResult | null>(null);
  compareAuditReadbackError = signal<string | null>(null);
  compareAuditReadback = signal<AdsApprovalEvidenceReviewerDocsLocalSnapshotCompareAuditExport | null>(null);
  lastCompareAuditReadbackFileName = signal<string | null>(null);
  sourceSyncHandoffStatus = signal<string | null>(null);
  sourceSyncHandoffError = signal<string | null>(null);

  private readonly safetyGateKeys: SafetyGateKey[] = [
    'future_live_execution_allowed',
    'execution_allowed_now',
    'live_path_implemented',
    'provider_api_called',
    'google_ads_api_called',
    'validateOnly_called',
    'live_ads_execution_used',
    'erp_mutation_used',
    'payment_mutation_used',
    'production_ready',
    'reviewer_docs_persistence_performed',
    'reviewer_export_persistence_performed',
  ];

  private readonly safetyGateLabels: Record<SafetyGateKey, string> = {
    future_live_execution_allowed: 'Cho phép chạy live sau này',
    execution_allowed_now: 'Được thực thi lúc này',
    live_path_implemented: 'Có đường chạy live',
    provider_api_called: 'Gọi API nhà cung cấp',
    google_ads_api_called: 'Google Ads API',
    validateOnly_called: 'Gọi validateOnly',
    live_ads_execution_used: 'Đã chạy ads live',
    erp_mutation_used: 'Có ghi ERP',
    payment_mutation_used: 'Có ghi thanh toán',
    production_ready: 'Sẵn sàng production',
    reviewer_docs_persistence_performed: 'Có lưu tài liệu rà soát',
    reviewer_export_persistence_performed: 'Có lưu bản export',
  };
  private readonly destroy$ = new Subject<void>();

  summaryCards = computed<SummaryCard[]>(() => {
    const docs = this.docs();
    if (!docs) return [];

    return [
      {
        label: 'Trạng thái',
        value: this.statusText(docs.summary.docs_status),
        tone: docs.summary.docs_status === 'ready_for_review' ? 'good' : 'warn',
      },
      { label: 'Chế độ', value: this.statusText(docs.docsMode), tone: 'neutral' },
      {
        label: 'Bản ghi bằng chứng',
        value: String(docs.summary.total_evidence_records_rendered),
        tone: docs.summary.total_evidence_records_rendered > 0 ? 'good' : 'warn',
      },
      {
        label: 'Bằng chứng validateOnly',
        value: String(docs.summary.validateOnly_evidence_records_rendered),
        tone: 'neutral',
      },
      {
        label: 'Quyết định policy',
        value: String(docs.summary.policy_decision_records_rendered),
        tone: 'neutral',
      },
      {
        label: 'Bản ghi preflight',
        value: String(docs.summary.execution_preflight_records_rendered),
        tone: 'neutral',
      },
      {
        label: 'Cổng nguồn đồng bộ',
        value: this.statusText(this.sourceSyncGateStatus(docs.summary.source_sync_gate_status)),
        tone: this.sourceSyncGateTone(docs.summary.source_sync_gate_status),
      },
      {
        label: 'Bằng chứng nguồn đồng bộ',
        value: String(this.numberValue(docs.summary.source_sync_decision_evidence_records_rendered)),
        tone: this.numberValue(docs.summary.source_sync_decision_evidence_records_rendered) > 0
          ? 'good'
          : 'neutral',
      },
      {
        label: 'Nguồn bị chặn',
        value: String(this.numberValue(docs.summary.source_sync_decision_blocked_sources_rendered)),
        tone: this.numberValue(docs.summary.source_sync_decision_blocked_sources_rendered) > 0
          ? 'warn'
          : 'good',
      },
      {
        label: 'Bắt buộc duyệt',
        value: this.booleanText(docs.summary.approval_required),
        tone: docs.summary.approval_required ? 'good' : 'warn',
      },
      {
        label: 'Bước tiếp theo',
        value: this.statusText(docs.summary.next_required_action),
        tone: docs.summary.docs_status === 'ready_for_review' ? 'neutral' : 'warn',
      },
    ];
  });

  safetyGates = computed<SafetyGateRow[]>(() => {
    const safety = this.docs()?.safety;
    return this.safetyGateKeys.map((key) => {
      const value = safety ? safety[key] : false;
      return {
        key,
        label: this.safetyGateLabels[key],
        value,
        pass: value === false,
      };
    });
  });

  linkedEvidenceSection = computed(() => this.sectionById('linked_evidence'));
  sourceSyncSection = computed(() => this.sectionById('source_sync_evidence'));
  checklistSection = computed(() => this.sectionById('review_checklist'));
  linkedEvidenceIds = computed(() => this.linkedEvidenceSection()?.evidence_record_ids || []);
  sourceSyncBlockingReasons = computed(() => (
    this.docs()?.summary.source_sync_blocking_reasons_rendered || []
  ));
  sourceSyncSourceKeys = computed(() => (
    this.docs()?.reviewerExport.evidenceIndex.sourceSyncDecisionEvidence
      ?.map((record) => this.text(record.sourceKey))
      .filter((value) => value.length > 0) || []
  ));
  sourceSyncStatusQueryParams = computed<AdsPlatformSourceSyncStatusDeeplinkQueryParams | null>(() => {
    const docs = this.docs();
    if (!docs) return null;

    return buildAdsPlatformSourceSyncStatusDeeplinkQueryParams({
      now: docs.generatedAt,
      evidence: docs.reviewerExport.evidenceIndex.sourceSyncDecisionEvidence || [],
      fallbackReportDate: docs.generatedAt,
      fallbackSourceKeys: ADS_PLATFORM_SOURCE_SYNC_STATUS_DEFAULT_SOURCE_KEYS,
    });
  });
  otherSections = computed(() => (
    this.docs()?.renderedSections.filter((section) => (
      !['linked_evidence', 'source_sync_evidence', 'review_checklist'].includes(section.section_id)
    )) || []
  ));
  localSnapshot = computed<AdsApprovalEvidenceReviewerDocsLocalSnapshot | null>(() => {
    const docs = this.docs();
    return docs ? this.service.buildLocalSnapshot(docs) : null;
  });
  snapshotFilename = computed(() => {
    const snapshot = this.localSnapshot();
    const approvalPart = this.safeFilePart(snapshot?.query.approval_id || 'approval');
    return `ads-approval-evidence-reviewer-${approvalPart}.json`;
  });
  compareAuditFilename = computed(() => {
    const compare = this.compareResult();
    const approvalPart = this.safeFilePart(compare ? this.compareApprovalId(compare) : 'compare');
    return `ads-approval-evidence-reviewer-compare-${approvalPart}.json`;
  });
  changedSafetyDeltas = computed(() => (
    this.compareResult()?.safetyDeltas.filter((delta) => delta.changed) || []
  ));
  changedMetricDeltas = computed(() => (
    this.compareResult()?.metricDeltas.filter((delta) => delta.changed) || []
  ));
  changedReadbackSafetyDeltas = computed(() => (
    this.compareAuditReadback()?.safetyDeltas.filter((delta) => delta.changed) || []
  ));
  changedReadbackMetricDeltas = computed(() => (
    this.compareAuditReadback()?.metricDeltas.filter((delta) => delta.changed) || []
  ));

  constructor(
    private readonly service: AdsApprovalEvidenceReviewerService,
    @Optional() private readonly route: ActivatedRoute | null,
  ) {}

  ngOnInit(): void {
    if (!this.route) return;

    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => this.applyQueryParams(params));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    const normalizedApprovalId = this.approvalId.trim();
    if (!normalizedApprovalId) {
      this.error.set('Cần nhập Approval ID');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.lastExportName.set(null);

    this.service.getReviewerDocs(normalizedApprovalId, this.fixture).subscribe({
      next: (docs) => {
        this.docs.set(docs);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(this.errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  loadLinkedFixture(): void {
    this.approvalId = this.approvalId.trim() || this.demoApprovalId;
    this.fixture = 'linked';
    this.load();
  }

  loadEmptyFixture(): void {
    this.approvalId = this.approvalId.trim() || this.demoApprovalId;
    this.fixture = 'empty';
    this.load();
  }

  reset(): void {
    this.docs.set(null);
    this.error.set(null);
    this.fixture = '';
    this.approvalId = this.demoApprovalId;
    this.lastExportName.set(null);
    this.lastCompareExportName.set(null);
    this.lastCompareCopyStatus.set(null);
    this.leftSnapshotText = '';
    this.rightSnapshotText = '';
    this.compareAuditText = '';
    this.compareError.set(null);
    this.compareResult.set(null);
    this.compareAuditReadbackError.set(null);
    this.compareAuditReadback.set(null);
    this.lastCompareAuditReadbackFileName.set(null);
    this.clearSourceSyncHandoffMessage();
  }

  snapshotJson(): string {
    const snapshot = this.localSnapshot();
    return snapshot ? JSON.stringify(snapshot, null, 2) : '';
  }

  downloadLocalSnapshot(): void {
    const json = this.snapshotJson();
    if (!json) return;

    const filename = this.snapshotFilename();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.lastExportName.set(filename);
  }

  compareAuditJson(): string {
    const compare = this.compareResult();
    return compare
      ? JSON.stringify(this.service.buildLocalSnapshotCompareAuditExport(compare), null, 2)
      : '';
  }

  downloadCompareAuditJson(): void {
    const json = this.compareAuditJson();
    if (!json) {
      this.compareError.set('Hãy chạy so sánh cục bộ trước khi export JSON audit so sánh');
      this.lastCompareExportName.set(null);
      return;
    }

    const filename = this.compareAuditFilename();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.compareError.set(null);
    this.lastCompareExportName.set(filename);
    this.lastCompareCopyStatus.set(null);
  }

  copyCompareAuditJson(): void {
    const json = this.compareAuditJson();
    if (!json) {
      this.compareError.set('Hãy chạy so sánh cục bộ trước khi copy JSON audit so sánh');
      this.lastCompareCopyStatus.set(null);
      return;
    }

    this.writeClipboardText(json)
      .then(() => {
        this.compareError.set(null);
        this.lastCompareCopyStatus.set('Đã copy JSON audit so sánh');
      })
      .catch(() => {
        this.compareError.set('Không copy được JSON audit so sánh');
        this.lastCompareCopyStatus.set(null);
      });
  }

  stageSourceSyncHandoffPrefill(): void {
    const audit = this.handoffAuditCandidate();
    if (!audit) {
      this.sourceSyncHandoffStatus.set(null);
      this.sourceSyncHandoffError.set(
        'Hãy chạy so sánh cục bộ hoặc đọc lại audit so sánh trước khi chuẩn bị bàn giao nguồn đồng bộ',
      );
      return;
    }

    const auditJson = JSON.stringify(audit, null, 2);
    const parsed = this.service.parseLocalSnapshotCompareAuditJson(auditJson);
    if (!parsed.audit) {
      this.sourceSyncHandoffStatus.set(null);
      this.sourceSyncHandoffError.set(parsed.error || 'JSON audit so sánh không hợp lệ');
      return;
    }

    const built = buildAdsApprovalSourceSyncHandoffPrefillBundle(
      parsed.audit as unknown as Record<string, unknown>,
      JSON.stringify(parsed.audit, null, 2),
    );
    if (!built.bundle) {
      this.sourceSyncHandoffStatus.set(null);
      this.sourceSyncHandoffError.set(built.error || 'Không tạo được dữ liệu bàn giao nguồn đồng bộ');
      return;
    }

    const storage = this.browserStorage();
    if (!storage) {
      this.sourceSyncHandoffStatus.set(null);
      this.sourceSyncHandoffError.set('Không dùng được bộ nhớ trình duyệt cho bàn giao nguồn đồng bộ');
      return;
    }

    try {
      storage.setItem(
        ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY,
        JSON.stringify(built.bundle),
      );
    } catch {
      this.sourceSyncHandoffStatus.set(null);
      this.sourceSyncHandoffError.set('Không lưu được bàn giao nguồn đồng bộ vào bộ nhớ trình duyệt');
      return;
    }

    this.sourceSyncHandoffError.set(null);
    this.sourceSyncHandoffStatus.set(
      `Đã chuẩn bị bàn giao nguồn đồng bộ từ ${parsed.audit.generatedAt}`,
    );
  }

  useCurrentSnapshot(side: 'left' | 'right'): void {
    const json = this.snapshotJson();
    if (!json) return;

    if (side === 'left') {
      this.leftSnapshotText = json;
    } else {
      this.rightSnapshotText = json;
    }

    this.compareError.set(null);
    this.compareResult.set(null);
    this.lastCompareExportName.set(null);
    this.lastCompareCopyStatus.set(null);
    this.clearSourceSyncHandoffMessage();
  }

  loadSnapshotFile(event: Event, side: 'left' | 'right'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      if (side === 'left') {
        this.leftSnapshotText = text;
      } else {
        this.rightSnapshotText = text;
      }
      this.validateLoadedSnapshotFile(text, side);
      this.lastCompareExportName.set(null);
      this.lastCompareCopyStatus.set(null);
      this.clearSourceSyncHandoffMessage();
      input.value = '';
    };
    reader.onerror = () => {
      this.compareError.set(`Không tải được file ${this.snapshotSideLabel(side)}`);
      this.compareResult.set(null);
      this.lastCompareExportName.set(null);
      this.lastCompareCopyStatus.set(null);
      this.clearSourceSyncHandoffMessage();
      input.value = '';
    };
    reader.readAsText(file);
  }

  compareSnapshots(): void {
    const left = this.service.parseLocalSnapshotJson(this.leftSnapshotText);
    if (!left.snapshot) {
      this.compareError.set(`Snapshot A: ${left.error || 'snapshot không hợp lệ'}`);
      this.compareResult.set(null);
      this.lastCompareExportName.set(null);
      this.lastCompareCopyStatus.set(null);
      this.clearSourceSyncHandoffMessage();
      return;
    }

    const right = this.service.parseLocalSnapshotJson(this.rightSnapshotText);
    if (!right.snapshot) {
      this.compareError.set(`Snapshot B: ${right.error || 'snapshot không hợp lệ'}`);
      this.compareResult.set(null);
      this.lastCompareExportName.set(null);
      this.lastCompareCopyStatus.set(null);
      this.clearSourceSyncHandoffMessage();
      return;
    }

    this.compareError.set(null);
    this.compareResult.set(this.service.compareLocalSnapshots(left.snapshot, right.snapshot));
    this.lastCompareExportName.set(null);
    this.lastCompareCopyStatus.set(null);
    this.clearSourceSyncHandoffMessage();
  }

  useCurrentCompareAuditForReadback(): void {
    const json = this.compareAuditJson();
    if (!json) {
      this.compareAuditReadbackError.set('Hãy chạy so sánh cục bộ trước khi đọc lại JSON audit so sánh');
      this.compareAuditReadback.set(null);
      this.lastCompareAuditReadbackFileName.set(null);
      return;
    }

    this.compareAuditText = json;
    this.readCompareAuditJson();
  }

  readCompareAuditJson(): void {
    const parsed = this.service.parseLocalSnapshotCompareAuditJson(this.compareAuditText);
    if (!parsed.audit) {
      this.compareAuditReadbackError.set(parsed.error || 'JSON audit so sánh không hợp lệ');
      this.compareAuditReadback.set(null);
      this.lastCompareAuditReadbackFileName.set(null);
      return;
    }

    this.compareAuditReadbackError.set(null);
    this.compareAuditReadback.set(parsed.audit);
  }

  loadCompareAuditFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.compareAuditText = typeof reader.result === 'string' ? reader.result : '';
      this.lastCompareAuditReadbackFileName.set(file.name);
      this.readCompareAuditJson();
      input.value = '';
    };
    reader.onerror = () => {
      this.compareAuditReadbackError.set('Không tải được file audit so sánh');
      this.compareAuditReadback.set(null);
      this.lastCompareAuditReadbackFileName.set(null);
      input.value = '';
    };
    reader.readAsText(file);
  }

  clearCompareAuditReadback(): void {
    this.compareAuditText = '';
    this.compareAuditReadbackError.set(null);
    this.compareAuditReadback.set(null);
    this.lastCompareAuditReadbackFileName.set(null);
  }

  clearComparison(): void {
    this.leftSnapshotText = '';
    this.rightSnapshotText = '';
    this.compareAuditText = '';
    this.compareError.set(null);
    this.compareResult.set(null);
    this.compareAuditReadbackError.set(null);
    this.compareAuditReadback.set(null);
    this.lastCompareExportName.set(null);
    this.lastCompareCopyStatus.set(null);
    this.lastCompareAuditReadbackFileName.set(null);
    this.clearSourceSyncHandoffMessage();
  }

  routePath(example: AdsApprovalEvidenceReviewerDocsRouteExample): string {
    return example.query ? `${example.path}?${example.query}` : example.path;
  }

  statusClass(value: string): string {
    return value.replace(/_/g, '-');
  }

  trackByLabel(_: number, item: { label: string }): string {
    return item.label;
  }

  trackByGate(_: number, item: SafetyGateRow): string {
    return item.key;
  }

  trackBySafetyDelta(_: number, item: AdsApprovalEvidenceReviewerDocsLocalSnapshotSafetyDelta): string {
    return item.key;
  }

  trackByMetricDelta(_: number, item: AdsApprovalEvidenceReviewerDocsLocalSnapshotMetricDelta): string {
    return item.key;
  }

  trackBySection(_: number, item: AdsApprovalEvidenceReviewerDocsSection): string {
    return item.section_id;
  }

  trackByRoute(_: number, item: AdsApprovalEvidenceReviewerDocsRouteExample): string {
    return item.label;
  }

  trackByValue(index: number, value: string): string {
    return `${index}:${value}`;
  }

  safetyLabel(key: AdsApprovalEvidenceReviewerDocsLocalSnapshotSafetyKey): string {
    return this.safetyGateLabels[key] || key;
  }

  deltaText(delta: number): string {
    return delta > 0 ? `+${delta}` : String(delta);
  }

  booleanDeltaText(leftValue: boolean, rightValue: boolean): string {
    return `${leftValue} -> ${rightValue}`;
  }

  sourceSyncChangedCount(delta: AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSyncDelta): number {
    return [
      delta.gateStatus.changed,
      delta.blockedSources.changed,
      delta.blockingReasons.changed,
      delta.sourceKeys.changed,
    ].filter(Boolean).length;
  }

  sourceSyncListDeltaText(
    delta: AdsApprovalEvidenceReviewerDocsLocalSnapshotSourceSyncListDelta,
  ): string {
    return `+${delta.added.length} / -${delta.removed.length}`;
  }

  nullableBooleanText(value: boolean | null | undefined): string {
    return typeof value === 'boolean' ? this.booleanText(value) : 'n/a';
  }

  private validateLoadedSnapshotFile(value: string, side: 'left' | 'right'): void {
    const parsed = this.service.parseLocalSnapshotJson(value);

    this.compareResult.set(null);
    if (!parsed.snapshot) {
      this.compareError.set(`${this.snapshotSideLabel(side)}: ${parsed.error || 'snapshot không hợp lệ'}`);
      return;
    }

    this.compareError.set(null);
  }

  private snapshotSideLabel(side: 'left' | 'right'): string {
    return side === 'left' ? 'Snapshot A' : 'Snapshot B';
  }

  private sectionById(sectionId: string): AdsApprovalEvidenceReviewerDocsSection | null {
    return this.docs()?.renderedSections.find((section) => section.section_id === sectionId) || null;
  }

  private applyQueryParams(params: ParamMap): void {
    const approvalId = this.text(params.get('approval_id')) || this.text(params.get('approvalId'));
    if (approvalId) {
      this.approvalId = approvalId;
    }

    this.fixture = this.fixtureFromQuery(params.get('fixture'));
  }

  private fixtureFromQuery(value: string | null): AdsApprovalEvidenceFixtureOption | '' {
    const normalized = this.text(value);
    return this.isFixtureOption(normalized) ? normalized : '';
  }

  private sourceSyncGateStatus(
    status: AdsApprovalEvidenceSourceSyncGateStatus | undefined,
  ): AdsApprovalEvidenceSourceSyncGateStatus {
    return status || 'not_available';
  }

  private sourceSyncGateTone(
    status: AdsApprovalEvidenceSourceSyncGateStatus | undefined,
  ): SummaryCard['tone'] {
    const normalized = this.sourceSyncGateStatus(status);
    if (normalized === 'ready') return 'good';
    if (normalized === 'blocked') return 'warn';
    return 'neutral';
  }

  private isFixtureOption(value: string): value is AdsApprovalEvidenceFixtureOption {
    return ['linked', 'linked_budget_update_evidence', 'empty', 'empty_approval_evidence'].includes(value);
  }

  booleanText(value: boolean): string {
    return value ? 'Có' : 'Không';
  }

  statusText(value?: unknown): string {
    const raw = this.text(value);
    if (!raw) return '';

    const labels: Record<string, string> = {
      ready_for_review: 'Sẵn sàng rà soát',
      not_available: 'Chưa có',
      empty: 'Trống',
      ready: 'Sẵn sàng',
      blocked: 'Bị chặn',
      passed: 'Đạt',
      failed: 'Không đạt',
      local_payload: 'Payload cục bộ',
      local_demo_fixture: 'Dữ liệu demo cục bộ',
      reviewer_docs: 'Tài liệu rà soát',
      source_readiness_review: 'Rà soát mức sẵn sàng nguồn',
      resolve_source_readiness_blockers: 'Xử lý blocker nguồn dữ liệu',
      manual_review_required: 'Cần rà soát thủ công',
      approval_required: 'Cần phê duyệt',
      read_only: 'Chỉ đọc',
      browser_local: 'Cục bộ trong trình duyệt',
      closed: 'Đóng',
      open: 'Mở',
      true: 'Có',
      false: 'Không',
      none: 'Không có',
    };

    return labels[raw] || raw.replace(/_/g, ' ');
  }

  private numberValue(value: unknown): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private text(value: unknown): string {
    return String(value ?? '').trim();
  }

  private safeFilePart(value: string): string {
    return this.text(value).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'approval';
  }

  private compareApprovalId(compare: AdsApprovalEvidenceReviewerDocsLocalSnapshotCompareResult): string {
    const rightApprovalId = compare.rightComparisonKey.split('|')[4];
    const leftApprovalId = compare.leftComparisonKey.split('|')[4];
    return rightApprovalId || leftApprovalId || 'compare';
  }

  private handoffAuditCandidate(): AdsApprovalEvidenceReviewerDocsLocalSnapshotCompareAuditExport | null {
    const compare = this.compareResult();
    if (compare) {
      return this.service.buildLocalSnapshotCompareAuditExport(compare);
    }

    return this.compareAuditReadback();
  }

  private browserStorage(): Storage | null {
    return typeof window === 'undefined' ? null : window.localStorage;
  }

  private clearSourceSyncHandoffMessage(): void {
    this.sourceSyncHandoffStatus.set(null);
    this.sourceSyncHandoffError.set(null);
  }

  private async writeClipboardText(value: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textArea = document.createElement('textarea');
    textArea.value = value;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();

    try {
      if (!document.execCommand('copy')) {
        throw new Error('Clipboard copy failed');
      }
    } finally {
      document.body.removeChild(textArea);
    }
  }

  private errorMessage(err: unknown): string {
    const candidate = err as { error?: { message?: string | string[] }; message?: string };
    const rawMessage = candidate?.error?.message || candidate?.message;

    if (Array.isArray(rawMessage)) {
      return rawMessage.join(' ');
    }

    return rawMessage || 'Cannot load approval evidence docs';
  }
}
