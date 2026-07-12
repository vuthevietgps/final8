import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, Optional, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {
  ADS_FOUNDATION_REVIEWER_DOCS_DEMO_QUERY,
  AdsFoundationReviewerDocsQuery,
  AdsFoundationReviewerDocsLocalSnapshotAttentionSectionDelta,
  AdsFoundationReviewerDocsLocalSnapshotCompareResult,
  AdsFoundationReviewerDocsLocalSnapshotMetricDelta,
  AdsFoundationReviewerDocsLocalSnapshotSafetyDelta,
  AdsFoundationReviewerDocsLocalSnapshotSafetyKey,
  AdsFoundationReviewerDocsLocalSnapshot,
  AdsFoundationReviewerDocsResponse,
  AdsFoundationReviewerDocsRouteExample,
  AdsFoundationReviewerDocsSection,
  AdsFoundationReviewerDocsService,
} from './ads-foundation-reviewer-docs.service';

type SafetyGateKey =
  | 'provider_api_called'
  | 'google_ads_api_called'
  | 'validateOnly_called'
  | 'execution_allowed_now'
  | 'production_ready'
  | 'live_ads_execution_used'
  | 'erp_mutation_used'
  | 'payment_mutation_used'
  | 'order_mutation_used'
  | 'inventory_mutation_used'
  | 'campaignBudgetId_fallback_used'
  | 'full_foundation_snapshot_payload_included'
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
  selector: 'app-ads-foundation-reviewer-docs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ads-foundation-reviewer-docs.component.html',
  styleUrl: './ads-foundation-reviewer-docs.component.css',
})
export class AdsFoundationReviewerDocsComponent implements OnInit, OnDestroy {
  snapshotDate = ADS_FOUNDATION_REVIEWER_DOCS_DEMO_QUERY.snapshotDate || '';
  evidenceWindowFrom = ADS_FOUNDATION_REVIEWER_DOCS_DEMO_QUERY.evidenceWindow?.from || '';
  evidenceWindowTo = ADS_FOUNDATION_REVIEWER_DOCS_DEMO_QUERY.evidenceWindow?.to || '';
  evidenceWindowDays = String(ADS_FOUNDATION_REVIEWER_DOCS_DEMO_QUERY.evidenceWindow?.days || '');
  customerIds = ADS_FOUNDATION_REVIEWER_DOCS_DEMO_QUERY.customerIds?.join(', ') || '';
  accountIds = ADS_FOUNDATION_REVIEWER_DOCS_DEMO_QUERY.accountIds?.join(', ') || '';
  productIds = ADS_FOUNDATION_REVIEWER_DOCS_DEMO_QUERY.productIds?.join(', ') || '';
  campaignBudgetsMaxAgeHours = String(
    ADS_FOUNDATION_REVIEWER_DOCS_DEMO_QUERY.maxAgeHours?.campaign_budgets || '',
  );
  productPerformanceMaxAgeHours = String(
    ADS_FOUNDATION_REVIEWER_DOCS_DEMO_QUERY.maxAgeHours?.product_performance || '',
  );
  now = ADS_FOUNDATION_REVIEWER_DOCS_DEMO_QUERY.now || '';

  docs = signal<AdsFoundationReviewerDocsResponse | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  lastExportName = signal<string | null>(null);
  lastCompareExportName = signal<string | null>(null);
  lastCompareImportName = signal<string | null>(null);
  leftSnapshotText = '';
  rightSnapshotText = '';
  compareImportText = '';
  compareError = signal<string | null>(null);
  compareResult = signal<AdsFoundationReviewerDocsLocalSnapshotCompareResult | null>(null);

  private readonly destroy$ = new Subject<void>();
  private readonly safetyGateKeys: SafetyGateKey[] = [
    'provider_api_called',
    'google_ads_api_called',
    'validateOnly_called',
    'execution_allowed_now',
    'production_ready',
    'live_ads_execution_used',
    'erp_mutation_used',
    'payment_mutation_used',
    'order_mutation_used',
    'inventory_mutation_used',
    'campaignBudgetId_fallback_used',
    'full_foundation_snapshot_payload_included',
    'reviewer_docs_persistence_performed',
    'reviewer_export_persistence_performed',
  ];
  private readonly safetyGateLabels: Record<SafetyGateKey, string> = {
    provider_api_called: 'Gọi API nhà cung cấp',
    google_ads_api_called: 'Google Ads API',
    validateOnly_called: 'Gọi validateOnly',
    execution_allowed_now: 'Được thực thi lúc này',
    production_ready: 'Sẵn sàng production',
    live_ads_execution_used: 'Đã chạy ads live',
    erp_mutation_used: 'Có ghi ERP',
    payment_mutation_used: 'Có ghi thanh toán',
    order_mutation_used: 'Có ghi đơn hàng',
    inventory_mutation_used: 'Có ghi tồn kho',
    campaignBudgetId_fallback_used: 'Dùng fallback Budget ID',
    full_foundation_snapshot_payload_included: 'Đính kèm toàn bộ snapshot',
    reviewer_docs_persistence_performed: 'Có lưu tài liệu rà soát',
    reviewer_export_persistence_performed: 'Có lưu bản export',
  };

