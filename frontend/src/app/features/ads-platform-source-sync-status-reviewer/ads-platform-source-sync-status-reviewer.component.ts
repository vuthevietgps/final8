import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, Optional, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {
  ADS_PLATFORM_SOURCE_SYNC_STATUS_DEMO_QUERY,
  AdsPlatformSourceRequiredConfigStatus,
  AdsPlatformSourceSyncApprovalEvidenceCompareHandoffResult,
  AdsPlatformSourceSyncApprovalEvidenceHandoffOverrideAuditExport,
  AdsPlatformSourceSyncApprovalEvidenceHandoffPrefillStatus,
  AdsPlatformSourceSyncApprovalEvidenceSourceCorrelation,
  AdsPlatformSourceSyncStatusItem,
  AdsPlatformSourceSyncStatusLocalSnapshot,
  AdsPlatformSourceSyncStatusLocalSnapshotCompareAuditExport,
  AdsPlatformSourceSyncStatusLocalSnapshotCompareResult,
  AdsPlatformSourceSyncStatusResponse,
  AdsPlatformSourceSyncStatusReviewerService,
  AdsPlatformSourceSyncStatusSourceKey,
} from './ads-platform-source-sync-status-reviewer.service';
import {
  ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY,
} from './ads-approval-source-sync-handoff-prefill.util';

type SafetyGateKey =
  | 'read_only'
  | 'dry_run'
  | 'local_only'
  | 'provider_api_called'
  | 'google_ads_api_called'
  | 'validateOnly_called'
  | 'live_ads_execution_used'
  | 'execution_allowed_now'
  | 'production_ready'
  | 'erp_mutation_used'
  | 'payment_mutation_used'
  | 'order_mutation_used'
  | 'inventory_mutation_used'
  | 'google_ads_production_enabled';

interface SafetyGateRow {
  key: SafetyGateKey;
  label: string;
  value: boolean;
  expected: boolean;
  pass: boolean;
}

interface SummaryCard {
  label: string;
  value: string;
  tone: 'neutral' | 'good' | 'warn';
}

interface SourceOption {
  key: AdsPlatformSourceSyncStatusSourceKey;
  label: string;
}

type CompareSnapshotSide = 'left' | 'right';

@Component({
  selector: 'app-ads-platform-source-sync-status-reviewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ads-platform-source-sync-status-reviewer.component.html',
  styleUrl: './ads-platform-source-sync-status-reviewer.component.css',
})
export class AdsPlatformSourceSyncStatusReviewerComponent implements OnInit, OnDestroy {
  readonly sourceOptions: SourceOption[] = [
    { key: 'google_ads', label: 'Google Ads' },
    { key: 'advertising_costs', label: 'Chi phí quảng cáo' },
    { key: 'product_mapping', label: 'Mapping sản phẩm' },
  ];

  reportDate = ADS_PLATFORM_SOURCE_SYNC_STATUS_DEMO_QUERY.reportDate;
  now = ADS_PLATFORM_SOURCE_SYNC_STATUS_DEMO_QUERY.now;
  googleAdsSelected = true;
  advertisingCostsSelected = true;
  productMappingSelected = true;

  status = signal<AdsPlatformSourceSyncStatusResponse | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  lastExportName = signal<string | null>(null);
  leftSnapshotText = '';
  rightSnapshotText = '';
  compareAuditText = '';
  approvalCompareAuditText = '';
  compareResult = signal<AdsPlatformSourceSyncStatusLocalSnapshotCompareResult | null>(null);
  compareAudit = signal<AdsPlatformSourceSyncStatusLocalSnapshotCompareAuditExport | null>(null);
  approvalHandoff = signal<AdsPlatformSourceSyncApprovalEvidenceCompareHandoffResult | null>(null);
  compareError = signal<string | null>(null);
  compareAuditError = signal<string | null>(null);
  approvalHandoffError = signal<string | null>(null);
  lastCompareExportName = signal<string | null>(null);
  lastApprovalHandoffFileName = signal<string | null>(null);
  browserApprovalHandoffStatus = signal<string | null>(null);
  browserApprovalHandoffError = signal<string | null>(null);
  browserApprovalHandoffPrefillDetails =
    signal<AdsPlatformSourceSyncApprovalEvidenceHandoffPrefillStatus | null>(null);
  browserApprovalHandoffManualImportRequired = signal(false);
  browserApprovalHandoffImported = signal(false);
  browserApprovalHandoffImportAudit =
    signal<AdsPlatformSourceSyncApprovalEvidenceHandoffOverrideAuditExport | null>(null);
  lastBrowserApprovalHandoffImportAuditFileName = signal<string | null>(null);
  browserApprovalHandoffImportAuditReadbackText = '';
  browserApprovalHandoffImportAuditReadback =
    signal<AdsPlatformSourceSyncApprovalEvidenceHandoffOverrideAuditExport | null>(null);
  browserApprovalHandoffImportAuditReadbackError = signal<string | null>(null);

