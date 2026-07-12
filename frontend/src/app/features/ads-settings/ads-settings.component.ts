import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';

interface AdsSettings {
  facebook: { configured: boolean; tokenCount: number };
  google: {
    configured: boolean;
    clientId?: string;
    hasRefreshToken: boolean;
    developerToken?: string;
    loginCustomerId?: string;
    apiVersion?: string;
    configSource?: string;
    refreshTokenSource?: string;
  };
  tiktok: {
    configured: boolean;
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    configSource?: string;
    appId?: string;
    businessCenterId?: string;
    businessCenterName?: string;
    testAdvertiserId?: string;
    advertiserIds?: string[];
    grantedAdvertiserIds?: string[];
    scopes?: string[];
    accessTokenExpiresAt?: string;
    refreshTokenExpiresAt?: string;
    lastAuthAt?: string;
  };
}

type ActiveTab =
  | 'overview'
  | 'managerAccounts'
  | 'credentials'
  | 'childAccounts'
  | 'importSchedule'
  | 'mappingHealth'
  | 'executionGates'
  | 'audit'
  | 'googleSettings'
  | 'googleGuide'
  | 'tiktokSettings';

type ProviderKey = 'google' | 'meta' | 'tiktok';
type ReadinessState =
  | 'ready_for_import'
  | 'needs_mapping'
  | 'not_configured'
  | 'blocked'
  | 'monitor_only';

interface ManagerAccountReadiness {
  id: string;
  provider: ProviderKey;
  providerLabel: string;
  managerType: string;
  managerName: string;
  managerId: string;
  credentialSource: string;
  secretReference: string;
  credentialSummary: string;
  childAccountCount: number;
  readiness: ReadinessState;
  importScope: string;
  executionScope: string;
  blockers: string[];
}

interface AdsManagerRegistryManager {
  id: string;
  name: string;
  provider: 'google' | 'facebook' | 'tiktok';
  managerAccountType: 'google_ads_mcc' | 'meta_business_manager' | 'tiktok_business_center';
  managerAccountId: string;
  managerAccountName?: string;
  vaultProvider: string;
  secretReferenceHandle: string;
  credentialStatus: string;
  missingScopes: string[];
  childAccountIds: string[];
  discoveredChildAccountCount: number;
  readinessStatus: Exclude<ReadinessState, 'monitor_only'>;
  blockers: string[];
  warnings: string[];
  capabilities: {
    canImportReadOnly: boolean;
    canUseForFutureValidateOnly: boolean;
    canUseForFutureExecution: boolean;
  };
}

interface AdsManagerRegistrySummary {
  schema_version: 'ads_manager_account_registry_readiness.v1';
  total: number;
  childAccountCount: number;
  managers: AdsManagerRegistryManager[];
}

interface CredentialReadiness {
  id: string;
  providerLabel: string;
  tokenType: string;
  status: ReadinessState;
  metadata: string;
  secretReference: string;
  allowedByDefault: string;
}

interface ChildAccountReadiness {
  id: string;
  providerLabel: string;
  managerId: string;
  accountName: string;
  accountId: string;
  managementMode: 'mcc' | 'bm' | 'bc';
  importState: ReadinessState;
  mappingState: ReadinessState;
  executionMode: 'read_only_import' | 'monitor_only';
  ownerSurface: string;
}

interface ImportScheduleReadiness {
  id: string;
  source: string;
  cadence: string;
  lastRun: string;
  nextRun: string;
  destination: string;
  status: ReadinessState;
  rowCount: string;
  completedAt: string;
  customerIds: string;
  runId: string;
  blockers: string[];
}

interface GoogleAdsSyncRun {
  _id?: string;
  runId: string;
  status: 'running' | 'success' | 'partial' | 'failed';
  startedAt: string;
  completedAt?: string;
  dateFrom?: string;
  dateTo?: string;
  customerIds: string[];
  counts: Record<string, number>;
  syncErrors: Array<{ customerId?: string; step?: string; message: string }>;
}

interface MappingHealthReadiness {
  id: string;
  layer: string;
  mapped: number;
  total: number;
  status: ReadinessState;
  evidence: string;
  blocker: string;
}

interface SafetyGateReadiness {
  key: string;
  label: string;
  state: ReadinessState;
  value: string;
  evidence: string;
}

interface AuditEvidence {
  id: string;
  event: string;
  result: string;
  evidence: string;
  rollback: string;
}

interface SafetyFlag {
  key: string;
  value: boolean | 'false_or_absent';
  evidence: string;
}

type AdsEvidenceSeverity = 'error' | 'warning' | 'info';

interface AdsEvidenceBlocker {
  code: string;
  severity: AdsEvidenceSeverity;
  message: string;
  source?: string;
  evidencePath?: string;
}

interface AdsEvidenceAdGroup {
  platform: string;
  adGroupId: string;
  erpAdGroupId?: string;
  name?: string;
  readinessStatus: string;
  mappingHealth: {
    status: string;
    confidence: string;
    productIds: string[];
    missingLinks: string[];
  };
  financeGate: {
    status: string;
    availableCash?: number;
    dailyCap?: number;
    monthlyCap?: number;
    lossLimit?: number;
    realizedLoss: number;
    blockers: AdsEvidenceBlocker[];
    dataFreshness: string;
  };
  adsGate: {
    executable: boolean;
    productionEnabled: boolean;
    providerExecutionEnabled: boolean;
    dryRun: boolean;
    killSwitchActive: boolean;
    providerValidateOnlyPassed: boolean;
    approved: boolean;
    idempotencyReady: boolean;
    beforeStateSnapshotReady: boolean;
    auditReady: boolean;
    blockers: AdsEvidenceBlocker[];
  };
  blockers: AdsEvidenceBlocker[];
}

interface AdsEvidenceSnapshot {
  schemaVersion: string;
  snapshotId: string;
  generatedAt: string;
  environment: string;
  productionEnabled: boolean;
  providerExecutionEnabled: boolean;
  dryRun: boolean;
  killSwitchActive: boolean;
  summary: {
    totalAdGroups: number;
    scaleReady: number;
    hold: number;
    monitorOnly: number;
    blocked: number;
    needsMapping: number;
  };
  adGroups: AdsEvidenceAdGroup[];
  globalBlockers: AdsEvidenceBlocker[];
  safety: {
    localOnly: true;
    providerApiCalled: false;
    googleAdsApiCalled: false;
    liveExecutionUsed: false;
    secretsRedacted: true;
    campaignBudgetIdNoFallback: true;
  };
}

interface PersistedAdsEvidenceSnapshot {
  _id?: string;
  dateKey: string;
  environment: string;
  schemaVersion: string;
  payload: AdsEvidenceSnapshot;
  hash: string;
  capturedAt: string;
}

interface EvidenceSummaryCard {
  title: string;
  value: string;
  detail: string;
  state: string;
}

interface EvidenceDrilldownLink {
  label: string;
  route: string;
  detail: string;
}

interface AdsSourceReadinessSafety {
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called?: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  execution_allowed_now: false;
  production_ready: false;
}

interface AdsSourceReadinessSummary {
  export_status: string;
  reportDate: string;
  required_source_count: number;
  required_source_ready_count: number;
  required_source_blocked_count: number;
  required_source_report_date_blocked_count: number;
  missing_required_source_evidence: string[];
  source_coverage_blocking_reasons: string[];
  latest_successful_sync_at: string | null;
  latest_record_date: string | null;
  platform_metric_row_count: number;
  platform_metric_ready_row_count: number;
  platform_mapped_ad_group_count: number;
  platform_unmapped_ad_group_count: number;
  platform_mapped_product_count: number;
  platform_blocked_product_count: number;
  platform_blocked_supplier_count: number;
  product_allocation_blocker_count: number;
  supplier_safety_blocker_count: number;
  cashflow_first_scale_mode: 'monitor_only' | 'pending_validation';
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  production_ready: false;
  next_required_action: string;
}

interface AdsSourceReadinessCoverage {
  sourceKey: string;
  coverageBucket: string;
  freshnessStatus: string;
  coverageStatus: string;
  lastSuccessfulSyncAt: string | null;
  latestRecordDate: string | null;
  blockingReasons: string[];
  canUseForAdsAutomationDecision: boolean;
}

interface AdsSourceReadinessBlockerReview {
  sourceBlockers: string[];
  readonlyImportBlockers: string[];
  readModelBlockers: string[];
  productAllocationBlockers: string[];
  supplierSafetyBlockers: string[];
  cashflowFirstBlockers: string[];
  globalBlockers: string[];
}

interface AdsSourceReadinessReviewExport {
  schemaVersion: 'ads_automation_source_readiness_review_export.v1';
  generatedAt: string;
  exportMode: 'local_payload' | 'local_demo_fixture' | 'erp_source_import_readiness';
  query: {
    reportDate: string;
  };
  safety: AdsSourceReadinessSafety;
  summary: AdsSourceReadinessSummary;
  sourceCoverage: AdsSourceReadinessCoverage[];
  blockerReview: AdsSourceReadinessBlockerReview;
}

interface AdsBusinessScenarioInput {
  additionalLoanVnd: number;
  annualInterestRatePercent: number;
  loanTermMonths: number;
  purchasePriceVnd: number;
  sellingPriceVnd: number;
  fulfillmentCostPerOrderVnd: number;
  expectedOrdersPerDay: number;
  returnRatePercent: number;
  dailyAdsBudgetVnd: number;
  inventoryUnits: number;
}

type AdsBusinessScenarioDecision =
  | 'can_test_scale'
  | 'monitor_only'
  | 'hold'
  | 'do_not_scale'
  | 'needs_data';

interface AdsBusinessScenarioResult {
  decision: AdsBusinessScenarioDecision;
  grossRevenueVnd: number;
  grossProfitBeforeAdsVnd: number;
  netProfitAfterAdsVnd: number;
  breakEvenDailyAdsBudgetVnd: number;
  recommendedTestAdsBudgetVnd: number;
  maxCpaVnd: number;
  dailyDebtServiceVnd: number;
  daysOfCover: number | null;
  blockers: string[];
  provider_api_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
}

interface AdsBusinessScenarioProductVariation {
  customPrice?: number;
  isActive?: boolean;
  priority?: number;
}

interface AdsBusinessScenarioProductSupplier {
  appliedPrice?: number;
  price1?: number;
  price2?: number;
  price3?: number;
  priority?: number;
  isDefault?: boolean;
}

interface AdsBusinessScenarioProduct {
  _id: string;
  name: string;
  sku?: string;
  importPrice?: number;
  shippingCost?: number;
  packagingCost?: number;
  totalCost?: number;
  assumedReturnRatePercent?: number;
  fanpageVariations?: AdsBusinessScenarioProductVariation[];
  suppliers?: AdsBusinessScenarioProductSupplier[];
}

interface AdsBusinessScenarioInventoryRow {
  productId: string;
  productName?: string;
  onHand?: number;
  avgCost?: number;
  updatedAt?: string;
}

interface AdsBusinessScenarioInventorySummary {
  data: AdsBusinessScenarioInventoryRow[];
}