  summaryCards = computed<SummaryCard[]>(() => {
    const docs = this.docs();
    if (!docs) return [];

    return [
      {
        label: 'Trạng thái',
        value: this.statusText(docs.summary.docs_status),
        tone: docs.summary.docs_status === 'ready_for_review' ? 'good' : 'warn',
      },
      { label: 'Mục hiển thị', value: String(docs.summary.rendered_sections), tone: 'neutral' },
      {
        label: 'Cần chú ý',
        value: String(docs.summary.attention_sections),
        tone: docs.summary.attention_sections === 0 ? 'good' : 'warn',
      },
      {
        label: 'Bằng chứng nguồn',
        value: String(docs.summary.source_evidence_records_rendered),
        tone: docs.summary.source_evidence_records_rendered > 0 ? 'good' : 'warn',
      },
      {
        label: 'Nguồn cũ',
        value: String(docs.summary.stale_source_evidence_records),
        tone: docs.summary.stale_source_evidence_records === 0 ? 'good' : 'warn',
      },
      {
        label: 'Thiếu query',
        value: String(docs.summary.missing_query_evidence_records),
        tone: docs.summary.missing_query_evidence_records === 0 ? 'good' : 'warn',
      },
      {
        label: 'Fallback ngân sách',
        value: this.booleanText(docs.summary.campaignBudgetId_fallback_used),
        tone: docs.summary.campaignBudgetId_fallback_used ? 'warn' : 'good',
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

  attentionSections = computed(() => (
    this.docs()?.renderedSections.filter((section) => section.status === 'attention') || []
  ));
  campaignBudgetSection = computed(() => this.sectionById('campaign_budget_join'));
  sourceEvidenceSection = computed(() => this.sectionById('source_evidence'));
  queryEvidenceSection = computed(() => this.sectionById('query_evidence'));
  otherSections = computed(() => (
    this.docs()?.renderedSections.filter((section) => ![
      'campaign_budget_join',
      'source_evidence',
      'query_evidence',
    ].includes(section.section_id)) || []
  ));
  localSnapshot = computed<AdsFoundationReviewerDocsLocalSnapshot | null>(() => {
    const docs = this.docs();
    return docs ? this.service.buildLocalSnapshot(docs) : null;
  });
  snapshotFilename = computed(() => {
    const snapshot = this.localSnapshot();
    const datePart = this.safeFilePart(
      snapshot?.query.snapshotDate || snapshot?.createdFromDocsGeneratedAt || 'snapshot',
    );
    return `ads-foundation-reviewer-docs-${datePart}.json`;
  });
  compareFilename = computed(() => {
    const compare = this.compareResult();
    const datePart = this.safeFilePart(
      compare ? this.compareGeneratedAt(compare) : 'compare',
    );
    return `ads-foundation-reviewer-docs-compare-${datePart}.json`;
  });
  changedSafetyDeltas = computed(() => (
    this.compareResult()?.safetyDeltas.filter((delta) => delta.changed) || []
  ));
  changedAttentionSectionDeltas = computed(() => (
    this.compareResult()?.attentionSectionDeltas.filter((delta) => delta.changed) || []
  ));

  constructor(
    private readonly service: AdsFoundationReviewerDocsService,
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
    this.loading.set(true);
    this.error.set(null);
    this.lastExportName.set(null);

    this.service.loadReviewerDocs(this.queryFromForm()).subscribe({
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

  loadDemoPayload(): void {
    this.applyDemoPayload();
    this.load();
  }

  reset(): void {
    this.docs.set(null);
    this.error.set(null);
    this.lastExportName.set(null);
    this.lastCompareExportName.set(null);
    this.lastCompareImportName.set(null);
    this.leftSnapshotText = '';
    this.rightSnapshotText = '';
    this.compareImportText = '';
    this.compareError.set(null);
    this.compareResult.set(null);
    this.applyDemoPayload();
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

  compareResultJson(): string {
    const compare = this.compareResult();
    return compare ? JSON.stringify(compare, null, 2) : '';
  }

  downloadCompareResult(): void {
    const json = this.compareResultJson();
    if (!json) {
      this.compareError.set('Hãy chạy so sánh cục bộ trước khi export JSON so sánh');
      this.lastCompareExportName.set(null);
      return;
    }

    const filename = this.compareFilename();
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
  }

  validateCompareImport(label = 'pasted compare JSON'): void {
    const parsed = this.service.parseLocalSnapshotCompareJson(this.compareImportText);
    if (!parsed.compare) {
      this.compareError.set(`Import so sánh: ${parsed.error || 'JSON so sánh không hợp lệ'}`);
      this.compareResult.set(null);
      this.lastCompareImportName.set(null);
      this.lastCompareExportName.set(null);
      return;
    }

    this.compareError.set(null);
    this.compareResult.set(parsed.compare);
    this.lastCompareImportName.set(`Đã nhận import so sánh: ${label}`);
    this.lastCompareExportName.set(null);
  }

  loadCompareResultFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size === 0) {
      this.compareImportText = '';
      input.value = '';
      this.validateCompareImport(file.name);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.compareImportText = typeof reader.result === 'string' ? reader.result : '';
      input.value = '';
      this.validateCompareImport(file.name);
    };
    reader.onerror = () => {
      this.compareError.set('Không tải được file kết quả so sánh');
      this.compareResult.set(null);
      this.lastCompareImportName.set(null);
      this.lastCompareExportName.set(null);
      input.value = '';
    };
    reader.readAsText(file);
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
    this.lastCompareExportName.set(null);
    this.lastCompareImportName.set(null);
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
      this.lastCompareExportName.set(null);
      this.lastCompareImportName.set(null);
      this.validateLoadedSnapshotFile(text, side);
      input.value = '';
    };
    reader.onerror = () => {
      this.compareError.set(`Không tải được file ${this.snapshotSideLabel(side)}`);
      this.compareResult.set(null);
      this.lastCompareExportName.set(null);
      this.lastCompareImportName.set(null);
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
      this.lastCompareImportName.set(null);
      return;
    }

    const right = this.service.parseLocalSnapshotJson(this.rightSnapshotText);
    if (!right.snapshot) {
      this.compareError.set(`Snapshot B: ${right.error || 'snapshot không hợp lệ'}`);
      this.compareResult.set(null);
      this.lastCompareExportName.set(null);
      this.lastCompareImportName.set(null);
      return;
    }

    this.compareError.set(null);
    this.compareResult.set(this.service.compareLocalSnapshots(left.snapshot, right.snapshot));
    this.lastCompareExportName.set(null);
    this.lastCompareImportName.set(null);
  }

  clearComparison(): void {
    this.leftSnapshotText = '';
    this.rightSnapshotText = '';
    this.compareImportText = '';
    this.compareError.set(null);
    this.compareResult.set(null);
    this.lastCompareExportName.set(null);
    this.lastCompareImportName.set(null);
  }

  routePath(example: AdsFoundationReviewerDocsRouteExample): string {
    return example.path;
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

  trackBySafetyDelta(_: number, item: AdsFoundationReviewerDocsLocalSnapshotSafetyDelta): string {
    return item.key;
  }

  trackByMetricDelta(_: number, item: AdsFoundationReviewerDocsLocalSnapshotMetricDelta): string {
    return item.key;
  }

  trackByAttentionDelta(
    _: number,
    item: AdsFoundationReviewerDocsLocalSnapshotAttentionSectionDelta,
  ): string {
    return item.section_id;
  }

  trackBySection(_: number, item: AdsFoundationReviewerDocsSection): string {
    return item.section_id;
  }

  trackByRoute(_: number, item: AdsFoundationReviewerDocsRouteExample): string {
    return item.label;
  }

  trackByValue(index: number, value: string): string {
    return `${index}:${value}`;
  }

  safetyLabel(key: AdsFoundationReviewerDocsLocalSnapshotSafetyKey): string {
    return this.safetyGateLabels[key];
  }

  deltaText(delta: number): string {
    return delta > 0 ? `+${delta}` : String(delta);
  }

  booleanDeltaText(leftValue: boolean, rightValue: boolean): string {
    return `${leftValue} -> ${rightValue}`;
  }

  private queryFromForm(): AdsFoundationReviewerDocsQuery {
    const evidenceWindow: NonNullable<AdsFoundationReviewerDocsQuery['evidenceWindow']> = {};
    const maxAgeHours: NonNullable<AdsFoundationReviewerDocsQuery['maxAgeHours']> = {};
    const query: AdsFoundationReviewerDocsQuery = {};
    const evidenceDays = this.positiveNumber(this.evidenceWindowDays);
    const campaignBudgetHours = this.positiveNumber(this.campaignBudgetsMaxAgeHours);
    const productPerformanceHours = this.positiveNumber(this.productPerformanceMaxAgeHours);

    if (this.text(this.snapshotDate)) query.snapshotDate = this.text(this.snapshotDate);
    if (this.text(this.evidenceWindowFrom)) evidenceWindow.from = this.text(this.evidenceWindowFrom);
    if (this.text(this.evidenceWindowTo)) evidenceWindow.to = this.text(this.evidenceWindowTo);
    if (evidenceDays !== undefined) evidenceWindow.days = evidenceDays;
    if (Object.keys(evidenceWindow).length) query.evidenceWindow = evidenceWindow;

    const customerIds = this.csv(this.customerIds);
    const accountIds = this.csv(this.accountIds);
    const productIds = this.csv(this.productIds);
    if (customerIds.length) query.customerIds = customerIds;
    if (accountIds.length) query.accountIds = accountIds;
    if (productIds.length) query.productIds = productIds;

    if (campaignBudgetHours !== undefined) maxAgeHours.campaign_budgets = campaignBudgetHours;
    if (productPerformanceHours !== undefined) maxAgeHours.product_performance = productPerformanceHours;
    if (Object.keys(maxAgeHours).length) query.maxAgeHours = maxAgeHours;

    if (this.text(this.now)) query.now = this.text(this.now);

    return query;
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

  private sectionById(sectionId: string): AdsFoundationReviewerDocsSection | null {
    return this.docs()?.renderedSections.find((section) => section.section_id === sectionId) || null;
  }

  private applyDemoPayload(): void {
    const demo = ADS_FOUNDATION_REVIEWER_DOCS_DEMO_QUERY;
    this.snapshotDate = demo.snapshotDate || '';
    this.evidenceWindowFrom = demo.evidenceWindow?.from || '';
    this.evidenceWindowTo = demo.evidenceWindow?.to || '';
    this.evidenceWindowDays = String(demo.evidenceWindow?.days || '');
    this.customerIds = demo.customerIds?.join(', ') || '';
    this.accountIds = demo.accountIds?.join(', ') || '';
    this.productIds = demo.productIds?.join(', ') || '';
    this.campaignBudgetsMaxAgeHours = String(demo.maxAgeHours?.campaign_budgets || '');
    this.productPerformanceMaxAgeHours = String(demo.maxAgeHours?.product_performance || '');
    this.now = demo.now || '';
  }

  private applyQueryParams(params: ParamMap): void {
    this.snapshotDate = this.text(params.get('snapshotDate')) || this.snapshotDate;
    this.evidenceWindowFrom = this.text(params.get('from')) || this.evidenceWindowFrom;
    this.evidenceWindowTo = this.text(params.get('to')) || this.evidenceWindowTo;
    this.evidenceWindowDays = this.text(params.get('days')) || this.evidenceWindowDays;
    this.customerIds = this.text(params.get('customerIds')) || this.customerIds;
    this.accountIds = this.text(params.get('accountIds')) || this.accountIds;
    this.productIds = this.text(params.get('productIds')) || this.productIds;
    this.now = this.text(params.get('now')) || this.now;
  }

  private csv(value: string): string[] {
    return value.split(',').map((item) => this.text(item)).filter(Boolean);
  }

  private positiveNumber(value: string): number | undefined {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined;
  }

  booleanText(value: boolean): string {
    return value ? 'Có' : 'Không';
  }

  statusText(value?: unknown): string {
    const raw = this.text(value);
    if (!raw) return '';

    const labels: Record<string, string> = {
      ready_for_review: 'Sẵn sàng rà soát',
      attention: 'Cần chú ý',
      ready: 'Sẵn sàng',
      blocked: 'Bị chặn',
      empty: 'Trống',
      none: 'Không có',
      local_payload: 'Payload cục bộ',
      local_demo_fixture: 'Dữ liệu demo cục bộ',
      reviewer_docs: 'Tài liệu rà soát',
      resolve_source_readiness_blockers: 'Xử lý blocker nguồn dữ liệu',
      manual_review_required: 'Cần rà soát thủ công',
      read_only: 'Chỉ đọc',
      true: 'Có',
      false: 'Không',
    };

    return labels[raw] || raw.replace(/_/g, ' ');
  }

  private text(value: unknown): string {
    return String(value ?? '').trim();
  }

  private safeFilePart(value: string): string {
    return this.text(value).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'snapshot';
  }

  private compareGeneratedAt(compare: AdsFoundationReviewerDocsLocalSnapshotCompareResult): string {
    const [, , rightGeneratedAt] = compare.rightComparisonKey.split('|');
    const [, , leftGeneratedAt] = compare.leftComparisonKey.split('|');
    return rightGeneratedAt || leftGeneratedAt || 'compare';
  }

  private errorMessage(err: unknown): string {
    const candidate = err as { error?: { message?: string | string[] }; message?: string };
    const rawMessage = candidate?.error?.message || candidate?.message;

    if (Array.isArray(rawMessage)) {
      return rawMessage.join(' ');
    }

    return rawMessage || 'Không tải được tài liệu nền rà soát Ads';
  }
}