  private readonly destroy$ = new Subject<void>();
  private readonly safetyGateSpecs: Array<{
    key: SafetyGateKey;
    label: string;
    expected: boolean;
  }> = [
    { key: 'read_only', label: 'Chỉ đọc', expected: true },
    { key: 'dry_run', label: 'Dry-run', expected: true },
    { key: 'local_only', label: 'Chỉ cục bộ', expected: true },
    { key: 'provider_api_called', label: 'Gọi API nhà cung cấp', expected: false },
    { key: 'google_ads_api_called', label: 'Google Ads API', expected: false },
    { key: 'validateOnly_called', label: 'Gọi validateOnly', expected: false },
    { key: 'live_ads_execution_used', label: 'Đã chạy ads live', expected: false },
    { key: 'execution_allowed_now', label: 'Được thực thi lúc này', expected: false },
    { key: 'production_ready', label: 'Sẵn sàng production', expected: false },
    { key: 'erp_mutation_used', label: 'Có ghi ERP', expected: false },
    { key: 'payment_mutation_used', label: 'Có ghi thanh toán', expected: false },
    { key: 'order_mutation_used', label: 'Có ghi đơn hàng', expected: false },
    { key: 'inventory_mutation_used', label: 'Có ghi tồn kho', expected: false },
    { key: 'google_ads_production_enabled', label: 'Google Ads production', expected: false },
  ];

  summaryCards = computed<SummaryCard[]>(() => {
    const status = this.status();
    if (!status) return [];

    return [
      {
        label: 'Trạng thái',
        value: this.statusText(status.summary.status),
        tone: status.summary.status === 'ready' ? 'good' : 'warn',
      },
      { label: 'Nguồn', value: String(status.summary.source_count), tone: 'neutral' },
      {
        label: 'Sẵn sàng',
        value: String(status.summary.ready_source_count),
        tone: status.summary.ready_source_count === status.summary.source_count ? 'good' : 'neutral',
      },
      {
        label: 'Bị chặn',
        value: String(status.summary.blocked_source_count),
        tone: status.summary.blocked_source_count === 0 ? 'good' : 'warn',
      },
      {
        label: 'Dùng dữ liệu Google Ads',
        value: this.booleanText(status.decisionGates.canUseGoogleAdsDataClaim),
        tone: status.decisionGates.canUseGoogleAdsDataClaim ? 'good' : 'warn',
      },
      {
        label: 'Bản nháp hành động',
        value: this.booleanText(status.decisionGates.canGenerateActionDraft),
        tone: status.decisionGates.canGenerateActionDraft ? 'good' : 'warn',
      },
      {
        label: 'Đề xuất scale ads',
        value: this.booleanText(status.decisionGates.canRecommendAdsScale),
        tone: status.decisionGates.canRecommendAdsScale ? 'good' : 'warn',
      },
      {
        label: 'Bước tiếp theo',
        value: this.statusText(status.summary.next_required_action),
        tone: status.summary.status === 'ready' ? 'neutral' : 'warn',
      },
    ];
  });

  safetyGates = computed<SafetyGateRow[]>(() => {
    const safety = this.status()?.safety;

    return this.safetyGateSpecs.map((spec) => {
      const value = safety ? safety[spec.key] : false;
      return {
        key: spec.key,
        label: spec.label,
        value,
        expected: spec.expected,
        pass: value === spec.expected,
      };
    });
  });