@Component({
  selector: 'app-ads-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page">
      <header class="header">
        <div>
          <p class="eyebrow">AI Ads V2 / Trung tâm điều phối ERP</p>
          <h2>Trung tâm điều khiển tự động Ads</h2>
          <p>
            Theo dõi mức sẵn sàng của Google MCC, Meta Business Manager và TikTok
            Business Center. Màn hình này chỉ dùng siêu dữ liệu đã ẩn và dữ liệu kiểm tra nội bộ;
            mọi thao tác chạy thật vẫn đang bị chặn.
          </p>
        </div>
        <div class="header-actions">
          <a class="btn secondary" routerLink="/api-tokens">Token API</a>
          <a class="btn secondary" routerLink="/ad-accounts">Tài khoản quảng cáo</a>
          <a class="btn secondary" routerLink="/ad-groups">Nhóm quảng cáo</a>
          <a class="btn secondary" routerLink="/costs/advertising">Chi phí quảng cáo</a>
        </div>
      </header>

      <nav class="tabs" aria-label="Các mục của trung tâm điều khiển tự động Ads">
        <button
          *ngFor="let tab of tabs"
          type="button"
          [class.active]="activeTab() === tab.id"
          (click)="selectTab(tab.id)"
        >
          {{ tab.label }}
        </button>
      </nav>

      <div
        *ngIf="message()"
        class="message"
        [class.error]="messageType() === 'error'"
        [class.success]="messageType() === 'success'"
      >
        {{ message() }}
      </div>

      <section *ngIf="activeTab() === 'overview'" class="panel">
        <div class="section-head">
          <div>
            <h3>Tổng quan / Mức sẵn sàng</h3>
            <p class="muted">
              Kích hoạt thông tin xác thực chỉ mở luồng nhập dữ liệu dạng chỉ đọc. Thay đổi
              ngân sách, tạm dừng, validateOnly và chạy thật qua nhà cung cấp vẫn bị chặn cho
              đến khi các cổng kiểm soát ERP được thông qua.
            </p>
          </div>
          <span class="status-chip blocked">chưa cho phép chạy thật</span>
        </div>

        <div class="metric-grid">
          <article class="metric-card">
            <span>Tài khoản quản lý đã cấu hình</span>
            <strong>{{ configuredManagerCount() }} / {{ managerAccounts().length }}</strong>
            <small>Các bản ghi MCC/BM/BC hỗ trợ nhiều tài khoản quản lý.</small>
          </article>
          <article class="metric-card">
            <span>Tài khoản con được uỷ quyền</span>
            <strong>{{ childAccountTotal() }}</strong>
            <small>Hiện chỉ là mô hình đọc nội bộ; sau này thay bằng kết quả nhập từ máy chủ.</small>
          </article>
          <article class="metric-card">
            <span>Chế độ nhập hằng ngày</span>
            <strong>chỉ đọc</strong>
            <small>Tài khoản, nhóm quảng cáo và chi phí sẽ được làm mới sau khi kích hoạt xác thực.</small>
          </article>
          <article class="metric-card danger">
            <span>Thực thi chạy thật</span>
            <strong>không</strong>
            <small>Cờ chạy thật và cờ gọi API nhà cung cấp đều đang tắt.</small>
          </article>
        </div>

        <div class="manual-sync-panel" aria-label="Đồng bộ dữ liệu tổng quát">
          <div class="section-head compact-head">
            <div>
              <h3>Đồng bộ dữ liệu tổng quát</h3>
              <p class="muted">
                Làm mới trạng thái ảnh hưởng ads từ dữ liệu ERP hiện có. Luồng này chỉ đọc dữ liệu,
                không gọi API nhà cung cấp và không thực thi ads.
              </p>
            </div>
            <div class="manual-sync-actions">
              <span class="source-pill">{{ manualDataSyncLabel() }}</span>
              <button class="btn" type="button" (click)="runManualDataSync()" [disabled]="manualDataSyncing()">
                {{ manualDataSyncing() ? 'Đang đồng bộ...' : 'Đồng bộ dữ liệu' }}
              </button>
            </div>
          </div>

          <div class="evidence-error" *ngIf="manualDataSyncError()">{{ manualDataSyncError() }}</div>
          <div class="summary-grid evidence-summary">
            <div *ngFor="let item of manualDataSyncCards()">
              <span>{{ item.title }}</span>
              <strong>{{ item.value }}</strong>
              <small>{{ item.detail }}</small>
              <em class="status-chip" [ngClass]="evidenceStatusClass(item.state)">
                {{ evidenceStatusLabel(item.state) }}
              </em>
            </div>
          </div>

          <div class="evidence-columns" *ngIf="manualDataSyncResult()">
            <article>
              <strong>Nguồn dữ liệu ảnh hưởng ads</strong>
              <ul class="blocker-list compact-list">
                <li *ngFor="let source of manualDataSyncSourceCoverage()">
                  <span
                    class="status-chip"
                    [ngClass]="source.canUseForAdsAutomationDecision ? 'ready_for_import' : 'blocked'"
                  >
                    {{ source.sourceKey }}
                  </span>
                  {{ source.coverageBucket }} / {{ source.freshnessStatus }}
                  <small>{{ sourceCoverageDetail(source) }}</small>
                </li>
              </ul>
            </article>

            <article>
              <strong>Blocker sau khi đồng bộ</strong>
              <ul class="blocker-list compact-list" *ngIf="manualDataSyncBlockers().length; else noManualSyncBlockers">
                <li *ngFor="let blocker of manualDataSyncBlockers()">{{ blocker }}</li>
              </ul>
              <ng-template #noManualSyncBlockers>
                <p class="muted compact">Chưa có blocker từ kết quả đồng bộ gần nhất.</p>
              </ng-template>
            </article>
          </div>
        </div>

        <div class="scenario-panel" aria-label="Kịch bản thử phương án kinh doanh">
          <div class="section-head compact-head">
            <div>
              <h3>Kịch bản thử phương án kinh doanh</h3>
              <p class="muted">
                Thay đổi nhanh vốn vay, lãi vay, giá nhập, giá bán, tồn kho và ngân sách ads để
                nhìn tác động tài chính trước khi quyết định. Kịch bản này chỉ tính trong trình duyệt.
              </p>
            </div>
            <button class="btn secondary" type="button" (click)="resetBusinessScenario()">
              Đặt lại kịch bản
            </button>
          </div>

          <div class="scenario-source-row">
            <label>
              Sản phẩm ERP
              <select
                [ngModel]="selectedScenarioProductId()"
                (ngModelChange)="selectBusinessScenarioProduct($event)"
                [disabled]="scenarioProductLoading() && !scenarioProducts().length"
              >
                <option value="">Nhập tay / chưa chọn sản phẩm</option>
                <option *ngFor="let product of scenarioProducts()" [value]="product._id">
                  {{ scenarioProductLabel(product) }}
                </option>
              </select>
            </label>
            <button class="btn ghost" type="button" (click)="loadScenarioProducts()" [disabled]="scenarioProductLoading()">
              {{ scenarioProductLoading() ? 'Đang tải sản phẩm...' : 'Tải lại sản phẩm' }}
            </button>
          </div>
          <p class="muted compact" *ngIf="scenarioProductAppliedLabel()">{{ scenarioProductAppliedLabel() }}</p>
          <div class="evidence-error compact" *ngIf="scenarioProductError()">{{ scenarioProductError() }}</div>

          <div class="form-grid scenario-form">
            <label>
              Vốn vay thêm
              <input
                type="number"
                min="0"
                [ngModel]="businessScenario().additionalLoanVnd"
                (ngModelChange)="updateBusinessScenario('additionalLoanVnd', $event)"
              />
            </label>
            <label>
              Lãi vay / năm (%)
              <input
                type="number"
                min="0"
                step="0.1"
                [ngModel]="businessScenario().annualInterestRatePercent"
                (ngModelChange)="updateBusinessScenario('annualInterestRatePercent', $event)"
              />
            </label>
            <label>
              Kỳ hạn vay (tháng)
              <input
                type="number"
                min="1"
                [ngModel]="businessScenario().loanTermMonths"
                (ngModelChange)="updateBusinessScenario('loanTermMonths', $event)"
              />
            </label>
            <label>
              Giá nhập / đơn
              <input
                type="number"
                min="0"
                [ngModel]="businessScenario().purchasePriceVnd"
                (ngModelChange)="updateBusinessScenario('purchasePriceVnd', $event)"
              />
            </label>
            <label>
              Giá bán / đơn
              <input
                type="number"
                min="0"
                [ngModel]="businessScenario().sellingPriceVnd"
                (ngModelChange)="updateBusinessScenario('sellingPriceVnd', $event)"
              />
            </label>
            <label>
              Chi phí xử lý / đơn
              <input
                type="number"
                min="0"
                [ngModel]="businessScenario().fulfillmentCostPerOrderVnd"
                (ngModelChange)="updateBusinessScenario('fulfillmentCostPerOrderVnd', $event)"
              />
            </label>
            <label>
              Đơn dự kiến / ngày
              <input
                type="number"
                min="0"
                [ngModel]="businessScenario().expectedOrdersPerDay"
                (ngModelChange)="updateBusinessScenario('expectedOrdersPerDay', $event)"
              />
            </label>
            <label>
              Hoàn/hủy (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                [ngModel]="businessScenario().returnRatePercent"
                (ngModelChange)="updateBusinessScenario('returnRatePercent', $event)"
              />
            </label>
            <label>
              Ngân sách ads / ngày
              <input
                type="number"
                min="0"
                [ngModel]="businessScenario().dailyAdsBudgetVnd"
                (ngModelChange)="updateBusinessScenario('dailyAdsBudgetVnd', $event)"
              />
            </label>
            <label>
              Tồn kho khả dụng
              <input
                type="number"
                min="0"
                [ngModel]="businessScenario().inventoryUnits"
                (ngModelChange)="updateBusinessScenario('inventoryUnits', $event)"
              />
            </label>
          </div>

          <div class="summary-grid scenario-summary">
            <div>
              <span>Doanh thu/ngày</span>
              <strong>{{ moneyText(businessScenarioResult().grossRevenueVnd) }}</strong>
              <small>Sau khi trừ tác động hoàn/hủy.</small>
            </div>
            <div>
              <span>Lãi gộp trước ads</span>
              <strong [class.negative]="businessScenarioResult().grossProfitBeforeAdsVnd < 0">
                {{ moneyText(businessScenarioResult().grossProfitBeforeAdsVnd) }}
              </strong>
              <small>Doanh thu - giá nhập - chi phí xử lý.</small>
            </div>
            <div>
              <span>Lợi nhuận sau ads/ngày</span>
              <strong [class.negative]="businessScenarioResult().netProfitAfterAdsVnd < 0">
                {{ moneyText(businessScenarioResult().netProfitAfterAdsVnd) }}
              </strong>
              <small>Đã trừ ads và chi phí vốn vay theo ngày.</small>
            </div>
            <div>
              <span>Ngân sách ads hòa vốn/ngày</span>
              <strong>{{ moneyText(businessScenarioResult().breakEvenDailyAdsBudgetVnd) }}</strong>
              <small>Ngưỡng không nên vượt nếu muốn giữ lợi nhuận không âm.</small>
            </div>
            <div>
              <span>CPA tối đa</span>
              <strong>{{ moneyText(businessScenarioResult().maxCpaVnd) }}</strong>
              <small>Mức chi ads tối đa cho một đơn thành công.</small>
            </div>
            <div>
              <span>Khuyến nghị test ads/ngày</span>
              <strong>{{ moneyText(businessScenarioResult().recommendedTestAdsBudgetVnd) }}</strong>
              <small>Ngưỡng thử bảo thủ, chưa phải lệnh chạy thật.</small>
            </div>
            <div>
              <span>Vòng tồn kho</span>
              <strong>{{ daysOfCoverText(businessScenarioResult().daysOfCover) }}</strong>
              <small>Tồn kho / đơn dự kiến mỗi ngày.</small>
            </div>
            <div>
              <span>Trạng thái kịch bản</span>
              <strong>{{ businessScenarioDecisionLabel(businessScenarioResult().decision) }}</strong>
              <small>{{ businessScenarioResult().blockers.length ? businessScenarioResult().blockers.join(', ') : 'không có blocker chính' }}</small>
              <em class="status-chip" [ngClass]="businessScenarioDecisionClass(businessScenarioResult().decision)">
                {{ businessScenarioDecisionShortLabel(businessScenarioResult().decision) }}
              </em>
            </div>
          </div>

          <div class="note-box compact">
            Đây là sandbox để test giả định kinh doanh bằng UI. Muốn biến kịch bản thành dữ liệu thật,
            bước sau phải có route backend riêng kiểu preview-only, lưu audit và người duyệt xác nhận.
          </div>
        </div>

        <div class="evidence-panel" aria-label="Ads automation evidence snapshot">
          <div class="section-head compact-head">
            <div>
              <h3>ERP evidence snapshot</h3>
              <p class="muted">
                Read-only snapshot from GET /api/ads-automation/evidence/snapshot for mapping, cashflow,
                ads execution gates, and blockers.
              </p>
            </div>
            <span class="source-pill">{{ evidenceSnapshotLabel() }}</span>
          </div>

          <div class="evidence-error" *ngIf="evidenceError()">{{ evidenceError() }}</div>
          <div class="summary-grid evidence-summary" *ngIf="!evidenceError()">
            <div *ngFor="let item of evidenceSummaryCards()">
              <span>{{ item.title }}</span>
              <strong>{{ item.value }}</strong>
              <small>{{ item.detail }}</small>
              <em class="status-chip" [ngClass]="evidenceStatusClass(item.state)">
                {{ evidenceStatusLabel(item.state) }}
              </em>
            </div>
          </div>

          <div class="evidence-columns">
            <article>
              <strong>Top blockers</strong>
              <ul class="blocker-list compact-list" *ngIf="topEvidenceBlockers().length; else noEvidenceBlockers">
                <li *ngFor="let blocker of topEvidenceBlockers()">
                  <span class="severity" [ngClass]="blocker.severity">{{ blockerSeverityLabel(blocker.severity) }}</span>
                  {{ blocker.message }}
                  <small *ngIf="blocker.source">({{ blocker.source }})</small>
                </li>
              </ul>
              <ng-template #noEvidenceBlockers>
                <p class="muted compact">No blockers returned by the snapshot.</p>
              </ng-template>
            </article>

            <article>
              <strong>ERP drilldowns</strong>
              <div class="evidence-links">
                <a *ngFor="let link of evidenceDrilldownLinks" [routerLink]="link.route">
                  <span>{{ link.label }}</span>
                  <small>{{ link.detail }}</small>
                </a>
              </div>
            </article>
          </div>
        </div>

        <div class="flow-grid">
          <div class="flow-step" *ngFor="let step of controlPlaneFlow; let index = index">
            <span>{{ index + 1 }}</span>
            <strong>{{ step.title }}</strong>
            <p>{{ step.detail }}</p>
          </div>
        </div>

        <div class="safety-strip">
          <div *ngFor="let flag of safetyFlags">
            <span>{{ safetyFlagLabel(flag.key) }}</span>
            <strong>{{ safetyFlagValueLabel(flag.value) }}</strong>
          </div>
        </div>
      </section>

      <section *ngIf="activeTab() === 'managerAccounts'" class="panel">
        <div class="section-head">
          <div>
            <h3>Tài khoản quản lý</h3>
            <p class="muted">
              Google Ads được quản lý qua MCC, Meta qua Business Manager và TikTok qua
              Business Center. Mô hình giao diện nội bộ có hỗ trợ nhiều tài khoản quản lý.
            </p>
          </div>
          <span class="source-pill">nguồn: /ads-manager-accounts/readiness/summary</span>
        </div>

        <div class="evidence-error compact" *ngIf="managerRegistryError()">{{ managerRegistryError() }}</div>
        <p class="muted" *ngIf="managerRegistryLoading()">Đang tải registry tài khoản quản lý...</p>
        <p class="muted" *ngIf="!managerRegistryLoading() && managerRegistrySummary() && !managerAccounts().length">
          Registry chưa có tài khoản quản lý. Hãy onboarding metadata và secret reference trước khi import.
        </p>

        <div class="manager-grid">
          <article class="manager-card" *ngFor="let manager of managerAccounts()">
            <div class="card-title">
              <div>
                <span class="provider">{{ manager.providerLabel }}</span>
                <h4>{{ manager.managerName }}</h4>
              </div>
              <span class="status-chip" [ngClass]="manager.readiness">{{ readinessLabel(manager.readiness) }}</span>
            </div>
            <dl class="definition-grid">
              <div>
                <dt>Loại tài khoản quản lý</dt>
                <dd>{{ manager.managerType }}</dd>
              </div>
              <div>
                <dt>ID tài khoản quản lý</dt>
                <dd>{{ manager.managerId }}</dd>
              </div>
              <div>
                <dt>Nguồn xác thực</dt>
                <dd>{{ manager.credentialSource }}</dd>
              </div>
              <div>
                <dt>Tham chiếu secret</dt>
                <dd>{{ manager.secretReference }}</dd>
              </div>
              <div>
                <dt>Tài khoản con</dt>
                <dd>{{ manager.childAccountCount }}</dd>
              </div>
              <div>
                <dt>Phạm vi mặc định</dt>
                <dd>{{ manager.importScope }}</dd>
              </div>
            </dl>
            <div class="blocker-list" *ngIf="manager.blockers.length">
              <strong>Điểm chặn</strong>
              <ul>
                <li *ngFor="let blocker of manager.blockers">{{ blocker }}</li>
              </ul>
            </div>
            <p class="muted compact">{{ manager.executionScope }}</p>
            <button
              *ngIf="manager.provider === 'google' && canVerifyManagerAccount()"
              class="btn ghost"
              type="button"
              (click)="verifyManagerReadOnly(manager)"
              [disabled]="verifyingManagerId() === manager.id">
              {{ verifyingManagerId() === manager.id ? 'Đang xác minh chỉ đọc...' : 'Xác minh MCC chỉ đọc' }}
            </button>
          </article>
        </div>
      </section>

      <section *ngIf="activeTab() === 'credentials'" class="panel">
        <div class="section-head">
          <div>
            <h3>Thông tin xác thực / Token API</h3>
            <p class="muted">
              Tab này chỉ hiển thị siêu dữ liệu. Token dạng rõ, refresh token,
              developer token, client secret và app secret không được hiển thị tại đây.
            </p>
          </div>
          <a class="btn" routerLink="/api-tokens">Mở trang token kỹ thuật</a>
        </div>

        <div class="credential-grid">
          <article class="credential-card" *ngFor="let credential of credentials()">
            <div class="card-title">
              <div>
                <span class="provider">{{ credential.providerLabel }}</span>
                <h4>{{ credential.tokenType }}</h4>
              </div>
              <span class="status-chip" [ngClass]="credential.status">{{ readinessLabel(credential.status) }}</span>
            </div>
            <dl class="definition-grid">
              <div>
                <dt>Siêu dữ liệu đã ẩn</dt>
                <dd>{{ credential.metadata }}</dd>
              </div>
              <div>
                <dt>Tham chiếu vault</dt>
                <dd>{{ credential.secretReference }}</dd>
              </div>
              <div>
                <dt>Mở mặc định</dt>
                <dd>{{ credential.allowedByDefault }}</dd>
              </div>
            </dl>
          </article>
        </div>

        <div class="note-box">
          <strong>Tương thích ngược</strong>
          <p>
            Đường dẫn /api-tokens hiện có vẫn dùng được cho quy trình kỹ thuật. Điều hướng sản phẩm
            hiện xem quản lý thông tin xác thực là một phần của trung tâm điều khiển này.
          </p>
        </div>
      </section>

      <section *ngIf="activeTab() === 'childAccounts'" class="panel">
        <div class="section-head">
          <div>
            <h3>Tài khoản quảng cáo con</h3>
            <p class="muted">
              Các tài khoản con đã uỷ quyền nằm dưới thông tin xác thực của tài khoản quản lý.
              Giao diện hiện dùng dữ liệu mẫu nội bộ cho đến khi máy chủ nối xong luồng discovery/import.
            </p>
          </div>
          <a class="btn secondary" routerLink="/ad-accounts">Mở tài khoản quảng cáo</a>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nền tảng</th>
                <th>Tài khoản con</th>
                <th>Tài khoản quản lý</th>
                <th>Chế độ</th>
                <th>Nhập dữ liệu</th>
                <th>Ghép dữ liệu</th>
                <th>Thực thi</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let account of childAccounts()">
                <td>{{ account.providerLabel }}</td>
                <td>
                  <strong>{{ account.accountName }}</strong>
                  <div class="sub">{{ account.accountId }}</div>
                </td>
                <td>{{ account.managerId }}</td>
                <td>{{ managementModeLabel(account.managementMode) }}</td>
                <td><span class="status-chip" [ngClass]="account.importState">{{ readinessLabel(account.importState) }}</span></td>
                <td><span class="status-chip" [ngClass]="account.mappingState">{{ readinessLabel(account.mappingState) }}</span></td>
                <td>{{ executionModeLabel(account.executionMode) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section *ngIf="activeTab() === 'importSchedule'" class="panel">
        <div class="section-head">
          <div>
            <h3>Lịch nhập dữ liệu</h3>
            <p class="muted">
              Google Ads hiển thị canonical sync-run mới nhất từ ERP. Meta và TikTok chỉ hiện trạng thái
              cấu hình cho đến khi có endpoint sync-run tương ứng. Mục này không có thao tác ghi lên nhà cung cấp.
            </p>
          </div>
          <div class="header-actions">
            <span class="source-pill">GET /google-ads/sync/runs/latest · read-only</span>
            <button class="btn ghost" type="button" (click)="loadImportRunStatus()" [disabled]="importRunLoading()">
              {{ importRunLoading() ? 'Đang tải...' : 'Tải lại trạng thái' }}
            </button>
            <a class="btn secondary" routerLink="/costs/advertising">Mở chi phí quảng cáo</a>
          </div>
        </div>

        <div class="evidence-error compact" *ngIf="importRunError()">{{ importRunError() }}</div>
        <p class="muted" *ngIf="importRunLoading()">Đang đọc sync-run mới nhất từ ERP...</p>

        <div class="schedule-grid">
          <article class="schedule-card" *ngFor="let schedule of importSchedules()">
            <div class="card-title">
              <h4>{{ schedule.source }}</h4>
              <span class="status-chip" [ngClass]="schedule.status">{{ readinessLabel(schedule.status) }}</span>
            </div>
            <dl class="definition-grid">
              <div>
                <dt>Chu kỳ</dt>
                <dd>{{ schedule.cadence }}</dd>
              </div>
              <div>
                <dt>Lần chạy gần nhất</dt>
                <dd>{{ schedule.lastRun }}</dd>
              </div>
              <div>
                <dt>Lần chạy kế tiếp</dt>
                <dd>{{ schedule.nextRun }}</dd>
              </div>
              <div>
                <dt>Hoàn tất</dt>
                <dd>{{ schedule.completedAt }}</dd>
              </div>
              <div>
                <dt>Customer IDs</dt>
                <dd>{{ schedule.customerIds }}</dd>
              </div>
              <div>
                <dt>Run ID</dt>
                <dd>{{ schedule.runId }}</dd>
              </div>
              <div>
                <dt>Nơi ghi dữ liệu</dt>
                <dd>{{ schedule.destination }}</dd>
              </div>
              <div>
                <dt>Số dòng</dt>
                <dd>{{ schedule.rowCount }}</dd>
              </div>
            </dl>
            <ul class="inline-list">
              <li *ngFor="let blocker of schedule.blockers">{{ blocker }}</li>
            </ul>
          </article>
        </div>
      </section>

      <section *ngIf="activeTab() === 'mappingHealth'" class="panel">
        <div class="section-head">
          <div>
            <h3>Sức khoẻ mapping</h3>
            <p class="muted">
              Mọi đề xuất tăng ngân sách vẫn ở chế độ chỉ giám sát nếu thiếu bằng chứng về sản phẩm,
              nhà cung cấp, đơn hàng, lợi nhuận, dòng tiền, tồn kho, fulfilment, hoàn hàng, độ mới
              dữ liệu hoặc giới hạn lỗ.
            </p>
          </div>
          <a class="btn secondary" routerLink="/ad-groups">Mở nhóm quảng cáo</a>
        </div>

        <div class="mapping-grid">
          <article class="mapping-card" *ngFor="let item of mappingHealth">
            <div class="card-title">
              <h4>{{ item.layer }}</h4>
              <span class="status-chip" [ngClass]="item.status">{{ readinessLabel(item.status) }}</span>
            </div>
            <div class="progress-line">
              <span [style.width.%]="mappingPercent(item)"></span>
            </div>
            <p><strong>{{ item.mapped }} / {{ item.total }}</strong> đã mapping</p>
            <p class="muted">{{ item.evidence }}</p>
            <p class="blocker">{{ item.blocker }}</p>
          </article>
        </div>
      </section>

      <section *ngIf="activeTab() === 'executionGates'" class="panel">
        <div class="section-head">
          <div>
            <h3>Cổng duyệt & thực thi</h3>
            <p class="muted">
              Các hành động sau này cần được duyệt, có validateOnly từ nhà cung cấp, preflight
              dry-run, idempotency, kill switch, bật cờ chạy thật và vượt qua cổng tài chính.
            </p>
          </div>
          <span class="status-chip blocked">chưa sẵn sàng chạy thật</span>
        </div>

        <div class="gate-grid">
          <article class="gate-card" *ngFor="let gate of executionGates">
            <div class="card-title">
              <h4>{{ gate.label }}</h4>
              <span class="status-chip" [ngClass]="gate.state">{{ readinessLabel(gate.state) }}</span>
            </div>
            <dl class="definition-grid">
              <div>
                <dt>Cổng kiểm soát</dt>
                <dd>{{ gateKeyLabel(gate.key) }}</dd>
              </div>
              <div>
                <dt>Giá trị</dt>
                <dd>{{ gateValueLabel(gate.value) }}</dd>
              </div>
            </dl>
            <p class="muted">{{ gate.evidence }}</p>
          </article>
        </div>
      </section>

      <section *ngIf="activeTab() === 'audit'" class="panel">
        <div class="section-head">
          <div>
            <h3>Bằng chứng audit / rollback</h3>
            <p class="muted">
              Kho snapshot hằng ngày là bằng chứng ERP bất biến, đã redaction và không gọi API nhà cung cấp.
              Màn hình này chỉ đọc latest/history; việc capture không tự chạy từ trình duyệt.
            </p>
          </div>
          <div class="header-actions">
            <span class="source-pill">GET latest/history · read-only</span>
            <button class="btn ghost" type="button" (click)="loadImmutableEvidenceSnapshots()" [disabled]="immutableSnapshotsLoading()">
              {{ immutableSnapshotsLoading() ? 'Đang tải...' : 'Tải lại snapshot' }}
            </button>
          </div>
        </div>

        <div class="evidence-error compact" *ngIf="immutableSnapshotsError()">{{ immutableSnapshotsError() }}</div>
        <p class="muted" *ngIf="immutableSnapshotsLoading()">Đang đọc kho snapshot ERP bất biến...</p>

        <div class="immutable-snapshot-grid" *ngIf="immutableLatestSnapshot() as latest; else noImmutableSnapshot">
          <article class="audit-card latest-snapshot-card">
            <span>Snapshot mới nhất · {{ latest.dateKey }}</span>
            <strong>{{ latest.environment }} / {{ latest.schemaVersion }}</strong>
            <dl class="definition-grid compact-definition-grid">
              <div>
                <dt>Captured at</dt>
                <dd>{{ formatDateTime(latest.capturedAt) }}</dd>
              </div>
              <div>
                <dt>Snapshot ID</dt>
                <dd>{{ latest.payload.snapshotId || 'không có' }}</dd>
              </div>
            </dl>
            <small class="snapshot-hash">SHA-256: {{ latest.hash }}</small>
          </article>

          <div class="audit-history">
            <strong>Lịch sử gần đây</strong>
            <article class="audit-card" *ngFor="let item of immutableSnapshotHistory()">
              <span>{{ item.dateKey }} · {{ item.environment }}</span>
              <strong>{{ item.schemaVersion }}</strong>
              <p>{{ formatDateTime(item.capturedAt) }}</p>
              <small class="snapshot-hash">{{ item.hash }}</small>
            </article>
          </div>
        </div>
        <ng-template #noImmutableSnapshot>
          <p class="muted" *ngIf="!immutableSnapshotsLoading() && !immutableSnapshotsError()">
            Chưa có snapshot bất biến cho môi trường hiện tại. Scheduler ERP sẽ capture theo lịch Asia/Bangkok.
          </p>
        </ng-template>

        <div class="audit-list">
          <article class="audit-card" *ngFor="let item of auditEvidence">
            <span>{{ item.event }}</span>
            <strong>{{ item.result }}</strong>
            <p>{{ item.evidence }}</p>
            <small>{{ item.rollback }}</small>
          </article>
        </div>
      </section>

      <section *ngIf="activeTab() === 'googleSettings'" class="panel">
        <div class="section-head">
          <div>
            <h3>Thiết lập kỹ thuật Google MCC</h3>
            <p class="muted">
              Khung tương thích với endpoint cấu hình Google hiện có. Các trường secret sẽ được
              xoá khỏi form sau khi lưu hoặc kiểm thử.
            </p>
          </div>
          <button class="btn ghost" type="button" (click)="activeTab.set('googleGuide')">Mở hướng dẫn</button>
        </div>

        <div class="note-box" *ngIf="settings()?.google?.configured">
          <div class="summary-grid">
            <div><span>MCC</span><strong>{{ settings()?.google?.loginCustomerId || 'chưa đặt' }}</strong></div>
            <div><span>Phiên bản API</span><strong>{{ settings()?.google?.apiVersion || 'mặc định' }}</strong></div>
            <div><span>Nguồn cấu hình</span><strong>{{ settings()?.google?.configSource || 'không rõ' }}</strong></div>
            <div><span>Refresh token</span><strong>{{ settings()?.google?.refreshTokenSource || (settings()?.google?.hasRefreshToken ? 'đã ẩn' : 'thiếu') }}</strong></div>
          </div>
        </div>

        <div class="form-grid">
          <label><span>Developer token *</span><input autocomplete="off" type="password" [(ngModel)]="googleForm.developerToken" placeholder="ERP lưu trữ; xoá khỏi form sau thao tác" /></label>
          <label><span>Client ID *</span><input autocomplete="off" type="text" [(ngModel)]="googleForm.clientId" placeholder="Siêu dữ liệu OAuth client" /></label>
          <label><span>Client secret *</span><input autocomplete="off" type="password" [(ngModel)]="googleForm.clientSecret" placeholder="Chỉ dùng cho bước đưa vào kho secret" /></label>
          <label><span>Refresh token *</span><input autocomplete="off" type="password" [(ngModel)]="googleForm.refreshToken" placeholder="Chỉ dùng cho bước đưa vào kho secret" /></label>
          <label><span>Login customer ID</span><input autocomplete="off" type="text" [(ngModel)]="googleForm.loginCustomerId" placeholder="Customer ID của MCC" /></label>
          <label><span>Phiên bản API</span><input autocomplete="off" type="text" [(ngModel)]="googleForm.apiVersion" placeholder="v24" /></label>
          <label class="wide"><span>Test customer ID *</span><input autocomplete="off" type="text" [(ngModel)]="googleForm.testCustomerId" placeholder="Customer ID con dùng để admin kiểm thử" /></label>
        </div>

        <div class="actions">
          <button class="btn secondary" type="button" (click)="testGoogle()" [disabled]="testingGoogle()">
            {{ testingGoogle() ? 'Đang kiểm thử...' : 'Admin kiểm thử kết nối' }}
          </button>
          <button class="btn" type="button" (click)="saveGoogle()" [disabled]="savingGoogle()">
            {{ savingGoogle() ? 'Đang lưu...' : 'Lưu cấu hình Google MCC' }}
          </button>
          <button class="btn ghost" type="button" (click)="testSync('google')" [disabled]="syncing() || !settings()?.google?.configured">
            {{ syncing() ? 'Đang đồng bộ...' : 'Admin kiểm thử đồng bộ chỉ đọc' }}
          </button>
        </div>

        <div class="warning-box">
          Khung tương thích này có thể gọi endpoint xác thực/đồng bộ hiện có của máy chủ khi quản trị viên
          chủ động bấm nút. Trạng thái sẵn sàng của trung tâm điều khiển vẫn giữ không cho chạy thật.
        </div>

        <div class="result" *ngIf="googleTestResult()">
          <pre>{{ googleTestResult() | json }}</pre>
        </div>
        <div class="result" *ngIf="syncResult()">{{ syncResult() }}</div>
      </section>

      <section *ngIf="activeTab() === 'googleGuide'" class="panel guide">
        <div class="guide-grid">
          <article class="guide-card">
            <h4>1. Thông tin xác thực tài khoản quản lý</h4>
            <ol>
              <li>Liên kết các customer account con dưới MCC đã được duyệt.</li>
              <li>Chỉ lưu OAuth/developer credential qua cơ chế secret của ERP.</li>
              <li>Dùng cấu hình MCC để mở luồng nhập chỉ đọc trước.</li>
            </ol>
          </article>

          <article class="guide-card">
            <h4>2. Ghép dữ liệu trong ERP</h4>
            <ol>
              <li>Mỗi customer con trở thành một tài khoản quảng cáo với chế độ quản lý MCC.</li>
              <li>Mỗi chiến dịch/nhóm quảng cáo phải ghép với bằng chứng sản phẩm, nhà cung cấp, đơn hàng và lợi nhuận.</li>
              <li>campaignBudgetId phải đến từ dữ liệu ngân sách đã sync, không fallback bằng campaignId hoặc adGroupId.</li>
            </ol>
          </article>

          <article class="guide-card">
            <h4>3. Ranh giới thực thi</h4>
            <ol>
              <li>Luồng nhập chỉ đọc phải chạy trước mọi bản nháp hành động.</li>
              <li>Về sau bắt buộc có validateOnly từ nhà cung cấp, phê duyệt, preflight, idempotency và kill switch.</li>
              <li>Tại đây đang chặn tạo campaign live, xoá, Performance Max, Shopping, Display và YouTube.</li>
            </ol>
          </article>
        </div>
      </section>

      <section *ngIf="activeTab() === 'tiktokSettings'" class="panel">
        <div class="section-head">
          <div>
            <h3>Thiết lập kỹ thuật TikTok Business Center</h3>
            <p class="muted">
              Khung tương thích với endpoint cấu hình TikTok hiện có. Các trường secret được
              ẩn khỏi kết quả hiển thị và xoá khỏi form sau khi lưu, exchange hoặc kiểm thử.
            </p>
          </div>
        </div>

        <div class="note-box" *ngIf="settings()?.tiktok?.configured">
          <div class="summary-grid">
            <div><span>App ID</span><strong>{{ settings()?.tiktok?.appId || 'đã ẩn' }}</strong></div>
            <div><span>BC ID</span><strong>{{ settings()?.tiktok?.businessCenterId || 'chưa đặt' }}</strong></div>
            <div><span>Tên BC</span><strong>{{ settings()?.tiktok?.businessCenterName || 'chưa đặt' }}</strong></div>
            <div><span>Nguồn cấu hình</span><strong>{{ settings()?.tiktok?.configSource || 'không rõ' }}</strong></div>
            <div><span>Advertiser</span><strong>{{ settings()?.tiktok?.advertiserIds?.length || 0 }}</strong></div>
            <div><span>Refresh token</span><strong>{{ settings()?.tiktok?.hasRefreshToken ? 'đã ẩn' : 'thiếu' }}</strong></div>
            <div><span>Scope</span><strong>{{ settings()?.tiktok?.scopes?.length || 0 }}</strong></div>
            <div><span>Hết hạn access token</span><strong>{{ formatDateTime(settings()?.tiktok?.accessTokenExpiresAt) }}</strong></div>
            <div><span>Hết hạn refresh token</span><strong>{{ formatDateTime(settings()?.tiktok?.refreshTokenExpiresAt) }}</strong></div>
          </div>
        </div>

        <div class="form-grid">
          <label><span>App ID *</span><input autocomplete="off" type="text" [(ngModel)]="tiktokForm.appId" placeholder="Siêu dữ liệu của app" /></label>
          <label><span>App secret *</span><input autocomplete="off" type="password" [(ngModel)]="tiktokForm.appSecret" placeholder="Chỉ dùng cho bước đưa vào kho secret" /></label>
          <label><span>Auth code</span><input autocomplete="off" type="password" [(ngModel)]="tiktokForm.authCode" placeholder="Mã tạm của admin; xoá sau thao tác" /></label>
          <label><span>Access token</span><input autocomplete="off" type="password" [(ngModel)]="tiktokForm.accessToken" placeholder="Được ẩn sau khi lưu/exchange" /></label>
          <label><span>Refresh token</span><input autocomplete="off" type="password" [(ngModel)]="tiktokForm.refreshToken" placeholder="Chỉ dùng cho bước đưa vào kho secret" /></label>
          <label><span>Redirect URI</span><input autocomplete="off" type="text" [(ngModel)]="tiktokForm.redirectUri" placeholder="Callback URI đã cấu hình" /></label>
          <label><span>Business Center ID</span><input autocomplete="off" type="text" [(ngModel)]="tiktokForm.businessCenterId" placeholder="BC ID" /></label>
          <label><span>Tên Business Center</span><input autocomplete="off" type="text" [(ngModel)]="tiktokForm.businessCenterName" placeholder="Tên hiển thị của BC" /></label>
          <label><span>Test advertiser ID *</span><input autocomplete="off" type="text" [(ngModel)]="tiktokForm.testAdvertiserId" placeholder="Advertiser ID con dùng để admin kiểm thử" /></label>
          <label class="wide"><span>Advertiser ID</span><input autocomplete="off" type="text" [(ngModel)]="tiktokForm.advertiserIdsText" placeholder="Các advertiser ID con, phân tách bằng dấu phẩy" /></label>
          <label class="wide"><span>Advertiser ID đã uỷ quyền</span><input autocomplete="off" type="text" [(ngModel)]="tiktokForm.grantedAdvertiserIdsText" placeholder="ERP điền sau khi exchange/kiểm thử" /></label>
          <label class="wide"><span>Scope</span><input autocomplete="off" type="text" [(ngModel)]="tiktokForm.scopesText" placeholder="Siêu dữ liệu scope đọc/nhập dữ liệu" /></label>
          <label><span>Thời điểm hết hạn access token</span><input autocomplete="off" type="text" [(ngModel)]="tiktokForm.accessTokenExpiresAt" placeholder="Timestamp ISO dạng siêu dữ liệu" /></label>
          <label><span>Thời điểm hết hạn refresh token</span><input autocomplete="off" type="text" [(ngModel)]="tiktokForm.refreshTokenExpiresAt" placeholder="Timestamp ISO dạng siêu dữ liệu" /></label>
        </div>

        <div class="actions">
          <button class="btn secondary" type="button" (click)="exchangeTikTokAuthCode()" [disabled]="exchangingTikTok()">
            {{ exchangingTikTok() ? 'Đang đổi mã...' : 'Đổi auth code lấy token' }}
          </button>
          <button class="btn secondary" type="button" (click)="testTikTok()" [disabled]="testingTikTok()">
            {{ testingTikTok() ? 'Đang kiểm thử...' : 'Admin kiểm thử kết nối' }}
          </button>
          <button class="btn" type="button" (click)="saveTikTok()" [disabled]="savingTikTok()">
            {{ savingTikTok() ? 'Đang lưu...' : 'Lưu cấu hình TikTok BC' }}
          </button>
          <button class="btn ghost" type="button" (click)="testSync('tiktok')" [disabled]="syncing() || !settings()?.tiktok?.configured">
            {{ syncing() ? 'Đang đồng bộ...' : 'Admin kiểm thử đồng bộ chỉ đọc' }}
          </button>
        </div>

        <div class="warning-box">
          Khung này giữ nguyên hành vi thiết lập TikTok hiện có. Kích hoạt chỉ có nghĩa là sẵn sàng
          nhập dữ liệu chỉ đọc; chạy thật vẫn bị tắt.
        </div>

        <div class="result" *ngIf="tiktokTestResult()">
          <pre>{{ tiktokTestResult() | json }}</pre>
        </div>
        <div class="result" *ngIf="syncResult()">{{ syncResult() }}</div>
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; background: #f4f7fb; min-height: 100vh; }
    .page { max-width: 1280px; margin: 0 auto; padding: 20px; color: #162033; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 16px; }
    .header h2, .panel h3, .manager-card h4, .credential-card h4, .schedule-card h4, .mapping-card h4, .gate-card h4 { margin: 0; }
    .header h2 { font-size: 28px; line-height: 1.15; }
    .header p, .muted { margin: 6px 0 0; color: #526173; line-height: 1.55; }
    .eyebrow { margin: 0 0 6px; color: #0f766e; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .header-actions, .actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .tabs { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 16px; border-bottom: 1px solid #d9e2ef; padding-bottom: 12px; }
    .tabs button { border: 1px solid #ccd7e5; background: #ffffff; padding: 9px 12px; border-radius: 8px; cursor: pointer; font-weight: 700; color: #26364a; }
    .tabs button.active { background: #0f766e; border-color: #0f766e; color: #ffffff; }
    .panel, .metric-card, .manager-card, .credential-card, .schedule-card, .mapping-card, .gate-card, .audit-card, .note-box, .warning-box, .guide-card { background: #ffffff; border: 1px solid #d9e2ef; border-radius: 8px; }
    .panel { padding: 18px; }
    .manual-sync-panel { border: 1px solid #cfe4df; background: #fbfffd; border-radius: 8px; padding: 14px; margin: 16px 0; }
    .manual-sync-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
    .scenario-panel { border: 1px solid #d8d5eb; background: #fdfcff; border-radius: 8px; padding: 14px; margin: 16px 0; }
    .scenario-source-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: end; margin-bottom: 10px; }
    .scenario-source-row label { display: flex; flex-direction: column; gap: 6px; color: #162033; font-weight: 700; }
    .scenario-form { margin: 0 0 12px; }
    .scenario-summary strong.negative { color: #991b1b; }
    .evidence-panel { border-top: 1px solid #d9e2ef; border-bottom: 1px solid #d9e2ef; padding: 14px 0; margin: 16px 0; }
    .compact-head { margin-bottom: 12px; }
    .evidence-summary { margin: 0 0 12px; }
    .evidence-summary div small { color: #526173; line-height: 1.45; }
    .evidence-summary em { align-self: flex-start; font-style: normal; margin-top: 2px; }
    .evidence-columns { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(240px, .8fr); gap: 12px; }
    .evidence-columns article { background: #fbfdff; border: 1px solid #e4ebf3; border-radius: 8px; padding: 12px; }
    .compact-list { margin: 8px 0 0; padding-left: 18px; border-top: 0; }
    .compact-list li { margin-bottom: 8px; color: #445366; line-height: 1.45; }
    .severity { display: inline-flex; border-radius: 999px; padding: 2px 6px; margin-right: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; }
    .severity.error { background: #fdecec; color: #991b1b; }
    .severity.warning { background: #fff8df; color: #8a5b00; }
    .severity.info { background: #e8f1ff; color: #1d4ed8; }
    .evidence-links { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin-top: 8px; }
    .evidence-links a { border: 1px solid #d9e2ef; border-radius: 8px; padding: 10px; color: #162033; text-decoration: none; background: #ffffff; }
    .evidence-links span { display: block; font-weight: 800; }
    .evidence-links small { display: block; margin-top: 4px; color: #526173; line-height: 1.35; }
    .evidence-error { background: #fff8ed; border: 1px solid #f6c684; border-radius: 8px; color: #7c4a03; padding: 10px 12px; }
    .section-head, .card-title { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; }
    .section-head { margin-bottom: 16px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; border: 1px solid #0f766e; background: #0f766e; color: #ffffff; padding: 9px 12px; border-radius: 8px; cursor: pointer; font-weight: 700; text-decoration: none; white-space: nowrap; }
    .btn.secondary { background: #ffffff; color: #26364a; border-color: #b9c7d7; }
    .btn.ghost { background: #edf5f4; color: #115e59; border-color: #b9d8d4; }
    .btn:disabled { opacity: .6; cursor: not-allowed; }
    .metric-grid, .manager-grid, .credential-grid, .schedule-grid, .mapping-grid, .gate-grid, .guide-grid { display: grid; gap: 12px; }
    .metric-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-bottom: 14px; }
    .manager-grid, .credential-grid, .schedule-grid, .mapping-grid, .gate-grid, .guide-grid { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
    .metric-card, .manager-card, .credential-card, .schedule-card, .mapping-card, .gate-card, .audit-card, .guide-card { padding: 14px; }
    .metric-card span, .provider, .summary-grid span, .definition-grid dt, .safety-strip span { color: #66788d; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .metric-card strong { display: block; margin-top: 6px; font-size: 24px; }
    .metric-card small { display: block; margin-top: 6px; color: #526173; line-height: 1.45; }
    .metric-card.danger { border-color: #f4b4b4; background: #fff7f7; }
    .flow-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin: 12px 0; }
    .flow-step { border: 1px solid #d9e2ef; border-radius: 8px; padding: 12px; background: #fbfdff; }
    .flow-step span { display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; border-radius: 999px; background: #dff3f0; color: #115e59; font-weight: 800; }
    .flow-step strong { display: block; margin-top: 8px; }
    .flow-step p { margin: 6px 0 0; color: #526173; line-height: 1.45; }
    .safety-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; margin-top: 12px; }
    .safety-strip div { background: #162033; color: #e8eef7; border-radius: 8px; padding: 10px; }
    .safety-strip strong { display: block; margin-top: 4px; color: #ffffff; }
    .status-chip, .source-pill { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 8px; font-size: 11px; font-weight: 800; text-transform: uppercase; white-space: nowrap; }
    .source-pill { background: #eef2f7; color: #475569; }
    .status-chip.ready_for_import { background: #e8f7ef; color: #166534; }
    .status-chip.needs_mapping, .status-chip.monitor_only { background: #fff8df; color: #8a5b00; }
    .status-chip.not_configured, .status-chip.blocked { background: #fdecec; color: #991b1b; }
    .definition-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin: 12px 0; }
    .definition-grid div { border: 1px solid #e4ebf3; border-radius: 8px; padding: 10px; background: #fbfdff; }
    .definition-grid dd { margin: 4px 0 0; color: #26364a; overflow-wrap: anywhere; }
    .blocker-list { border-top: 1px solid #e4ebf3; padding-top: 10px; }
    .blocker-list ul, .inline-list, .guide-card ol { margin: 8px 0 0; padding-left: 18px; color: #445366; line-height: 1.55; }
    .compact { font-size: 13px; }
    .note-box, .warning-box { padding: 14px; margin-top: 14px; }
    .note-box p, .warning-box p { margin: 6px 0 0; color: #526173; line-height: 1.55; }
    .warning-box { background: #fff8ed; border-color: #f6c684; color: #7c4a03; line-height: 1.55; }
    .table-wrap { overflow: auto; border: 1px solid #d9e2ef; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; background: #ffffff; min-width: 780px; }
    th { text-align: left; color: #66788d; background: #f6f9fd; font-size: 11px; text-transform: uppercase; }
    th, td { padding: 11px 12px; border-bottom: 1px solid #e4ebf3; vertical-align: top; }
    .sub { margin-top: 3px; color: #66788d; font-size: 12px; }
    .progress-line { height: 8px; border-radius: 999px; background: #e4ebf3; overflow: hidden; }
    .progress-line span { display: block; height: 100%; background: #0f766e; }
    .blocker { color: #991b1b; margin: 8px 0 0; }
    .audit-list { display: grid; gap: 10px; }
    .immutable-snapshot-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, .9fr); gap: 12px; margin-bottom: 16px; }
    .audit-history { display: grid; gap: 10px; }
    .compact-definition-grid { margin: 10px 0; }
    .snapshot-hash { display: block; overflow-wrap: anywhere; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .audit-card span { color: #66788d; font-size: 12px; }
    .audit-card strong { display: block; margin-top: 4px; }
    .audit-card p { margin: 8px 0; color: #445366; }
    .audit-card small { color: #66788d; }
    .summary-grid, .form-grid { display: grid; gap: 12px; }
    .summary-grid { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
    .summary-grid div { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 6px; }
    .form-grid { grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); margin-top: 16px; }
    .form-grid label { display: flex; flex-direction: column; gap: 6px; color: #162033; font-weight: 700; }
    .form-grid label.wide { grid-column: 1 / -1; }
    input, select { width: 100%; box-sizing: border-box; border: 1px solid #b9c7d7; border-radius: 8px; padding: 10px 12px; font: inherit; background: #ffffff; }
    input:focus, select:focus { outline: none; border-color: #0f766e; box-shadow: 0 0 0 3px rgba(15,118,110,.12); }
    .message { padding: 12px 14px; border-radius: 8px; margin-bottom: 16px; }
    .message.success { background: #ecfdf5; color: #166534; border: 1px solid #86efac; }
    .message.error { background: #fef2f2; color: #991b1b; border: 1px solid #fca5a5; }
    .result { margin-top: 14px; background: #162033; color: #e8eef7; border-radius: 8px; padding: 12px; overflow: auto; }
    .result pre { margin: 0; white-space: pre-wrap; }
    @media (max-width: 760px) {
      .page { padding: 14px; }
      .header, .section-head, .card-title { flex-direction: column; }
      .scenario-source-row { grid-template-columns: 1fr; }
      .evidence-columns { grid-template-columns: 1fr; }
      .immutable-snapshot-grid { grid-template-columns: 1fr; }
      .header h2 { font-size: 23px; }
      .btn { width: 100%; }
    }
  `]
})
export class AdsSettingsComponent implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private baseUrl = environment.apiUrl;

  readonly tabs: Array<{ id: ActiveTab; label: string }> = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'managerAccounts', label: 'Tài khoản quản lý' },
    { id: 'credentials', label: 'Thông tin xác thực' },
    { id: 'childAccounts', label: 'Tài khoản con' },
    { id: 'importSchedule', label: 'Lịch nhập dữ liệu' },
    { id: 'mappingHealth', label: 'Sức khoẻ mapping' },
    { id: 'executionGates', label: 'Cổng thực thi' },
    { id: 'audit', label: 'Nhật ký' },
    { id: 'googleSettings', label: 'Thiết lập Google' },
    { id: 'tiktokSettings', label: 'Thiết lập TikTok' },
  ];

  readonly controlPlaneFlow = [
    {
      title: 'Xác thực tài khoản quản lý',
      detail: 'Siêu dữ liệu MCC/BM/BC trỏ tới kho secret của ERP; giá trị dạng rõ không được hiển thị.',
    },
    {
      title: 'Phát hiện tài khoản con',
      detail: 'Các tài khoản quảng cáo đã uỷ quyền được nhập dưới từng tài khoản quản lý.',
    },
    {
      title: 'Nhập chỉ đọc hằng ngày',
      detail: 'Dữ liệu tài khoản, chiến dịch, nhóm quảng cáo và chi phí được nạp vào module vận hành.',
    },
    {
      title: 'Ghép dữ liệu ERP',
      detail: 'Đối tượng từ nhà cung cấp được ghép với bằng chứng sản phẩm, nhà cung cấp, đơn hàng, lợi nhuận, tồn kho, hoàn hàng và dòng tiền.',
    },
    {
      title: 'Cổng phê duyệt',
      detail: 'Bản nháp hành động vẫn bị chặn cho đến khi validateOnly, phê duyệt, preflight, idempotency và cổng tài chính đều đạt.',
    },
  ];

  readonly safetyFlags: SafetyFlag[] = [
    { key: 'production_ready', value: false, evidence: 'Hiện mới là nền móng trung tâm điều khiển.' },
    { key: 'execution_allowed_now', value: false, evidence: 'Giao diện này không có luồng chạy thật.' },
    { key: 'real_credential_material_present', value: false, evidence: 'Chỉ render siêu dữ liệu đã ẩn và vault handle.' },
    { key: 'plaintext_secrets_added', value: false, evidence: 'Trường secret được xoá sau khi lưu/kiểm thử.' },
    { key: 'provider_api_used', value: false, evidence: 'Không dùng SDK/API nhà cung cấp khi component tải.' },
    { key: 'provider_api_called', value: false, evidence: 'Khi component tải chỉ đọc siêu dữ liệu cấu hình ERP.' },
    { key: 'google_ads_api_used', value: false, evidence: 'Google Ads vẫn nằm sau endpoint ERP chỉ dành cho admin.' },
    { key: 'google_ads_api_called', value: false, evidence: 'Không tự động gọi Google Ads API.' },
    { key: 'meta_api_used', value: false, evidence: 'Meta chỉ được thể hiện bằng siêu dữ liệu token.' },
    { key: 'meta_api_called', value: false, evidence: 'Không tự động gọi Meta API.' },
    { key: 'tiktok_api_used', value: false, evidence: 'TikTok vẫn nằm sau endpoint ERP chỉ dành cho admin.' },
    { key: 'tiktok_api_called', value: false, evidence: 'Không tự động gọi TikTok API.' },
    { key: 'validateOnly_called', value: false, evidence: 'validateOnly vẫn là cổng ERP của phase sau.' },
    { key: 'live_ads_execution_used', value: false, evidence: 'Không có đường ghi lên nhà cung cấp trong phần này.' },
    { key: 'GOOGLE_ADS_PRODUCTION_ENABLED', value: 'false_or_absent', evidence: 'Cờ chạy thật không được bật ở đây.' },
  ];

  readonly mappingHealth: MappingHealthReadiness[] = [
    {
      id: 'manager-to-child',
      layer: 'Tài khoản quản lý -> tài khoản quảng cáo con',
      mapped: 3,
      total: 6,
      status: 'needs_mapping',
      evidence: 'Dữ liệu mẫu nội bộ yêu cầu cây tài khoản con được nhập từ MCC/BM/BC.',
      blocker: 'Thông tin xác thực tài khoản quản lý và phát hiện tài khoản con chưa hoàn tất cho mọi nền tảng.',
    },
    {
      id: 'child-to-campaign',
      layer: 'Tài khoản con -> campaign -> ad group',
      mapped: 2,
      total: 8,
      status: 'needs_mapping',
      evidence: 'Nhóm quảng cáo phải có provider ID và bằng chứng campaignBudgetId đã xác minh.',
      blocker: 'Hành động ngân sách vẫn ở chế độ chỉ giám sát cho đến khi campaignBudgetId được sync.',
    },
    {
      id: 'adgroup-to-product',
      layer: 'Ad group -> sản phẩm / nhà cung cấp',
      mapped: 2,
      total: 7,
      status: 'monitor_only',
      evidence: 'Ứng viên tăng ngân sách cần dữ liệu kinh tế sản phẩm và sức khoẻ nhà cung cấp.',
      blocker: 'Thiếu bằng chứng tồn kho, độ tin cậy nhà cung cấp, hoàn hàng và năng lực fulfilment.',
    },
    {
      id: 'finance-risk',
      layer: 'Lợi nhuận / dòng tiền / giới hạn lỗ',
      mapped: 1,
      total: 5,
      status: 'blocked',
      evidence: 'Cơ chế ưu tiên dòng tiền chặn scale khi bằng chứng tài chính chưa đủ.',
      blocker: 'Giới hạn lỗ ngày/tháng và kiểm tra vốn lưu động chưa được duyệt.',
    },
  ];

  readonly executionGates: SafetyGateReadiness[] = [
    {
      key: 'approval_required_for_all_drafts',
      label: 'Hàng đợi phê duyệt',
      state: 'blocked',
      value: 'required_before_execution',
      evidence: 'Không bản nháp hành động nào được thực thi khi chưa có người duyệt.',
    },
    {
      key: 'validateOnly_called',
      label: 'ValidateOnly của nhà cung cấp',
      state: 'blocked',
      value: 'false',
      evidence: 'Máy chủ ERP ở phase sau phải gọi validateOnly của nhà cung cấp trước khi duyệt/thực thi.',
    },
    {
      key: 'dry_run_preflight',
      label: 'Preflight dry-run',
      state: 'blocked',
      value: 'required',
      evidence: 'Preflight là hợp đồng executor của phase sau, chưa thuộc nền móng giao diện này.',
    },
    {
      key: 'idempotency_required',
      label: 'Idempotency',
      state: 'blocked',
      value: 'required',
      evidence: 'Mọi hành động sau này cần idempotency key trước khi thực thi.',
    },
    {
      key: 'kill_switch',
      label: 'Kill switch',
      state: 'blocked',
      value: 'required',
      evidence: 'Thực thi vẫn bị chặn cho đến khi có kill switch và đã kiểm thử.',
    },
    {
      key: 'production_ready',
      label: 'Cờ chạy thật',
      state: 'blocked',
      value: 'false',
      evidence: 'Thực thi chạy thật bị tắt rõ ràng trong phần này.',
    },
    {
      key: 'loss_limits',
      label: 'Giới hạn lỗ ngày/tháng',
      state: 'blocked',
      value: 'missing_policy',
      evidence: 'Scale-up bị hạ xuống chỉ giám sát cho đến khi có policy giới hạn đã duyệt.',
    },
    {
      key: 'blocked_action_types',
      label: 'Hành động nhà cung cấp không an toàn',
      state: 'blocked',
      value: 'delete/PMax/Shopping/Display/YouTube blocked',
      evidence: 'Không thêm đường xoá, Performance Max, Shopping, Display, YouTube hoặc auto-publish.',
    },
  ];

  readonly auditEvidence: AuditEvidence[] = [
    {
      id: 'local-fixture',
      event: 'Đã tải read model trung tâm điều khiển',
      result: 'read-only ERP data',
      evidence: 'Tài khoản quản lý đến từ manager registry; mapping, finance và execution gates đến từ ERP evidence snapshot.',
      rollback: 'Các endpoint chỉ đọc không tạo provider mutation; có thể tải lại read model.',
    },
    {
      id: 'secret-redaction',
      event: 'Chính sách hiển thị thông tin xác thực',
      result: 'không thêm secret dạng rõ',
      evidence: 'Chỉ render siêu dữ liệu đã ẩn và tham chiếu vault.',
      rollback: 'Xoá form và đưa người dùng về /api-tokens cho quy trình token kỹ thuật.',
    },
    {
      id: 'execution-blocked',
      event: 'An toàn thực thi',
      result: 'không cho chạy thật',
      evidence: 'Ghi lên nhà cung cấp, gọi validateOnly và chạy ads thật đều không có sẵn mặc định.',
      rollback: 'Giữ cờ chạy thật tắt và giữ trạng thái chỉ giám sát.',
    },
    {
      id: 'cashflow-first',
      event: 'Quản trị tài chính',
      result: 'scale-up bị hạ cấp',
      evidence: 'Thiếu biên lợi nhuận, vòng quay tiền, tồn kho, nhà cung cấp, fulfilment, hoàn hàng, độ mới dữ liệu hoặc giới hạn lỗ sẽ chặn scale.',
      rollback: 'Yêu cầu người duyệt và bằng chứng nhà cung cấp/dòng tiền trước khi tạo bản nháp hành động.',
    },
  ];

  activeTab = signal<ActiveTab>('overview');
  settings = signal<AdsSettings | null>(null);
  managerRegistrySummary = signal<AdsManagerRegistrySummary | null>(null);
  managerRegistryLoading = signal(false);
  managerRegistryError = signal('');
  verifyingManagerId = signal('');
  readonly canVerifyManagerAccount = computed(() => (
    this.auth.hasPermission('google-ads.credentials.write')
  ));
  message = signal('');
  messageType = signal<'error' | 'success'>('success');

  googleForm = {
    developerToken: '',
    clientId: '',
    clientSecret: '',
    refreshToken: '',
    loginCustomerId: '',
    apiVersion: 'v24',
    testCustomerId: ''
  };

  tiktokForm = {
    accessToken: '',
    refreshToken: '',
    appId: '',
    appSecret: '',
    authCode: '',
    redirectUri: '',
    businessCenterId: '',
    businessCenterName: '',
    testAdvertiserId: '',
    advertiserIdsText: '',
    grantedAdvertiserIdsText: '',
    scopesText: '',
    accessTokenExpiresAt: '',
    refreshTokenExpiresAt: '',
  };

  testingGoogle = signal(false);
  savingGoogle = signal(false);
  googleTestResult = signal<any>(null);

  testingTikTok = signal(false);
  savingTikTok = signal(false);
  exchangingTikTok = signal(false);
  tiktokTestResult = signal<any>(null);

  syncing = signal(false);
  syncResult = signal('');
  manualDataSyncing = signal(false);
  manualDataSyncError = signal('');
  manualDataSyncResult = signal<AdsSourceReadinessReviewExport | null>(null);
  manualDataSyncLastRequestedAt = signal('');
  scenarioProducts = signal<AdsBusinessScenarioProduct[]>([]);
  scenarioInventory = signal<Record<string, AdsBusinessScenarioInventoryRow>>({});
  scenarioProductLoading = signal(false);
  scenarioProductError = signal('');
  selectedScenarioProductId = signal('');
  scenarioProductAppliedLabel = signal('');
  businessScenario = signal<AdsBusinessScenarioInput>({
    additionalLoanVnd: 100000000,
    annualInterestRatePercent: 12,
    loanTermMonths: 12,
    purchasePriceVnd: 320000,
    sellingPriceVnd: 520000,
    fulfillmentCostPerOrderVnd: 35000,
    expectedOrdersPerDay: 20,
    returnRatePercent: 8,
    dailyAdsBudgetVnd: 2500000,
    inventoryUnits: 180,
  });

  evidenceSnapshot = signal<AdsEvidenceSnapshot | null>(null);
  evidenceLoading = signal(false);
  evidenceError = signal('');
  googleAdsLatestSyncRun = signal<GoogleAdsSyncRun | null>(null);
  importRunLoading = signal(false);
  importRunError = signal('');
  immutableLatestSnapshot = signal<PersistedAdsEvidenceSnapshot | null>(null);
  immutableSnapshotHistory = signal<PersistedAdsEvidenceSnapshot[]>([]);
  immutableSnapshotsLoading = signal(false);
  immutableSnapshotsError = signal('');

  readonly evidenceDrilldownLinks: EvidenceDrilldownLink[] = [
    { label: 'Ad groups', route: '/ad-groups', detail: 'Campaign, ad group, budget mapping' },
    { label: 'Ad accounts', route: '/ad-accounts', detail: 'Child account ownership' },
    { label: 'Ad costs', route: '/costs/advertising', detail: 'Daily spend evidence' },
    { label: 'Financial control', route: '/finance/financial-control', detail: 'Cash and survival floor' },
    { label: 'Products', route: '/product', detail: 'Product and margin mapping' },
    { label: 'Supplier quotes', route: '/supplier-quotes', detail: 'Supplier readiness' },
  ];

  readonly evidenceSummaryCards = computed<EvidenceSummaryCard[]>(() => {
    const snapshot = this.evidenceSnapshot();
    if (!snapshot) {
      return [
        { title: 'Mapping health', value: 'pending', detail: 'Waiting for evidence snapshot', state: 'loading' },
        { title: 'Finance gate', value: 'pending', detail: 'Waiting for finance evidence', state: 'loading' },
        { title: 'Ads gate', value: 'pending', detail: 'Waiting for ads gate evidence', state: 'loading' },
        { title: 'Top blockers', value: 'pending', detail: 'Waiting for blocker list', state: 'loading' },
      ];
    }

    const total = snapshot.summary.totalAdGroups || snapshot.adGroups.length;
    const mapped = snapshot.adGroups.filter((group) => group.mappingHealth.status === 'mapped').length;
    const partial = snapshot.adGroups.filter((group) => group.mappingHealth.status === 'partial').length;
    const missing = snapshot.adGroups.filter((group) => group.mappingHealth.status === 'missing').length;
    const financeStatuses = snapshot.adGroups.map((group) => group.financeGate.status);
    const financeAllowScale = financeStatuses.filter((status) => status === 'allow_scale').length;
    const financeBlocked = financeStatuses.filter((status) => status === 'block').length;
    const financeHold = financeStatuses.filter((status) => status === 'hold').length;
    const financeCapOnly = financeStatuses.filter((status) => status === 'cap_only').length;
    const executable = snapshot.adGroups.filter((group) => group.adsGate.executable).length;
    const blockers = this.collectEvidenceBlockers(snapshot);
    const errorCount = blockers.filter((blocker) => blocker.severity === 'error').length;
    const warningCount = blockers.filter((blocker) => blocker.severity === 'warning').length;

    return [
      {
        title: 'Mapping health',
        value: `${mapped}/${total} mapped`,
        detail: `${snapshot.summary.needsMapping} need mapping; ${partial} partial, ${missing} missing`,
        state: snapshot.summary.blocked > 0 ? 'blocked' : snapshot.summary.needsMapping > 0 ? 'needs_mapping' : 'scale_ready',
      },
      {
        title: 'Finance gate',
        value: `${financeAllowScale}/${total} allow scale`,
        detail: `${financeBlocked} blocked, ${financeHold} hold, ${financeCapOnly} cap-only`,
        state: financeBlocked > 0 ? 'block' : financeHold > 0 ? 'hold' : financeCapOnly > 0 ? 'cap_only' : 'allow_scale',
      },
      {
        title: 'Ads gate',
        value: `${executable}/${total} executable`,
        detail: `production=${snapshot.productionEnabled ? 'on' : 'off'}, dryRun=${snapshot.dryRun ? 'on' : 'off'}, killSwitch=${snapshot.killSwitchActive ? 'on' : 'off'}`,
        state: executable > 0 ? 'scale_ready' : snapshot.providerExecutionEnabled ? 'hold' : 'blocked',
      },
      {
        title: 'Top blockers',
        value: `${blockers.length}`,
        detail: `${errorCount} error, ${warningCount} warning`,
        state: errorCount > 0 ? 'blocked' : warningCount > 0 ? 'hold' : 'scale_ready',
      },
    ];
  });

  readonly topEvidenceBlockers = computed<AdsEvidenceBlocker[]>(() => {
    return this.collectEvidenceBlockers(this.evidenceSnapshot()).slice(0, 5);
  });

  readonly manualDataSyncCards = computed<EvidenceSummaryCard[]>(() => {
    const result = this.manualDataSyncResult();
    if (!result) {
      return [
        {
          title: 'Nguồn dữ liệu',
          value: this.manualDataSyncing() ? 'đang chạy' : 'chưa đồng bộ',
          detail: 'Chờ bấm đồng bộ để tính lại trạng thái từ ERP',
          state: this.manualDataSyncing() ? 'loading' : 'monitor_only',
        },
        {
          title: 'Mapping ERP',
          value: 'chưa có',
          detail: 'Ad group, sản phẩm, lợi nhuận, tồn kho, nhà cung cấp',
          state: 'monitor_only',
        },
        {
          title: 'Tài chính',
          value: 'chưa có',
          detail: 'Cashflow, giới hạn lỗ, ngân sách ngày/tháng',
          state: 'monitor_only',
        },
        {
          title: 'Ads safety',
          value: 'đóng',
          detail: 'Không gọi provider API, không chạy ads thật',
          state: 'monitor_only',
        },
      ];
    }

    const summary = result.summary;
    const requiredBlocked =
      summary.required_source_blocked_count + summary.required_source_report_date_blocked_count;
    const mappedAdGroups =
      summary.platform_mapped_ad_group_count + summary.platform_unmapped_ad_group_count;
    const productSupplierBlockers =
      summary.product_allocation_blocker_count +
      summary.supplier_safety_blocker_count +
      summary.platform_blocked_product_count +
      summary.platform_blocked_supplier_count;

    return [
      {
        title: 'Nguồn bắt buộc',
        value: `${summary.required_source_ready_count}/${summary.required_source_count}`,
        detail: `${summary.required_source_blocked_count} nguồn chặn, ${summary.required_source_report_date_blocked_count} lệch ngày báo cáo`,
        state: requiredBlocked > 0 ? 'blocked' : 'ready_for_import',
      },
      {
        title: 'Mapping ERP',
        value: `${summary.platform_mapped_ad_group_count}/${mappedAdGroups || summary.platform_mapped_ad_group_count}`,
        detail: `${summary.platform_mapped_product_count} sản phẩm đã map; ${summary.platform_unmapped_ad_group_count} ad group thiếu map`,
        state: summary.platform_unmapped_ad_group_count > 0 ? 'needs_mapping' : 'ready_for_import',
      },
      {
        title: 'Tài chính',
        value: summary.cashflow_first_scale_mode === 'pending_validation' ? 'chờ duyệt' : 'giám sát',
        detail: `${productSupplierBlockers} blocker sản phẩm/nhà cung cấp/tài chính`,
        state: productSupplierBlockers > 0 ? 'blocked' : 'ready_for_import',
      },
      {
        title: 'Ads safety',
        value: result.safety.execution_allowed_now ? 'mở' : 'đóng',
        detail: `${result.safety.provider_api_called ? 'có' : 'không'} gọi provider API; ${result.safety.live_ads_execution_used ? 'có' : 'không'} chạy ads thật`,
        state: result.safety.execution_allowed_now ? 'blocked' : 'monitor_only',
      },
    ];
  });

  readonly manualDataSyncSourceCoverage = computed<AdsSourceReadinessCoverage[]>(() => (
    (this.manualDataSyncResult()?.sourceCoverage || []).slice(0, 8)
  ));

  readonly manualDataSyncBlockers = computed<string[]>(() => {
    const result = this.manualDataSyncResult();
    if (!result) return [];

    const blockerGroups = [
      result.summary.missing_required_source_evidence,
      result.summary.source_coverage_blocking_reasons,
      result.blockerReview.sourceBlockers,
      result.blockerReview.readonlyImportBlockers,
      result.blockerReview.readModelBlockers,
      result.blockerReview.productAllocationBlockers,
      result.blockerReview.supplierSafetyBlockers,
      result.blockerReview.cashflowFirstBlockers,
      result.blockerReview.globalBlockers,
      result.sourceCoverage.flatMap((source) => source.blockingReasons),
    ];

    return Array.from(new Set(blockerGroups.flat().filter(Boolean))).slice(0, 10);
  });

  readonly businessScenarioResult = computed<AdsBusinessScenarioResult>(() => {
    const scenario = this.businessScenario();
    const orders = Math.max(0, scenario.expectedOrdersPerDay);
    const successRate = this.clamp(1 - (scenario.returnRatePercent / 100), 0, 1);
    const successfulOrders = orders * successRate;
    const grossRevenueVnd = scenario.sellingPriceVnd * successfulOrders;
    const purchaseCostVnd = scenario.purchasePriceVnd * orders;
    const fulfillmentCostVnd = scenario.fulfillmentCostPerOrderVnd * orders;
    const dailyDebtServiceVnd = this.dailyDebtService(scenario);
    const grossProfitBeforeAdsVnd = grossRevenueVnd - purchaseCostVnd - fulfillmentCostVnd;
    const netProfitAfterAdsVnd =
      grossProfitBeforeAdsVnd - scenario.dailyAdsBudgetVnd - dailyDebtServiceVnd;
    const breakEvenDailyAdsBudgetVnd = Math.max(0, grossProfitBeforeAdsVnd - dailyDebtServiceVnd);
    const recommendedTestAdsBudgetVnd = Math.floor(breakEvenDailyAdsBudgetVnd * 0.7);
    const maxCpaVnd = successfulOrders > 0
      ? Math.max(0, breakEvenDailyAdsBudgetVnd / successfulOrders)
      : 0;
    const daysOfCover = orders > 0 ? scenario.inventoryUnits / orders : null;
    const blockers: string[] = [];

    if (!scenario.purchasePriceVnd || !scenario.sellingPriceVnd || !orders) {
      blockers.push('thiếu giá hoặc sản lượng dự kiến');
    }
    if (scenario.sellingPriceVnd <= scenario.purchasePriceVnd) {
      blockers.push('giá bán không cao hơn giá nhập');
    }
    if (netProfitAfterAdsVnd < 0) {
      blockers.push('lợi nhuận sau ads âm');
    }
    if (scenario.dailyAdsBudgetVnd > breakEvenDailyAdsBudgetVnd) {
      blockers.push('ngân sách ads vượt ngưỡng hòa vốn');
    }
    if (daysOfCover !== null && daysOfCover < 3) {
      blockers.push('tồn kho dưới 3 ngày');
    } else if (daysOfCover !== null && daysOfCover < 7) {
      blockers.push('tồn kho dưới 7 ngày');
    }

    const decision: AdsBusinessScenarioDecision =
      !scenario.purchasePriceVnd || !scenario.sellingPriceVnd || !orders
        ? 'needs_data'
        : netProfitAfterAdsVnd < 0 || scenario.sellingPriceVnd <= scenario.purchasePriceVnd
          ? 'do_not_scale'
          : scenario.dailyAdsBudgetVnd > breakEvenDailyAdsBudgetVnd || (daysOfCover !== null && daysOfCover < 3)
            ? 'hold'
            : daysOfCover !== null && daysOfCover < 7
              ? 'monitor_only'
              : 'can_test_scale';

    return {
      decision,
      grossRevenueVnd,
      grossProfitBeforeAdsVnd,
      netProfitAfterAdsVnd,
      breakEvenDailyAdsBudgetVnd,
      recommendedTestAdsBudgetVnd,
      maxCpaVnd,
      dailyDebtServiceVnd,
      daysOfCover,
      blockers,
      provider_api_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
    };
  });

  readonly managerAccounts = computed<ManagerAccountReadiness[]>(() => {
    const registry = this.managerRegistrySummary();
    if (registry) {
      return registry.managers.map((manager) => ({
        id: manager.id,
        provider: manager.provider === 'facebook' ? 'meta' : manager.provider,
        providerLabel: manager.provider === 'google'
          ? 'Google Ads'
          : manager.provider === 'facebook' ? 'Meta Ads' : 'TikTok Ads',
        managerType: manager.managerAccountType === 'google_ads_mcc'
          ? 'MCC'
          : manager.managerAccountType === 'meta_business_manager' ? 'Business Manager' : 'Business Center',
        managerName: manager.managerAccountName || manager.name,
        managerId: manager.managerAccountId,
        credentialSource: `${manager.vaultProvider} / ${manager.credentialStatus}`,
        secretReference: manager.secretReferenceHandle,
        credentialSummary: manager.missingScopes.length
          ? `thiếu scope: ${manager.missingScopes.join(', ')}`
          : `credential status: ${manager.credentialStatus}`,
        childAccountCount: manager.discoveredChildAccountCount,
        readiness: manager.readinessStatus,
        importScope: manager.capabilities.canImportReadOnly
          ? 'được phép import read-only theo registry'
          : 'import read-only đang bị chặn',
        executionScope: manager.capabilities.canUseForFutureExecution
          ? 'Chỉ được thực thi qua workflow Ads V2 canonical.'
          : 'Registry không cho phép thực thi live trực tiếp.',
        blockers: [...manager.blockers, ...manager.warnings],
      }));
    }

    return [];
  });

  readonly configuredManagerCount = computed(() => (
    this.managerAccounts().filter((manager) => manager.readiness !== 'not_configured').length
  ));

  readonly childAccountTotal = computed(() => (
    this.managerAccounts().reduce((sum, manager) => sum + manager.childAccountCount, 0)
  ));

  readonly credentials = computed<CredentialReadiness[]>(() => {
    const settings = this.settings();
    return [
      {
        id: 'google-system-settings',
        providerLabel: 'Google MCC',
        tokenType: 'Cấu hình hệ thống / refresh token',
        status: settings?.google?.configured ? 'needs_mapping' : 'not_configured',
        metadata: `client=${settings?.google?.clientId || 'thiếu'}, api=${settings?.google?.apiVersion || 'mặc định'}`,
        secretReference: settings?.google?.configured
          ? 'vault://ads/google-mcc/system-settings-redacted'
          : 'pending_secret_store_onboarding',
        allowedByDefault: 'chỉ nhập dữ liệu dạng đọc',
      },
      {
        id: 'meta-api-tokens',
        providerLabel: 'Meta BM',
        tokenType: 'Business Center / access token',
        status: settings?.facebook?.configured ? 'ready_for_import' : 'not_configured',
        metadata: `${settings?.facebook?.tokenCount || 0} bản ghi siêu dữ liệu token đang hoạt động`,
        secretReference: settings?.facebook?.configured
          ? 'vault://ads/meta-business-manager/token-redacted'
          : 'pending_secret_store_onboarding',
        allowedByDefault: 'chỉ nhập dữ liệu dạng đọc',
      },
      {
        id: 'tiktok-system-settings',
        providerLabel: 'TikTok BC',
        tokenType: 'Cấu hình hệ thống / Business Center',
        status: settings?.tiktok?.configured ? 'needs_mapping' : 'not_configured',
        metadata: `bc=${settings?.tiktok?.businessCenterId || 'thiếu'}, scope=${settings?.tiktok?.scopes?.length || 0}`,
        secretReference: settings?.tiktok?.configured
          ? 'vault://ads/tiktok-business-center/system-settings-redacted'
          : 'pending_secret_store_onboarding',
        allowedByDefault: 'chỉ nhập dữ liệu dạng đọc',
      },
    ];
  });

  readonly childAccounts = computed<ChildAccountReadiness[]>(() => {
    const registry = this.managerRegistrySummary();
    if (registry) {
      return registry.managers.flatMap((manager) => manager.childAccountIds.map((accountId) => ({
        id: `${manager.id}:${accountId}`,
        providerLabel: manager.provider === 'google'
          ? 'Google Ads'
          : manager.provider === 'facebook' ? 'Meta Ads' : 'TikTok Ads',
        managerId: manager.managerAccountId,
        accountName: `Tài khoản con ${accountId}`,
        accountId,
        managementMode: manager.provider === 'google' ? 'mcc' : manager.provider === 'facebook' ? 'bm' : 'bc',
        importState: manager.capabilities.canImportReadOnly ? 'ready_for_import' : 'blocked',
        mappingState: manager.readinessStatus === 'needs_mapping' ? 'needs_mapping' : manager.readinessStatus,
        executionMode: 'read_only_import',
        ownerSurface: '/ad-accounts',
      } as ChildAccountReadiness)));
    }

    return [];
  });

  readonly importSchedules = computed<ImportScheduleReadiness[]>(() => {
    const settings = this.settings();
    const googleRun = this.googleAdsLatestSyncRun();
    const googleStatus: ReadinessState = googleRun?.status === 'success'
      ? 'ready_for_import'
      : googleRun?.status === 'partial'
        ? 'needs_mapping'
        : googleRun?.status === 'failed'
          ? 'blocked'
          : googleRun?.status === 'running'
            ? 'monitor_only'
            : 'not_configured';
    const googleCounts = Object.entries(googleRun?.counts || {});
    const googleRowCount = googleCounts.length
      ? googleCounts.map(([key, count]) => `${key}: ${count}`).join(', ')
      : 'không có counts trong sync-run';
    const googleErrors = (googleRun?.syncErrors || []).map((error) => {
      const scope = [error.customerId, error.step].filter(Boolean).join(' / ');
      return `${scope ? `${scope}: ` : ''}${error.message}`;
    });
    const noCanonicalRun = 'chưa có nguồn sync-run ERP canonical';
    return [
      {
        id: 'google-import',
        source: 'Nhập chỉ đọc từ Google Ads MCC',
        cadence: 'không được công bố bởi canonical sync-run endpoint',
        lastRun: googleRun?.startedAt ? this.formatDateTime(googleRun.startedAt) : 'chưa có sync-run',
        nextRun: 'không được công bố bởi canonical sync-run endpoint',
        completedAt: googleRun?.completedAt ? this.formatDateTime(googleRun.completedAt) : googleRun?.status === 'running' ? 'đang chạy' : 'chưa có',
        customerIds: googleRun?.customerIds?.length ? googleRun.customerIds.join(', ') : 'không có',
        runId: googleRun?.runId || 'không có',
        destination: 'ERP Google Ads read models và advertising cost',
        status: googleStatus,
        rowCount: googleRowCount,
        blockers: googleRun
          ? googleErrors
          : [settings?.google?.configured ? 'chưa có bằng chứng sync-run Google Ads trong ERP' : 'Google Ads chưa được cấu hình'],
      },
      {
        id: 'meta-import',
        source: 'Nhập chỉ đọc từ Meta BM',
        cadence: noCanonicalRun,
        lastRun: 'không có nguồn sync-run ERP',
        nextRun: 'không khả dụng',
        completedAt: 'không khả dụng',
        customerIds: 'không khả dụng',
        runId: 'không khả dụng',
        destination: 'chưa có canonical sync-run destination',
        status: settings?.facebook?.configured ? 'monitor_only' : 'not_configured',
        rowCount: 'không khả dụng',
        blockers: [noCanonicalRun],
      },
      {
        id: 'tiktok-import',
        source: 'Nhập chỉ đọc từ TikTok BC',
        cadence: noCanonicalRun,
        lastRun: 'không có nguồn sync-run ERP',
        nextRun: 'không khả dụng',
        completedAt: 'không khả dụng',
        customerIds: 'không khả dụng',
        runId: 'không khả dụng',
        destination: 'chưa có canonical sync-run destination',
        status: settings?.tiktok?.configured ? 'monitor_only' : 'not_configured',
        rowCount: 'không khả dụng',
        blockers: [noCanonicalRun],
      },
    ];
  });

  ngOnInit() {
    this.loadSettings();
    this.loadManagerRegistry();
    this.loadEvidenceSnapshot();
    this.loadScenarioProducts();
  }

  selectTab(tab: ActiveTab) {
    this.activeTab.set(tab);
    if (tab === 'audit') {
      this.loadImmutableEvidenceSnapshots();
    }
    if (tab === 'importSchedule') {
      this.loadImportRunStatus();
    }
  }

  loadImportRunStatus() {
    this.importRunLoading.set(true);
    this.importRunError.set('');
    this.http.get<GoogleAdsSyncRun | null>(`${this.baseUrl}/google-ads/sync/runs/latest`).subscribe({
      next: (run) => {
        this.googleAdsLatestSyncRun.set(run || null);
        this.importRunLoading.set(false);
      },
      error: (err) => {
        this.googleAdsLatestSyncRun.set(null);
        this.importRunLoading.set(false);
        this.importRunError.set('Không tải được Google Ads sync-run mới nhất: ' + (err?.error?.message || err.message));
      },
    });
  }

  loadImmutableEvidenceSnapshots() {
    let pending = 2;
    const finish = () => {
      pending -= 1;
      if (pending <= 0) this.immutableSnapshotsLoading.set(false);
    };
    const recordError = (message: string) => {
      const current = this.immutableSnapshotsError();
      this.immutableSnapshotsError.set(current ? `${current}; ${message}` : message);
    };

    this.immutableSnapshotsLoading.set(true);
    this.immutableSnapshotsError.set('');

    this.http.get<PersistedAdsEvidenceSnapshot | null>(
      `${this.baseUrl}/ads-automation/evidence/snapshots/latest`,
    ).subscribe({
      next: (snapshot) => {
        this.immutableLatestSnapshot.set(snapshot || null);
        finish();
      },
      error: (err) => {
        this.immutableLatestSnapshot.set(null);
        recordError('Không tải được snapshot mới nhất: ' + (err?.error?.message || err.message));
        finish();
      },
    });

    this.http.get<PersistedAdsEvidenceSnapshot[]>(
      `${this.baseUrl}/ads-automation/evidence/snapshots/history?limit=7`,
    ).subscribe({
      next: (history) => {
        this.immutableSnapshotHistory.set(Array.isArray(history) ? history : []);
        finish();
      },
      error: (err) => {
        this.immutableSnapshotHistory.set([]);
        recordError('Không tải được lịch sử snapshot: ' + (err?.error?.message || err.message));
        finish();
      },
    });
  }

  loadSettings() {
    this.http.get<AdsSettings>(`${this.baseUrl}/api-tokens/settings`).subscribe({
      next: (data) => {
        this.settings.set(data);
        this.googleForm.loginCustomerId = data.google?.loginCustomerId || this.googleForm.loginCustomerId;
        this.googleForm.apiVersion = data.google?.apiVersion || this.googleForm.apiVersion;
        this.tiktokForm.businessCenterId = data.tiktok?.businessCenterId || '';
        this.tiktokForm.businessCenterName = data.tiktok?.businessCenterName || '';
        this.tiktokForm.testAdvertiserId = data.tiktok?.testAdvertiserId || '';
        this.tiktokForm.advertiserIdsText = (data.tiktok?.advertiserIds || []).join(',');
        this.tiktokForm.grantedAdvertiserIdsText = (data.tiktok?.grantedAdvertiserIds || []).join(',');
        this.tiktokForm.scopesText = (data.tiktok?.scopes || []).join(', ');
        this.tiktokForm.accessTokenExpiresAt = data.tiktok?.accessTokenExpiresAt || '';
        this.tiktokForm.refreshTokenExpiresAt = data.tiktok?.refreshTokenExpiresAt || '';
      },
      error: (err) => this.showMessage('Lỗi tải cấu hình: ' + (err?.error?.message || err.message), 'error')
    });
  }

  loadManagerRegistry() {
    this.managerRegistryLoading.set(true);
    this.managerRegistryError.set('');
    this.http.get<AdsManagerRegistrySummary>(`${this.baseUrl}/ads-manager-accounts/readiness/summary`).subscribe({
      next: (summary) => {
        this.managerRegistrySummary.set(summary);
        this.managerRegistryLoading.set(false);
      },
      error: (err) => {
        this.managerRegistrySummary.set(null);
        this.managerRegistryLoading.set(false);
        this.managerRegistryError.set(
          'Không tải được manager registry: ' + (err?.error?.message || err.message),
        );
      },
    });
  }

  verifyManagerReadOnly(manager: ManagerAccountReadiness) {
    if (manager.provider !== 'google' || !manager.id || this.verifyingManagerId()) {
      return;
    }

    this.verifyingManagerId.set(manager.id);
    this.http.post(`${this.baseUrl}/ads-manager-accounts/${manager.id}/verify-readonly`, {}).subscribe({
      next: () => {
        this.verifyingManagerId.set('');
        this.showMessage('Đã xác minh MCC ở chế độ chỉ đọc; chưa bật validateOnly hoặc thực thi live.', 'success');
        this.loadManagerRegistry();
      },
      error: (err) => {
        this.verifyingManagerId.set('');
        this.showMessage(
          'Xác minh MCC chỉ đọc thất bại: ' + (err?.error?.message || err.message),
          'error',
        );
      },
    });
  }

  loadEvidenceSnapshot() {
    this.evidenceLoading.set(true);
    this.evidenceError.set('');

    this.http.get<AdsEvidenceSnapshot>(`${this.baseUrl}/ads-automation/evidence/snapshot?limit=6&lookbackDays=30`).subscribe({
      next: (data) => {
        this.evidenceSnapshot.set(data);
        this.evidenceLoading.set(false);
      },
      error: (err) => {
        this.evidenceSnapshot.set(null);
        this.evidenceLoading.set(false);
        this.evidenceError.set('Evidence snapshot unavailable: ' + (err?.error?.message || err.message));
      }
    });
  }

  loadScenarioProducts() {
    let pendingRequests = 2;
    const finish = () => {
      pendingRequests -= 1;
      if (pendingRequests <= 0) {
        this.scenarioProductLoading.set(false);
      }
    };

    this.scenarioProductLoading.set(true);
    this.scenarioProductError.set('');

    this.http.get<AdsBusinessScenarioProduct[]>(`${this.baseUrl}/products`).subscribe({
      next: (products) => {
        this.scenarioProducts.set(Array.isArray(products) ? products : []);
        this.reapplySelectedScenarioProduct();
        finish();
      },
      error: (err) => {
        this.scenarioProducts.set([]);
        this.appendScenarioProductError('Không tải được danh sách sản phẩm ERP: ' + (err?.error?.message || err.message));
        finish();
      },
    });

    this.http.get<AdsBusinessScenarioInventorySummary>(`${this.baseUrl}/inventory/summary?limit=100`).subscribe({
      next: (summary) => {
        this.scenarioInventory.set(this.indexScenarioInventory(summary?.data || []));
        this.reapplySelectedScenarioProduct();
        finish();
      },
      error: (err) => {
        this.scenarioInventory.set({});
        this.appendScenarioProductError('Không tải được tồn kho thật; kịch bản vẫn giữ số tồn kho nhập tay: ' + (err?.error?.message || err.message));
        finish();
      },
    });
  }

  runManualDataSync() {
    const requestedAt = new Date();
    const now = requestedAt.toISOString();
    const snapshotDate = this.localDateString(requestedAt);

    this.manualDataSyncing.set(true);
    this.manualDataSyncError.set('');
    this.manualDataSyncLastRequestedAt.set(now);

    this.http.post<AdsSourceReadinessReviewExport>(
      `${this.baseUrl}/ai/ads-automation/erp-source-import-readiness-review-export`,
      {
        query: {
          snapshotDate,
          now,
          evidenceWindow: { days: 30 },
        },
      },
    ).subscribe({
      next: (data) => {
        this.manualDataSyncResult.set(data);
        this.manualDataSyncing.set(false);
        this.loadEvidenceSnapshot();
        this.showMessage('Đã đồng bộ dữ liệu tổng quát từ ERP ở chế độ chỉ đọc', 'success');
      },
      error: (err) => {
        this.manualDataSyncing.set(false);
        this.manualDataSyncError.set('Lỗi đồng bộ dữ liệu tổng quát: ' + (err?.error?.message || err.message));
        this.showMessage('Lỗi đồng bộ dữ liệu tổng quát: ' + (err?.error?.message || err.message), 'error');
      },
    });
  }

  updateBusinessScenario(key: keyof AdsBusinessScenarioInput, value: unknown) {
    this.businessScenario.update((current) => ({
      ...current,
      [key]: this.nonNegativeNumber(value),
    }));
  }

  selectBusinessScenarioProduct(productId: string) {
    const selectedId = String(productId || '');
    this.selectedScenarioProductId.set(selectedId);

    if (!selectedId) {
      this.scenarioProductAppliedLabel.set('Đang dùng dữ liệu nhập tay cho kịch bản.');
      return;
    }

    const product = this.scenarioProducts().find((item) => item._id === selectedId);
    if (!product) {
      this.scenarioProductAppliedLabel.set('Không tìm thấy sản phẩm đã chọn trong danh sách ERP hiện tại.');
      return;
    }

    const inventory = this.scenarioInventory()[selectedId];
    const patch: Partial<AdsBusinessScenarioInput> = {};
    const details: string[] = [];
    const missing: string[] = [];
    const purchaseCost = this.productPurchaseCost(product, inventory);
    const sellingPrice = this.productSellingPrice(product);
    const returnRate = this.nonNegativeFiniteNumber(product.assumedReturnRatePercent);
    const inventoryUnits = this.nonNegativeFiniteNumber(inventory?.onHand);

    if (purchaseCost !== null) {
      patch.purchasePriceVnd = Math.round(purchaseCost);
      details.push(`giá nhập ${this.moneyText(patch.purchasePriceVnd)}`);
    } else {
      missing.push('giá nhập');
    }

    if (sellingPrice !== null) {
      patch.sellingPriceVnd = Math.round(sellingPrice);
      details.push(`giá bán ${this.moneyText(patch.sellingPriceVnd)}`);
    } else {
      missing.push('giá bán');
    }

    if (returnRate !== null) {
      patch.returnRatePercent = this.clamp(returnRate, 0, 95);
      details.push(`hoàn/hủy ${patch.returnRatePercent}%`);
    } else {
      missing.push('tỷ lệ hoàn/hủy');
    }

    if (inventoryUnits !== null) {
      patch.inventoryUnits = Math.round(inventoryUnits);
      details.push(`tồn kho ${patch.inventoryUnits}`);
    } else {
      missing.push('tồn kho thật');
    }

    this.businessScenario.update((current) => ({
      ...current,
      ...patch,
    }));

    const productName = this.scenarioProductLabel(product);
    if (details.length) {
      const missingText = missing.length ? ` Chưa có: ${missing.join(', ')}; các ô đó giữ số nhập tay.` : '';
      this.scenarioProductAppliedLabel.set(
        `Đã lấy dữ liệu từ ${productName}: ${details.join(', ')}.${missingText} Anh vẫn có thể sửa từng ô để thử phương án khác.`,
      );
      return;
    }

    this.scenarioProductAppliedLabel.set(
      `Đã chọn ${productName}, nhưng sản phẩm chưa có đủ giá/chi phí/tồn kho để tự điền; kịch bản đang giữ số nhập tay.`,
    );
  }

  resetBusinessScenario() {
    this.selectedScenarioProductId.set('');
    this.scenarioProductAppliedLabel.set('');
    this.businessScenario.set({
      additionalLoanVnd: 100000000,
      annualInterestRatePercent: 12,
      loanTermMonths: 12,
      purchasePriceVnd: 320000,
      sellingPriceVnd: 520000,
      fulfillmentCostPerOrderVnd: 35000,
      expectedOrdersPerDay: 20,
      returnRatePercent: 8,
      dailyAdsBudgetVnd: 2500000,
      inventoryUnits: 180,
    });
  }

  scenarioProductLabel(product: AdsBusinessScenarioProduct): string {
    return product.sku ? `${product.sku} - ${product.name}` : product.name;
  }

  showMessage(msg: string, type: 'error' | 'success') {
    this.message.set(msg);
    this.messageType.set(type);
    setTimeout(() => this.message.set(''), 5000);
  }

  mappingPercent(item: MappingHealthReadiness): number {
    if (!item.total) return 0;
    return Math.max(0, Math.min(100, Math.round((item.mapped / item.total) * 100)));
  }

  evidenceSnapshotLabel(): string {
    if (this.evidenceLoading()) return 'loading snapshot';
    const snapshot = this.evidenceSnapshot();
    if (!snapshot) return 'snapshot pending';
    return `${snapshot.environment} / ${this.formatEvidenceDate(snapshot.generatedAt)}`;
  }

  evidenceStatusClass(state: string): string {
    const classes: Record<string, string> = {
      allow_scale: 'ready_for_import',
      scale_ready: 'ready_for_import',
      mapped: 'ready_for_import',
      executable: 'ready_for_import',
      cap_only: 'monitor_only',
      hold: 'monitor_only',
      loading: 'monitor_only',
      partial: 'needs_mapping',
      needs_mapping: 'needs_mapping',
      unknown: 'monitor_only',
      block: 'blocked',
      blocked: 'blocked',
      missing: 'blocked',
      conflict: 'blocked',
    };
    return classes[state] || 'monitor_only';
  }

  evidenceStatusLabel(state: string): string {
    const labels: Record<string, string> = {
      allow_scale: 'allow scale',
      scale_ready: 'scale ready',
      mapped: 'mapped',
      executable: 'executable',
      cap_only: 'cap only',
      hold: 'hold',
      loading: 'loading',
      partial: 'partial',
      needs_mapping: 'needs mapping',
      unknown: 'unknown',
      block: 'blocked',
      blocked: 'blocked',
      missing: 'missing',
      conflict: 'conflict',
    };
    return labels[state] || state;
  }

  blockerSeverityLabel(severity: AdsEvidenceSeverity): string {
    return severity;
  }

  manualDataSyncLabel(): string {
    if (this.manualDataSyncing()) return 'đang tính lại dữ liệu';
    const result = this.manualDataSyncResult();
    if (result) return `${result.exportMode} / ${this.formatDateTime(result.generatedAt)}`;
    const requestedAt = this.manualDataSyncLastRequestedAt();
    return requestedAt ? `đã yêu cầu ${this.formatDateTime(requestedAt)}` : 'chưa chạy thủ công';
  }

  sourceCoverageDetail(source: AdsSourceReadinessCoverage): string {
    const latestRecord = source.latestRecordDate || 'chưa có ngày dữ liệu';
    const latestSync = source.lastSuccessfulSyncAt
      ? this.formatDateTime(source.lastSuccessfulSyncAt)
      : 'chưa có sync thành công';
    const blockers = source.blockingReasons.length
      ? `blocker: ${source.blockingReasons.join(', ')}`
      : 'không có blocker';
    return `${latestRecord}; sync ${latestSync}; ${blockers}`;
  }

  moneyText(value: number): string {
    return `${Math.round(value).toLocaleString('vi-VN')} đ`;
  }

  daysOfCoverText(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return 'chưa tính';
    return `${value.toFixed(1)} ngày`;
  }

  businessScenarioDecisionLabel(decision: AdsBusinessScenarioDecision): string {
    const labels: Record<AdsBusinessScenarioDecision, string> = {
      can_test_scale: 'có thể thử scale nhỏ',
      monitor_only: 'chỉ theo dõi',
      hold: 'giữ ngân sách',
      do_not_scale: 'không nên scale',
      needs_data: 'thiếu dữ liệu',
    };
    return labels[decision];
  }

  businessScenarioDecisionShortLabel(decision: AdsBusinessScenarioDecision): string {
    const labels: Record<AdsBusinessScenarioDecision, string> = {
      can_test_scale: 'test scale',
      monitor_only: 'monitor',
      hold: 'hold',
      do_not_scale: 'block',
      needs_data: 'needs data',
    };
    return labels[decision];
  }

  businessScenarioDecisionClass(decision: AdsBusinessScenarioDecision): string {
    const classes: Record<AdsBusinessScenarioDecision, string> = {
      can_test_scale: 'ready_for_import',
      monitor_only: 'monitor_only',
      hold: 'needs_mapping',
      do_not_scale: 'blocked',
      needs_data: 'monitor_only',
    };
    return classes[decision];
  }

  private formatEvidenceDate(value?: string): string {
    if (!value) return 'not generated';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('vi-VN');
  }

  private collectEvidenceBlockers(snapshot: AdsEvidenceSnapshot | null): AdsEvidenceBlocker[] {
    if (!snapshot) return [];
    const blockers = new Map<string, AdsEvidenceBlocker>();
    const addBlocker = (blocker: AdsEvidenceBlocker, source?: string) => {
      const normalized: AdsEvidenceBlocker = {
        ...blocker,
        source: blocker.source || source,
      };
      const key = `${normalized.severity}|${normalized.code}|${normalized.message}|${normalized.source || ''}`;
      blockers.set(key, normalized);
    };

    snapshot.globalBlockers.forEach((blocker) => addBlocker(blocker, 'global'));
    snapshot.adGroups.forEach((group) => {
      const source = group.name || group.erpAdGroupId || group.adGroupId;
      group.blockers.forEach((blocker) => addBlocker(blocker, source));
      group.financeGate.blockers.forEach((blocker) => addBlocker(blocker, source));
      group.adsGate.blockers.forEach((blocker) => addBlocker(blocker, source));
    });

    const severityRank: Record<AdsEvidenceSeverity, number> = { error: 0, warning: 1, info: 2 };
    return Array.from(blockers.values()).sort((a, b) => {
      const severityDelta = severityRank[a.severity] - severityRank[b.severity];
      return severityDelta || a.code.localeCompare(b.code);
    });
  }

  readinessLabel(state: ReadinessState): string {
    const labels: Record<ReadinessState, string> = {
      ready_for_import: 'sẵn sàng nhập dữ liệu',
      needs_mapping: 'cần mapping',
      not_configured: 'chưa cấu hình',
      blocked: 'bị chặn',
      monitor_only: 'chỉ giám sát',
    };
    return labels[state] || state;
  }

  managementModeLabel(mode: ChildAccountReadiness['managementMode']): string {
    const labels: Record<ChildAccountReadiness['managementMode'], string> = {
      mcc: 'MCC',
      bm: 'Business Manager',
      bc: 'Business Center',
    };
    return labels[mode] || mode;
  }

  executionModeLabel(mode: ChildAccountReadiness['executionMode']): string {
    const labels: Record<ChildAccountReadiness['executionMode'], string> = {
      read_only_import: 'chỉ nhập dữ liệu dạng đọc',
      monitor_only: 'chỉ giám sát',
    };
    return labels[mode] || mode;
  }

  safetyFlagLabel(key: string): string {
    const labels: Record<string, string> = {
      production_ready: 'Sẵn sàng chạy thật',
      execution_allowed_now: 'Được phép chạy lúc này',
      real_credential_material_present: 'Có thông tin xác thực thật trong giao diện',
      plaintext_secrets_added: 'Có lưu secret dạng rõ',
      provider_api_used: 'Có dùng API nhà cung cấp',
      provider_api_called: 'Có gọi API nhà cung cấp',
      google_ads_api_used: 'Có dùng Google Ads API',
      google_ads_api_called: 'Có gọi Google Ads API',
      meta_api_used: 'Có dùng Meta API',
      meta_api_called: 'Có gọi Meta API',
      tiktok_api_used: 'Có dùng TikTok API',
      tiktok_api_called: 'Có gọi TikTok API',
      validateOnly_called: 'Đã gọi validateOnly',
      live_ads_execution_used: 'Đã chạy ads thật',
      GOOGLE_ADS_PRODUCTION_ENABLED: 'Cờ GOOGLE_ADS_PRODUCTION_ENABLED',
    };
    return labels[key] || key;
  }

  safetyFlagValueLabel(value: SafetyFlag['value']): string {
    if (value === 'false_or_absent') return 'tắt hoặc chưa khai báo';
    return value ? 'có' : 'không';
  }

  gateKeyLabel(key: string): string {
    const labels: Record<string, string> = {
      approval_required_for_all_drafts: 'Bắt buộc duyệt mọi bản nháp',
      validateOnly_called: 'Đã gọi validateOnly từ nhà cung cấp',
      dry_run_preflight: 'Preflight dry-run',
      idempotency_required: 'Bắt buộc idempotency',
      kill_switch: 'Kill switch',
      production_ready: 'Sẵn sàng chạy thật',
      loss_limits: 'Giới hạn lỗ',
      blocked_action_types: 'Loại hành động bị chặn',
    };
    return labels[key] || key;
  }

  gateValueLabel(value: string): string {
    const labels: Record<string, string> = {
      required_before_execution: 'bắt buộc trước khi thực thi',
      false: 'không',
      required: 'bắt buộc',
      missing_policy: 'thiếu policy',
      'delete/PMax/Shopping/Display/YouTube blocked': 'đã chặn xoá/PMax/Shopping/Display/YouTube',
    };
    return labels[value] || value;
  }

  private parseAdvertiserIds(text: string): string[] {
    return Array.from(new Set(
      String(text || '')
        .split(/[,\n]/)
        .map((item) => item.replace(/[^0-9]/g, '').trim())
        .filter(Boolean)
    ));
  }

  private parseScopes(text: string): string[] {
    return Array.from(new Set(
      String(text || '')
        .split(/[,\n\s]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    ));
  }

  private localDateString(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private dailyDebtService(scenario: AdsBusinessScenarioInput): number {
    const termDays = Math.max(1, scenario.loanTermMonths * 30);
    const principalPerDay = scenario.additionalLoanVnd / termDays;
    const interestPerDay = scenario.additionalLoanVnd * (scenario.annualInterestRatePercent / 100) / 365;
    return principalPerDay + interestPerDay;
  }

  private indexScenarioInventory(rows: AdsBusinessScenarioInventoryRow[]): Record<string, AdsBusinessScenarioInventoryRow> {
    return rows.reduce<Record<string, AdsBusinessScenarioInventoryRow>>((acc, row) => {
      const productId = this.productIdText(row.productId);
      if (productId) {
        acc[productId] = row;
      }
      return acc;
    }, {});
  }

  private reapplySelectedScenarioProduct() {
    const selectedId = this.selectedScenarioProductId();
    if (selectedId) {
      this.selectBusinessScenarioProduct(selectedId);
    }
  }

  private appendScenarioProductError(message: string) {
    const current = this.scenarioProductError();
    this.scenarioProductError.set(current ? `${current} ${message}` : message);
  }

  private productPurchaseCost(
    product: AdsBusinessScenarioProduct,
    inventory?: AdsBusinessScenarioInventoryRow,
  ): number | null {
    const totalCost = this.positiveNumber(product.totalCost);
    if (totalCost !== null) return totalCost;

    const importPrice = this.nonNegativeFiniteNumber(product.importPrice) || 0;
    const shippingCost = this.nonNegativeFiniteNumber(product.shippingCost) || 0;
    const packagingCost = this.nonNegativeFiniteNumber(product.packagingCost) || 0;
    const componentCost = importPrice + shippingCost + packagingCost;
    if (componentCost > 0) return componentCost;

    const supplierCost = this.productSupplierCost(product);
    if (supplierCost !== null) return supplierCost;

    return this.positiveNumber(inventory?.avgCost);
  }

  private productSupplierCost(product: AdsBusinessScenarioProduct): number | null {
    const suppliers = [...(product.suppliers || [])].sort((a, b) => {
      const defaultScore = Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault));
      if (defaultScore) return defaultScore;
      return (b.priority || 0) - (a.priority || 0);
    });

    for (const supplier of suppliers) {
      for (const value of [supplier.appliedPrice, supplier.price1, supplier.price2, supplier.price3]) {
        const cost = this.positiveNumber(value);
        if (cost !== null) return cost;
      }
    }

    return null;
  }

  private productSellingPrice(product: AdsBusinessScenarioProduct): number | null {
    const variations = [...(product.fanpageVariations || [])]
      .filter((variation) => variation.isActive !== false && this.positiveNumber(variation.customPrice) !== null)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    return variations.length ? this.positiveNumber(variations[0].customPrice) : null;
  }

  private nonNegativeNumber(value: unknown): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0;
  }

  private nonNegativeFiniteNumber(value: unknown): number | null {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null;
  }

  private positiveNumber(value: unknown): number | null {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
  }

  private productIdText(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && '_id' in value) {
      return String((value as { _id?: string })._id || '');
    }
    return String(value);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private clearGoogleSecretInputs() {
    this.googleForm.developerToken = '';
    this.googleForm.clientSecret = '';
    this.googleForm.refreshToken = '';
  }

  private clearTikTokSecretInputs() {
    this.tiktokForm.accessToken = '';
    this.tiktokForm.refreshToken = '';
    this.tiktokForm.appSecret = '';
    this.tiktokForm.authCode = '';
  }

  formatDateTime(value?: string): string {
    if (!value) return 'chưa đặt';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('vi-VN');
  }

  testGoogle() {
    if (!this.googleForm.clientId || !this.googleForm.clientSecret || !this.googleForm.refreshToken || !this.googleForm.developerToken) {
      this.showMessage('Nhập đủ các trường xác thực Google Ads bắt buộc trước khi admin kiểm thử', 'error');
      return;
    }
    if (!this.googleForm.testCustomerId) {
      this.showMessage('Nhập Test Customer ID trước khi admin kiểm thử', 'error');
      return;
    }

    this.testingGoogle.set(true);
    this.googleTestResult.set(null);

    this.http.post(`${this.baseUrl}/api-tokens/test/google`, {
      clientId: this.googleForm.clientId,
      clientSecret: this.googleForm.clientSecret,
      refreshToken: this.googleForm.refreshToken,
      developerToken: this.googleForm.developerToken,
      customerId: this.googleForm.testCustomerId,
      loginCustomerId: this.googleForm.loginCustomerId || undefined,
      apiVersion: this.googleForm.apiVersion || undefined
    }).subscribe({
      next: (res: any) => {
        this.googleTestResult.set(res);
        this.testingGoogle.set(false);
        this.clearGoogleSecretInputs();
        this.showMessage(res.ok ? 'Đã kiểm thử Google Ads bằng quyền admin' : `Lỗi: ${res.error || res.message}`, res.ok ? 'success' : 'error');
      },
      error: (err) => {
        this.googleTestResult.set({ error: err?.error?.message || err.message });
        this.testingGoogle.set(false);
        this.clearGoogleSecretInputs();
        this.showMessage('Lỗi kiểm thử Google Ads bằng quyền admin: ' + (err?.error?.message || err.message), 'error');
      }
    });
  }

  saveGoogle() {
    if (!this.googleForm.clientId || !this.googleForm.clientSecret || !this.googleForm.refreshToken || !this.googleForm.developerToken) {
      this.showMessage('Nhập đủ cấu hình Google Ads bắt buộc trước khi lưu', 'error');
      return;
    }

    this.savingGoogle.set(true);
    this.http.post(`${this.baseUrl}/api-tokens/settings/google`, {
      clientId: this.googleForm.clientId,
      clientSecret: this.googleForm.clientSecret,
      refreshToken: this.googleForm.refreshToken,
      developerToken: this.googleForm.developerToken,
      loginCustomerId: this.googleForm.loginCustomerId || undefined,
      apiVersion: this.googleForm.apiVersion || undefined
    }).subscribe({
      next: (res: any) => {
        this.savingGoogle.set(false);
        this.clearGoogleSecretInputs();
        if (res.ok) {
          this.showMessage('Đã lưu cấu hình Google Ads MCC', 'success');
          this.loadSettings();
        } else {
          this.showMessage('Lỗi lưu cấu hình: ' + res.message, 'error');
        }
      },
      error: (err) => {
        this.savingGoogle.set(false);
        this.clearGoogleSecretInputs();
        this.showMessage('Lỗi lưu Google Ads: ' + (err?.error?.message || err.message), 'error');
      }
    });
  }

  testTikTok() {
    if (!this.tiktokForm.testAdvertiserId) {
      this.showMessage('Nhập Test Advertiser ID trước khi admin kiểm thử', 'error');
      return;
    }

    this.testingTikTok.set(true);
    this.tiktokTestResult.set(null);

    this.http.post(`${this.baseUrl}/api-tokens/test/tiktok`, {
      accessToken: this.tiktokForm.accessToken || undefined,
      advertiserId: this.tiktokForm.testAdvertiserId,
      businessCenterId: this.tiktokForm.businessCenterId || undefined,
      appId: this.tiktokForm.appId || undefined,
      appSecret: this.tiktokForm.appSecret || undefined
    }).subscribe({
      next: (res: any) => {
        this.tiktokTestResult.set(res);
        this.testingTikTok.set(false);
        this.clearTikTokSecretInputs();
        this.showMessage(res.ok ? 'Đã kiểm thử TikTok bằng quyền admin' : `Lỗi: ${res.error || res.message}`, res.ok ? 'success' : 'error');
      },
      error: (err) => {
        this.tiktokTestResult.set({ error: err?.error?.message || err.message });
        this.testingTikTok.set(false);
        this.clearTikTokSecretInputs();
        this.showMessage('Lỗi kiểm thử TikTok bằng quyền admin: ' + (err?.error?.message || err.message), 'error');
      }
    });
  }

  exchangeTikTokAuthCode() {
    if (!this.tiktokForm.appId || !this.tiktokForm.appSecret || !this.tiktokForm.authCode) {
      this.showMessage('Nhập App ID, App Secret và Auth Code trước khi exchange', 'error');
      return;
    }

    this.exchangingTikTok.set(true);
    this.tiktokTestResult.set(null);

    this.http.post(`${this.baseUrl}/api-tokens/tiktok/oauth/exchange`, {
      appId: this.tiktokForm.appId,
      appSecret: this.tiktokForm.appSecret,
      authCode: this.tiktokForm.authCode,
      businessCenterId: this.tiktokForm.businessCenterId || undefined,
      businessCenterName: this.tiktokForm.businessCenterName || undefined,
      testAdvertiserId: this.tiktokForm.testAdvertiserId || undefined,
      advertiserIds: this.parseAdvertiserIds(this.tiktokForm.advertiserIdsText),
      save: true,
    }).subscribe({
      next: (res: any) => {
        this.exchangingTikTok.set(false);
        this.clearTikTokSecretInputs();
        if (res?.ok) {
          this.tiktokTestResult.set({
            ...res,
            accessToken: res.accessTokenStored ? 'đã lưu trong ERP và đã ẩn' : undefined,
          });
          this.tiktokForm.accessTokenExpiresAt = res.accessTokenExpiresAt || this.tiktokForm.accessTokenExpiresAt;
          this.tiktokForm.refreshTokenExpiresAt = res.refreshTokenExpiresAt || this.tiktokForm.refreshTokenExpiresAt;
          this.tiktokForm.scopesText = (res.scopes || []).join(', ');
          this.tiktokForm.grantedAdvertiserIdsText = (res.authorizedAdvertisers || [])
            .map((item: any) => item.advertiserId)
            .join(',');
          const mergedAdvertiserIds = Array.from(new Set([
            ...this.parseAdvertiserIds(this.tiktokForm.advertiserIdsText),
            ...((res.advertiserIds || []) as string[]),
          ]));
          this.tiktokForm.advertiserIdsText = mergedAdvertiserIds.join(',');
          this.showMessage('Đã đổi TikTok auth code và lưu siêu dữ liệu đã ẩn', 'success');
          this.loadSettings();
        } else {
          this.tiktokTestResult.set(res);
          this.showMessage('Lỗi exchange TikTok auth code: ' + (res?.error || res?.message || 'lỗi không xác định'), 'error');
        }
      },
      error: (err) => {
        this.exchangingTikTok.set(false);
        this.clearTikTokSecretInputs();
        this.tiktokTestResult.set({ error: err?.error?.message || err.message });
        this.showMessage('Lỗi exchange TikTok auth code: ' + (err?.error?.message || err.message), 'error');
      }
    });
  }

  saveTikTok() {
    if (!this.tiktokForm.accessToken && !this.settings()?.tiktok?.hasAccessToken) {
      this.showMessage('Nhập Access Token hoặc exchange Auth Code trước khi lưu', 'error');
      return;
    }

    this.savingTikTok.set(true);
    this.http.post(`${this.baseUrl}/api-tokens/settings/tiktok`, {
      accessToken: this.tiktokForm.accessToken || undefined,
      refreshToken: this.tiktokForm.refreshToken || undefined,
      appId: this.tiktokForm.appId || undefined,
      appSecret: this.tiktokForm.appSecret || undefined,
      authCode: this.tiktokForm.authCode || undefined,
      redirectUri: this.tiktokForm.redirectUri || undefined,
      businessCenterId: this.tiktokForm.businessCenterId || undefined,
      businessCenterName: this.tiktokForm.businessCenterName || undefined,
      testAdvertiserId: this.tiktokForm.testAdvertiserId || undefined,
      advertiserIds: this.parseAdvertiserIds(this.tiktokForm.advertiserIdsText),
      grantedAdvertiserIds: this.parseAdvertiserIds(this.tiktokForm.grantedAdvertiserIdsText),
      scopes: this.parseScopes(this.tiktokForm.scopesText),
      accessTokenExpiresAt: this.tiktokForm.accessTokenExpiresAt || undefined,
      refreshTokenExpiresAt: this.tiktokForm.refreshTokenExpiresAt || undefined,
    }).subscribe({
      next: (res: any) => {
        this.savingTikTok.set(false);
        this.clearTikTokSecretInputs();
        if (res.ok) {
          this.showMessage('Đã lưu cấu hình TikTok Business Center', 'success');
          this.loadSettings();
        } else {
          this.showMessage('Lỗi lưu TikTok: ' + res.message, 'error');
        }
      },
      error: (err) => {
        this.savingTikTok.set(false);
        this.clearTikTokSecretInputs();
        this.showMessage('Lỗi lưu TikTok: ' + (err?.error?.message || err.message), 'error');
      }
    });
  }

  testSync(platform: 'facebook' | 'google' | 'tiktok') {
    this.syncing.set(true);
    this.syncResult.set('');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);

    this.http.post(`${this.baseUrl}/advertising-cost/fetch/${platform}?date=${dateStr}`, {}).subscribe({
      next: (res: any) => {
        this.syncing.set(false);
        const results = Array.isArray(res) ? res : [res];
        const summary = results.map((r: any) => `${r.date}: ${r.updated || 0} nhóm quảng cáo`).join(', ');
        this.syncResult.set(`Đã đồng bộ chỉ đọc. ${summary}`);
        this.showMessage(`Đã đồng bộ ${platform} cho ngày ${dateStr}`, 'success');
      },
      error: (err) => {
        this.syncing.set(false);
        this.syncResult.set(`Lỗi: ${err?.error?.message || err.message}`);
        this.showMessage('Lỗi đồng bộ: ' + (err?.error?.message || err.message), 'error');
      }
    });
  }
}
