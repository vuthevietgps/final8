import { AdsSettings, ActiveTab, ProviderKey, ReadinessState, ManagerAccountReadiness, AdsManagerRegistryManager, AdsManagerRegistrySummary, CredentialReadiness, ChildAccountReadiness, ImportScheduleReadiness, GoogleAdsSyncRun, MappingHealthReadiness, SafetyGateReadiness, AuditEvidence, SafetyFlag, AdsEvidenceSeverity, AdsEvidenceBlocker, AdsEvidenceAdGroup, AdsEvidenceSnapshot, PersistedAdsEvidenceSnapshot, EvidenceSummaryCard, EvidenceDrilldownLink, AdsSourceReadinessSafety, AdsSourceReadinessSummary, AdsSourceReadinessCoverage, AdsSourceReadinessBlockerReview, AdsSourceReadinessReviewExport, AdsBusinessScenarioInput, AdsBusinessScenarioDecision, AdsBusinessScenarioResult, AdsBusinessScenarioProductVariation, AdsBusinessScenarioProductSupplier, AdsBusinessScenarioProduct, AdsBusinessScenarioInventoryRow, AdsBusinessScenarioInventorySummary } from './ads-settings.types';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-ads-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ads-settings.component.html',
  styleUrl: './ads-settings.component.css'
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