  sources = computed(() => this.status()?.sources || []);
  blockedSourceKeys = computed(() => this.status()?.summary.blocked_sources || []);
  localSnapshot = computed<AdsPlatformSourceSyncStatusLocalSnapshot | null>(() => {
    const status = this.status();
    return status ? this.service.buildLocalSnapshot(status) : null;
  });
  snapshotFilename = computed(() => {
    const snapshot = this.localSnapshot();
    const datePart = this.safeFilePart(snapshot?.reportDate || this.reportDate || 'status');
    return `ads-platform-source-sync-status-${datePart}.json`;
  });
  compareAuditFilename = computed(() => {
    const compare = this.compareResult();
    const datePart = this.safeFilePart(
      compare?.rightReportDate || compare?.leftReportDate || this.reportDate || 'compare',
    );
    return `ads-platform-source-sync-status-compare-${datePart}.json`;
  });
  browserApprovalHandoffImportAuditFilename = computed(() => {
    const audit = this.browserApprovalHandoffImportAudit();
    const datePart = this.safeFilePart(
      audit?.reviewerImportTimestamp || this.reportDate || 'handoff-import',
    );
    return `ads-approval-source-sync-handoff-import-audit-${datePart}.json`;
  });
  changedMetricDeltas = computed(() => (
    this.compareResult()?.metricDeltas.filter((delta) => delta.changed) || []
  ));
  changedReadinessDeltas = computed(() => (
    this.compareResult()?.readinessDeltas.filter((delta) => delta.changed) || []
  ));
  changedBlockerDeltas = computed(() => (
    this.compareResult()?.blockerDeltas.filter((delta) => delta.changed) || []
  ));
  changedDecisionGateDeltas = computed(() => (
    this.compareResult()?.decisionGateDeltas.filter((delta) => delta.changed) || []
  ));
  changedSafetyDeltas = computed(() => (
    this.compareResult()?.safetyDeltas.filter((delta) => delta.changed) || []
  ));
  auditChangedMetricDeltas = computed(() => (
    this.compareAudit()?.metricDeltas.filter((delta) => delta.changed) || []
  ));
  auditChangedReadinessDeltas = computed(() => (
    this.compareAudit()?.readinessDeltas.filter((delta) => delta.changed) || []
  ));
  auditChangedBlockerDeltas = computed(() => (
    this.compareAudit()?.blockerDeltas.filter((delta) => delta.changed) || []
  ));
  auditChangedDecisionGateDeltas = computed(() => (
    this.compareAudit()?.decisionGateDeltas.filter((delta) => delta.changed) || []
  ));
  auditChangedSafetyDeltas = computed(() => (
    this.compareAudit()?.safetyDeltas.filter((delta) => delta.changed) || []
  ));

  constructor(
    private readonly service: AdsPlatformSourceSyncStatusReviewerService,
    @Optional() private readonly route: ActivatedRoute | null,
  ) {}

  ngOnInit(): void {
    this.prefillApprovalHandoffFromBrowserStorage(true);

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
    const reportDate = this.text(this.reportDate);
    if (!reportDate) {
      this.error.set('Cần chọn ngày báo cáo');
      return;
    }

    const sourceKeys = this.selectedSourceKeys();
    if (!sourceKeys.length) {
      this.error.set('Chọn ít nhất một nguồn dữ liệu');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.lastExportName.set(null);

    this.service.loadStatus({
      reportDate,
      now: this.text(this.now) || undefined,
      sourceKeys,
    }).subscribe({
      next: (status) => {
        this.status.set(status);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(this.errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  loadDemoStatus(): void {
    this.applyDemoQuery();
    this.load();
  }

  reset(): void {
    this.status.set(null);
    this.loading.set(false);
    this.error.set(null);
    this.lastExportName.set(null);
    this.applyDemoQuery();
  }

  snapshotJson(): string {
    const snapshot = this.localSnapshot();
    return snapshot ? JSON.stringify(snapshot, null, 2) : '';
  }

  downloadLocalSnapshot(): void {
    const json = this.snapshotJson();
    if (!json) return;

    const filename = this.snapshotFilename();
    this.downloadJson(json, filename);
    this.lastExportName.set(filename);
  }

  useCurrentSnapshot(side: CompareSnapshotSide): void {
    const json = this.snapshotJson();
    if (!json) {
      this.compareError.set('Hãy tải hoặc chạy demo trạng thái nguồn trước khi dùng snapshot hiện tại');
      return;
    }

    this.setSnapshotText(side, json);
    this.compareError.set(null);
    this.compareResult.set(null);
    this.compareAudit.set(null);
    this.compareAuditError.set(null);
    this.clearApprovalHandoffState(false);
    this.lastCompareExportName.set(null);
  }

  loadSnapshotFile(event: Event, side: CompareSnapshotSide): void {
    this.readTextFile(
      event,
      (text) => {
        this.setSnapshotText(side, text);
        this.compareError.set(null);
        this.compareResult.set(null);
        this.compareAudit.set(null);
        this.compareAuditError.set(null);
        this.clearApprovalHandoffState(false);
        this.lastCompareExportName.set(null);
      },
      (message) => this.compareError.set(message),
    );
  }

  compareSnapshots(): void {
    const left = this.service.parseLocalSnapshotJson(this.leftSnapshotText);
    if (left.error || !left.snapshot) {
      this.compareError.set(`Snapshot A: ${left.error}`);
      this.compareResult.set(null);
      return;
    }

    const right = this.service.parseLocalSnapshotJson(this.rightSnapshotText);
    if (right.error || !right.snapshot) {
      this.compareError.set(`Snapshot B: ${right.error}`);
      this.compareResult.set(null);
      return;
    }

    this.compareResult.set(this.service.compareLocalSnapshots(left.snapshot, right.snapshot));
    this.compareAudit.set(null);
    this.compareError.set(null);
    this.compareAuditError.set(null);
    this.clearApprovalHandoffState(false);
    this.lastCompareExportName.set(null);
    this.correlatePrefilledApprovalHandoff();
  }

  clearCompare(): void {
    this.leftSnapshotText = '';
    this.rightSnapshotText = '';
    this.compareAuditText = '';
    this.approvalCompareAuditText = '';
    this.compareResult.set(null);
    this.compareAudit.set(null);
    this.compareError.set(null);
    this.compareAuditError.set(null);
    this.clearApprovalHandoffState();
    this.clearBrowserApprovalHandoffMessage();
    this.lastCompareExportName.set(null);
  }

  compareAuditJson(): string {
    const compare = this.compareResult();
    if (!compare) return '';
    return JSON.stringify(
      this.service.buildLocalSnapshotCompareAuditExport(compare),
      null,
      2,
    );
  }

  downloadCompareAudit(): void {
    const json = this.compareAuditJson();
    if (!json) return;

    const filename = this.compareAuditFilename();
    this.downloadJson(json, filename);
    this.compareAuditText = json;
    this.parseCompareAudit();
    this.lastCompareExportName.set(filename);
  }

  loadCompareAuditFile(event: Event): void {
    this.readTextFile(
      event,
      (text) => {
        this.compareAuditText = text;
        this.parseCompareAudit();
      },
      (message) => this.compareAuditError.set(message),
    );
  }

  parseCompareAudit(): void {
    const parsed = this.service.parseLocalSnapshotCompareAuditJson(this.compareAuditText);
    this.compareAudit.set(parsed.audit);
    this.compareAuditError.set(parsed.error);
    this.clearApprovalHandoffState(false);
    if (parsed.audit) {
      this.correlatePrefilledApprovalHandoff();
    }
  }

  loadApprovalCompareAuditFile(event: Event): void {
    this.readTextFile(
      event,
      (text, fileName) => {
        this.approvalCompareAuditText = text;
        this.lastApprovalHandoffFileName.set(fileName);
        this.clearBrowserApprovalHandoffMessage();
        this.correlateApprovalCompareAudit();
      },
      (message) => this.approvalHandoffError.set(message),
    );
  }

  importBrowserApprovalHandoff(): void {
    this.prefillApprovalHandoffFromBrowserStorage(false, true);
  }

  downloadBrowserApprovalHandoffImportAudit(): void {
    const audit = this.browserApprovalHandoffImportAudit();
    if (!audit) return;

    const filename = this.browserApprovalHandoffImportAuditFilename();
    const json = JSON.stringify(audit, null, 2);
    this.downloadJson(json, filename);
    this.browserApprovalHandoffImportAuditReadbackText = json;
    this.readBrowserApprovalHandoffImportAudit();
    this.lastBrowserApprovalHandoffImportAuditFileName.set(filename);
  }

  loadBrowserApprovalHandoffImportAuditFile(event: Event): void {
    this.readTextFile(
      event,
      (text) => {
        this.browserApprovalHandoffImportAuditReadbackText = text;
        this.readBrowserApprovalHandoffImportAudit();
      },
      (message) => this.browserApprovalHandoffImportAuditReadbackError.set(message),
    );
  }

  readBrowserApprovalHandoffImportAudit(): void {
    const parsed = this.service.parseApprovalEvidenceHandoffOverrideAuditJson(
      this.browserApprovalHandoffImportAuditReadbackText,
    );

    this.browserApprovalHandoffImportAuditReadback.set(parsed.audit);
    this.browserApprovalHandoffImportAuditReadbackError.set(parsed.error);
  }

  correlateApprovalCompareAudit(): void {
    const parsed = this.service.parseApprovalEvidenceCompareAuditJson(
      this.approvalCompareAuditText,
    );
    if (parsed.error || !parsed.audit) {
      this.approvalHandoff.set(null);
      this.approvalHandoffError.set(parsed.error);
      return;
    }

    const sourceSyncCompare = this.compareResult() || this.compareAudit();
    if (!sourceSyncCompare) {
      this.approvalHandoff.set(null);
      this.approvalHandoffError.set(
        'Hãy so sánh snapshot nguồn đồng bộ hoặc đọc lại audit so sánh nguồn đồng bộ trước',
      );
      return;
    }

    this.approvalHandoff.set(
      this.service.buildApprovalEvidenceCompareHandoff(sourceSyncCompare, parsed.audit),
    );
    this.approvalHandoffError.set(null);
  }

  clearApprovalHandoff(): void {
    this.approvalCompareAuditText = '';
    this.clearApprovalHandoffState();
    this.clearBrowserApprovalHandoffMessage();
  }

  clearBrowserApprovalHandoff(): void {
    const storage = this.browserStorage();
    if (!storage) {
      this.browserApprovalHandoffStatus.set(null);
      this.browserApprovalHandoffError.set('Không dùng được bộ nhớ trình duyệt');
      this.browserApprovalHandoffPrefillDetails.set(null);
      this.browserApprovalHandoffManualImportRequired.set(false);
      this.browserApprovalHandoffImported.set(false);
      this.clearBrowserApprovalHandoffImportAudit();
      return;
    }

    try {
      storage.removeItem(ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY);
    } catch {
      this.browserApprovalHandoffStatus.set(null);
      this.browserApprovalHandoffError.set('Không xóa được dữ liệu bàn giao trong trình duyệt');
      this.browserApprovalHandoffManualImportRequired.set(false);
      this.browserApprovalHandoffImported.set(false);
      this.clearBrowserApprovalHandoffImportAudit();
      return;
    }

    if (this.lastApprovalHandoffFileName() === 'browser-local approval handoff') {
      this.approvalCompareAuditText = '';
      this.clearApprovalHandoffState();
    }

    this.browserApprovalHandoffError.set(null);
    this.browserApprovalHandoffPrefillDetails.set(null);
    this.browserApprovalHandoffManualImportRequired.set(false);
    this.browserApprovalHandoffImported.set(false);
    this.clearBrowserApprovalHandoffImportAudit();
      this.browserApprovalHandoffStatus.set('Đã xóa dữ liệu bàn giao trong trình duyệt');
  }

  sourceSelected(key: AdsPlatformSourceSyncStatusSourceKey): boolean {
    if (key === 'google_ads') return this.googleAdsSelected;
    if (key === 'advertising_costs') return this.advertisingCostsSelected;
    return this.productMappingSelected;
  }

  setSourceSelected(key: AdsPlatformSourceSyncStatusSourceKey, selected: boolean): void {
    if (key === 'google_ads') {
      this.googleAdsSelected = selected;
      return;
    }

    if (key === 'advertising_costs') {
      this.advertisingCostsSelected = selected;
      return;
    }

    this.productMappingSelected = selected;
  }

  statusClass(value: string): string {
    return value.replace(/_/g, '-');
  }

  booleanText(value: boolean): string {
    return value ? 'Có' : 'Không';
  }

  numberText(value: number | null): string {
    return value === null ? 'không có' : String(value);
  }

  timeText(value: string | null): string {
    return value || 'không có';
  }

  sourceLabel(key: AdsPlatformSourceSyncStatusSourceKey): string {
    return this.sourceOptions.find((option) => option.key === key)?.label || key;
  }

  trackByLabel(_: number, item: { label: string }): string {
    return item.label;
  }

  trackByGate(_: number, item: SafetyGateRow): string {
    return item.key;
  }

  trackByKey(_: number, item: { key: string }): string {
    return item.key;
  }

  trackBySource(_: number, item: AdsPlatformSourceSyncStatusItem): string {
    return item.sourceKey;
  }

  trackByConfig(_: number, item: AdsPlatformSourceRequiredConfigStatus): string {
    return item.key;
  }

  trackByValue(index: number, value: string): string {
    return `${index}:${value}`;
  }

  trackByCompareSource(
    _: number,
    item: { sourceKey: AdsPlatformSourceSyncStatusSourceKey },
  ): string {
    return item.sourceKey;
  }

  trackByApprovalCorrelation(
    _: number,
    item: AdsPlatformSourceSyncApprovalEvidenceSourceCorrelation,
  ): string {
    return item.sourceKey;
  }

  deltaListText(values: string[]): string {
    return values.length ? values.join(', ') : 'không có';
  }

  statusText(value?: unknown): string {
    const raw = this.text(value);
    if (!raw) return '';

    const labels: Record<string, string> = {
      ready: 'Sẵn sàng',
      blocked: 'Bị chặn',
      stale: 'Cũ',
      fresh: 'Mới',
      missing: 'Thiếu',
      not_available: 'Chưa có',
      no_records: 'Không có bản ghi',
      no_records_for_report_date: 'Không có bản ghi cho ngày báo cáo',
      covered: 'Đã phủ dữ liệu',
      partial: 'Một phần',
      required: 'Bắt buộc',
      optional: 'Tùy chọn',
      high: 'Cao',
      medium: 'Trung bình',
      low: 'Thấp',
      resolve_source_readiness_blockers: 'Xử lý blocker nguồn dữ liệu',
      review_missing_credentials_or_mapping: 'Rà thông tin xác thực hoặc mapping còn thiếu',
      source_readiness_required: 'Cần kiểm tra nguồn dữ liệu',
      manual_import_required: 'Cần import thủ công',
      imported: 'Đã import',
      staged: 'Đã chuẩn bị',
      eligible: 'Đủ điều kiện',
      blocked_until_import: 'Chặn đến khi import',
      resolved_in_status_snapshot: 'Đã xử lý trong snapshot trạng thái',
      still_blocked: 'Vẫn bị chặn',
      unknown: 'Chưa rõ',
      true: 'Có',
      false: 'Không',
    };

    return labels[raw] || raw.replace(/_/g, ' ');
  }

  safetyGateTone(rightGateOpen: boolean): 'pass' | 'fail' {
    return rightGateOpen ? 'fail' : 'pass';
  }

  correlationSummaryTone(
    summary: AdsPlatformSourceSyncApprovalEvidenceSourceCorrelation['correlationSummary'],
  ): 'pass' | 'fail' {
    return summary === 'resolved_in_status_snapshot' ? 'pass' : 'fail';
  }

  private setSnapshotText(side: CompareSnapshotSide, text: string): void {
    if (side === 'left') {
      this.leftSnapshotText = text;
      return;
    }

    this.rightSnapshotText = text;
  }

  private downloadJson(json: string, filename: string): void {
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
  }

  private readTextFile(
    event: Event,
    onLoad: (text: string, fileName: string) => void,
    onError: (message: string) => void,
  ): void {
    const input = event.target as HTMLInputElement | null;
    const files = input?.files as (FileList & { 0?: File }) | null | undefined;
    const file = files?.[0] || files?.item?.(0);

    if (!file) {
      onError('Chọn một file JSON để tải');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      onLoad(String(reader.result ?? ''), file.name);
      if (input) input.value = '';
    };
    reader.onerror = () => {
      onError('Không đọc được file JSON đã chọn');
      if (input) input.value = '';
    };
    reader.readAsText(file);
  }

  private selectedSourceKeys(): AdsPlatformSourceSyncStatusSourceKey[] {
    const selected: AdsPlatformSourceSyncStatusSourceKey[] = [];
    if (this.googleAdsSelected) selected.push('google_ads');
    if (this.advertisingCostsSelected) selected.push('advertising_costs');
    if (this.productMappingSelected) selected.push('product_mapping');
    return selected;
  }

  private applyDemoQuery(): void {
    this.reportDate = ADS_PLATFORM_SOURCE_SYNC_STATUS_DEMO_QUERY.reportDate;
    this.now = ADS_PLATFORM_SOURCE_SYNC_STATUS_DEMO_QUERY.now;
    this.googleAdsSelected = true;
    this.advertisingCostsSelected = true;
    this.productMappingSelected = true;
  }

  private applyQueryParams(params: ParamMap): void {
    this.reportDate = this.text(params.get('reportDate'))
      || this.text(params.get('snapshotDate'))
      || this.reportDate;
    this.now = this.text(params.get('now')) || this.now;
    this.applySourceKeysParam(params.get('sourceKeys'));
  }

  private applySourceKeysParam(value: string | null): void {
    const normalized = this.text(value);
    if (!normalized) return;

    const keys = normalized.split(',').map((item) => this.text(item));
    this.googleAdsSelected = keys.includes('google_ads');
    this.advertisingCostsSelected = keys.includes('advertising_costs');
    this.productMappingSelected = keys.includes('product_mapping');
  }

  private safeFilePart(value: string): string {
    return this.text(value).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'status';
  }

  private clearApprovalHandoffState(clearFileName = true): void {
    this.approvalHandoff.set(null);
    this.approvalHandoffError.set(null);
    if (clearFileName) {
      this.lastApprovalHandoffFileName.set(null);
    }
  }

  private prefillApprovalHandoffFromBrowserStorage(
    silent: boolean,
    allowStaleImport = false,
  ): void {
    const storage = this.browserStorage();
    if (!storage) {
      if (!silent) {
        this.browserApprovalHandoffStatus.set(null);
        this.browserApprovalHandoffError.set('Không dùng được bộ nhớ trình duyệt');
      }
      this.browserApprovalHandoffPrefillDetails.set(null);
      this.browserApprovalHandoffManualImportRequired.set(false);
      this.browserApprovalHandoffImported.set(false);
      this.clearBrowserApprovalHandoffImportAudit();
      return;
    }

    let raw: string | null = null;
    try {
      raw = storage.getItem(ADS_APPROVAL_SOURCE_SYNC_HANDOFF_PREFILL_STORAGE_KEY);
    } catch {
      if (!silent) {
        this.browserApprovalHandoffStatus.set(null);
        this.browserApprovalHandoffError.set('Không đọc được dữ liệu bàn giao trong trình duyệt');
      }
      this.browserApprovalHandoffPrefillDetails.set(null);
      this.browserApprovalHandoffManualImportRequired.set(false);
      this.browserApprovalHandoffImported.set(false);
      this.clearBrowserApprovalHandoffImportAudit();
      return;
    }

    if (!raw) {
      if (!silent) {
        this.browserApprovalHandoffStatus.set(null);
        this.browserApprovalHandoffError.set('Chưa có bàn giao phê duyệt cục bộ trong trình duyệt');
      }
      this.browserApprovalHandoffPrefillDetails.set(null);
      this.browserApprovalHandoffManualImportRequired.set(false);
      this.browserApprovalHandoffImported.set(false);
      this.clearBrowserApprovalHandoffImportAudit();
      return;
    }

    const parsed = this.service.parseApprovalEvidenceHandoffPrefillJson(raw);
    if (!parsed.audit || !parsed.bundle) {
      this.browserApprovalHandoffStatus.set(null);
      this.browserApprovalHandoffError.set(parsed.error || 'Dữ liệu bàn giao trong trình duyệt không hợp lệ');
      this.browserApprovalHandoffPrefillDetails.set(null);
      this.browserApprovalHandoffManualImportRequired.set(false);
      this.browserApprovalHandoffImported.set(false);
      this.clearBrowserApprovalHandoffImportAudit();
      this.approvalHandoff.set(null);
      return;
    }

    const observedAt = new Date();
    const prefillDetails = this.service.describeApprovalEvidenceHandoffPrefill(
      parsed.bundle,
      observedAt,
    );
    this.browserApprovalHandoffError.set(null);
    this.browserApprovalHandoffPrefillDetails.set(prefillDetails);
    this.clearApprovalHandoffState(false);

    if (prefillDetails.stale && !allowStaleImport) {
      this.browserApprovalHandoffManualImportRequired.set(true);
      this.browserApprovalHandoffImported.set(false);
      this.clearBrowserApprovalHandoffImportAudit();
      this.browserApprovalHandoffStatus.set(
        `Bàn giao trong trình duyệt đã cũ, được chuẩn bị từ ${parsed.bundle.approvalCompareAuditGeneratedAt}`,
      );
      return;
    }

    this.approvalCompareAuditText = JSON.stringify(parsed.audit, null, 2);
    this.lastApprovalHandoffFileName.set('browser-local approval handoff');
    this.browserApprovalHandoffManualImportRequired.set(false);
    this.browserApprovalHandoffImported.set(true);
    if (prefillDetails.stale && allowStaleImport) {
      this.browserApprovalHandoffImportAudit.set(
        this.service.buildApprovalEvidenceHandoffOverrideAuditExport(
          parsed.bundle,
          prefillDetails,
          observedAt.toISOString(),
        ),
      );
      this.lastBrowserApprovalHandoffImportAuditFileName.set(null);
    } else {
      this.clearBrowserApprovalHandoffImportAudit();
    }
    this.browserApprovalHandoffStatus.set(
      prefillDetails.stale
        ? `Bàn giao cũ đã được import thủ công từ ${parsed.bundle.approvalCompareAuditGeneratedAt}`
        : `Đã tải bàn giao từ trình duyệt từ ${parsed.bundle.approvalCompareAuditGeneratedAt}`,
    );
    this.correlatePrefilledApprovalHandoff();
  }

  private correlatePrefilledApprovalHandoff(): void {
    if (this.browserApprovalHandoffManualImportRequired()) return;
    if (!this.text(this.approvalCompareAuditText)) return;
    if (!this.compareResult() && !this.compareAudit()) return;

    this.correlateApprovalCompareAudit();
  }

  private browserStorage(): Storage | null {
    return typeof window === 'undefined' ? null : window.localStorage;
  }

  private clearBrowserApprovalHandoffMessage(): void {
    this.browserApprovalHandoffStatus.set(null);
    this.browserApprovalHandoffError.set(null);
    this.browserApprovalHandoffPrefillDetails.set(null);
    this.browserApprovalHandoffManualImportRequired.set(false);
    this.browserApprovalHandoffImported.set(false);
    this.clearBrowserApprovalHandoffImportAudit();
  }

  private clearBrowserApprovalHandoffImportAudit(): void {
    this.browserApprovalHandoffImportAudit.set(null);
    this.lastBrowserApprovalHandoffImportAuditFileName.set(null);
    this.browserApprovalHandoffImportAuditReadbackText = '';
    this.browserApprovalHandoffImportAuditReadback.set(null);
    this.browserApprovalHandoffImportAuditReadbackError.set(null);
  }

  private text(value: unknown): string {
    return String(value ?? '').trim();
  }

  private errorMessage(err: unknown): string {
    const candidate = err as { error?: { message?: string | string[] }; message?: string };
    const rawMessage = candidate?.error?.message || candidate?.message;

    if (Array.isArray(rawMessage)) {
      return rawMessage.join(' ');
    }

    return rawMessage || 'Không tải được trạng thái nguồn đồng bộ';
  }
}
