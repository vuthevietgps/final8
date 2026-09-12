import {
  AiOperatorContextRoute,
  AiOperatorIntent,
  AiOperatorRecommendation,
  AiOperatorScenarioContext,
  AiOperatorSnapshot,
} from "./ai-operator.interfaces";
import {
  AI_TOKEN_MANAGEMENT_GUIDE,
  buildAiOperatorKnowledge,
  ERP_API_CATALOG,
  ROLE_PLAYBOOKS,
} from "./ai-operator.knowledge";
import {
  isAdGroupProfitClassificationRequest,
  isAdsDiagnosticChecklistRequest,
  intentFromTextOrRole,
} from "./ai-operator.intent";
import { buildBusinessFactAnswer } from "./ai-operator.business-facts";
import {
  asArray,
  formatMoney,
  formatPercent,
  removeVietnameseTone,
} from "./ai-operator.format";

export function buildRuleBasedAnswer(
  message: string,
  snapshot: AiOperatorSnapshot,
  recommendations: AiOperatorRecommendation[],
  knowledge: ReturnType<typeof buildAiOperatorKnowledge>,
  role?: string,
  route?: AiOperatorContextRoute,
): string {
  const normalized = removeVietnameseTone(message).toLowerCase();
  const inferredIntent = route?.intent || intentFromTextOrRole(message, role);
  if (BUSINESS_FACT_INTENTS.includes(inferredIntent)) {
    return buildBusinessFactAnswer(message, snapshot, inferredIntent);
  }
  if (
    inferredIntent === "ad_group_profit_classification" ||
    isAdGroupProfitClassificationRequest(normalized)
  ) {
    return buildAdGroupProfitClassificationAnswer(snapshot);
  }
  if (
    inferredIntent === "ads_diagnostic_checklist" ||
    isAdsDiagnosticChecklistRequest(normalized)
  ) {
    return buildAdsDiagnosticChecklistAnswer(snapshot);
  }
  if (
    normalized.includes("token") ||
    normalized.includes("api key") ||
    normalized.includes("openai")
  ) {
    return buildTokenManagementAnswer();
  }
  if (
    normalized.includes("api") ||
    normalized.includes("endpoint") ||
    normalized.includes("erp")
  ) {
    return buildApiCatalogAnswer();
  }
  if (
    [
      "free_cash_summary",
      "cashflow_forecast",
      "ads_budget_cashflow_gate",
      "advanced_cashflow_scenario",
      "scenario_analysis",
      "owner_withdrawal_readiness",
      "unit_economics",
    ].includes(inferredIntent)
  ) {
    return buildCfoDecisionContractAnswer(
      snapshot,
      recommendations,
      inferredIntent,
    );
  }
  if (
    [
      "marketing_funnel_health",
      "creative_fatigue_review",
      "offer_performance_review",
      "channel_mix_review",
      "channel_profitability_review",
      "resource_allocation_decision",
      "product_decision_review",
      "ads_scale_readiness",
      "ads_kill_or_pause_recommendation",
      "lead_quality_by_campaign",
      "attribution_quality_check",
    ].includes(inferredIntent)
  ) {
    return buildMarketingOptimizationContractAnswer(
      snapshot,
      recommendations,
      inferredIntent,
    );
  }
  if (inferredIntent === "sales_sla_task_creation") {
    return buildSalesSlaTaskCreationAnswer(snapshot);
  }
  if (
    inferredIntent === "decision_waiting_approval" ||
    inferredIntent === "ai_recommendation_review"
  ) {
    return buildDecisionWaitingApprovalAnswer(snapshot, recommendations);
  }
  if (
    [
      "company_kpi_scorecard",
      "target_gap_analysis",
      "period_comparison",
    ].includes(inferredIntent)
  ) {
    return buildCompanyKpiScorecardAnswer(snapshot, recommendations);
  }
  if (
    [
      "director_daily_overview",
      "director_weekly_priority",
      "business_risk_ranking",
      "root_cause_analysis",
      "anomaly_detection_daily",
      "priority_ranking",
      "owner_accountability_review",
      "concise_role_briefing",
    ].includes(inferredIntent)
  ) {
    return buildDirectorOverviewAnswer(snapshot, recommendations);
  }
  if (inferredIntent === "finance") {
    return buildFinanceAnswer(snapshot, recommendations);
  }
  if (inferredIntent === "receivables") {
    return buildReceivablesAnswer(snapshot, recommendations);
  }
  if (inferredIntent === "ads") {
    return buildAdsAnswer(snapshot, recommendations);
  }
  if (inferredIntent === "orders") {
    return buildOrdersAnswer(snapshot);
  }
  if (
    inferredIntent === "sales" ||
    inferredIntent === "customer_value_analysis"
  ) {
    return buildSalesAnswer(snapshot);
  }
  if (inferredIntent === "supplier") {
    return buildSupplierAnswer(snapshot);
  }
  if (inferredIntent === "operations") {
    return buildOperationsAnswer(snapshot, recommendations);
  }
  if ((inferredIntent === "overview" || inferredIntent === "loose") && role) {
    return buildRoleDecisionAnswer(role, snapshot, recommendations, knowledge);
  }
  if (
    normalized.includes("tinh huong") ||
    normalized.includes("van hanh") ||
    normalized.includes("giam doc") ||
    normalized.includes("quan ly") ||
    normalized.includes("sale") ||
    normalized.includes("ke toan") ||
    normalized.includes("ads")
  ) {
    return buildRoleDecisionAnswer(role, snapshot, recommendations, knowledge);
  }
  if (normalized.includes("lead") || normalized.includes("sale")) {
    return [
      "Hien snapshot backend chua co module leads rieng de ket luan sale nao dang bo sot lead.",
      "Can noi them nguon lead hoac map lead tu chat-message/pending-order truoc khi AI cham SLA sale chinh xac.",
    ].join("\n");
  }

  const top = recommendations.slice(0, 5);
  if (!top.length) {
    return [
      "Hom nay chua thay canh bao lon tu cac nguon du lieu doc duoc.",
      "AI da doc tai chinh, ads, don hang va cong no; phan lead/invoice rieng chua co module ro trong backend hien tai.",
    ].join("\n");
  }

  return [
    "Ket luan ngan: Co viec can xem theo du lieu ERP hien co.",
    `Du lieu da doc: ${loadedSourceSummary(snapshot)}.`,
    `Phan tich tinh huong: He thong tim thay ${recommendations.length} khuyen nghi trong ky ${snapshot.windowDays} ngay.`,
    "Viec can lam:",
    ...top.map((item) => `- ${item.title}: ${item.proposedAction}`),
    `Rui ro/thieu du lieu: ${snapshot.dataGaps.length ? snapshot.dataGaps.join(" | ") : "chua thay canh bao thieu du lieu lon trong snapshot."}`,
    "Can duyet: Chua co hanh dong nao duoc thuc hien; moi thao tac tai chinh/ads/payment van can nguoi duyet.",
  ].join("\n");
}

export function buildCompanyKpiScorecardAnswer(
  snapshot: AiOperatorSnapshot,
  recommendations: AiOperatorRecommendation[],
): string {
  const facts = snapshot.businessFacts?.data;
  const today = facts?.productProfit?.today?.totals || {};
  const yesterday = facts?.productProfit?.yesterday?.totals || {};
  const monthToDate = facts?.productProfit?.monthToDate?.totals || {};
  const dashboard = snapshot.finance.dashboard.data;
  const adsClassification = snapshot.ads.profitClassification?.data;
  const topIssues = recommendations.slice(0, 5);
  const targetRevenue = Number(facts?.targets?.monthRevenue || 0);
  const targetProgress =
    targetRevenue > 0
      ? `${formatPercent((Number(monthToDate.totalRevenue || 0) / targetRevenue) * 100)} muc tieu thang`
      : "chua co target doanh thu thang trong snapshot";

  return [
    "Ket luan: KPI cong ty can doc theo doanh thu, loi nhuan, dong tien va ads/order risk cung luc.",
    `Hom nay: doanh thu ${formatMoney(today.totalRevenue || 0)}, loi nhuan ${formatMoney(today.netProfit || 0)}, don hoan tat ${today.totalOrders || 0}.`,
    `Hom qua: doanh thu ${formatMoney(yesterday.totalRevenue || 0)}, loi nhuan ${formatMoney(yesterday.netProfit || 0)}, don hoan tat ${yesterday.totalOrders || 0}.`,
    `Thang nay: doanh thu ${formatMoney(monthToDate.totalRevenue || 0)}, loi nhuan ${formatMoney(monthToDate.netProfit || 0)}, don hoan tat ${monthToDate.totalOrders || 0}; tien do muc tieu: ${targetProgress}.`,
    `Dong tien: free cash ${formatMoney(dashboard?.freeCash || 0)}, committed cash ${formatMoney(dashboard?.committedCash || 0)}, runway ${dashboard?.runwayMonths == null ? "N/A" : `${Number(dashboard.runwayMonths).toFixed(1)} thang`}.`,
    `Ads: ${adsClassification?.summary ? `lai ${adsClassification.summary.profitable || 0}, lo ${adsClassification.summary.loss || 0}, chua du du lieu ${adsClassification.summary.insufficientData || 0}` : "chua co phan loai lai/lo nhom quang cao trong snapshot"}.`,
    "Viec can lam:",
    ...(topIssues.length
      ? topIssues.map((item) => `- ${item.title}: ${item.proposedAction}`)
      : ["- Chua co khuyen nghi uu tien cao tu snapshot hien tai."]),
    `Rui ro/thieu du lieu: ${dataGapSummary(snapshot)}`,
    "Can duyet: Neu can thay doi ngan sach ads, tao batch thanh toan, rut owner hoac sua gia/quote thi phai tao de xuat cho duyet truoc.",
  ].join("\n");
}

export function buildDecisionWaitingApprovalAnswer(
  snapshot: AiOperatorSnapshot,
  recommendations: AiOperatorRecommendation[],
): string {
  const approvals = recommendations
    .filter((item) => item.requiresApproval)
    .slice(0, 8);
  const financeActions = asArray(snapshot.finance.actions?.data?.actions).slice(
    0,
    5,
  );
  const marketingPlans = asArray(
    snapshot.strategic.aiMarketingPlans?.data?.plans ||
      snapshot.strategic.aiMarketingPlans?.data,
  ).slice(0, 5);
  const marketingEvaluations = asArray(
    snapshot.strategic.aiMarketingEvaluations?.data?.evaluations ||
      snapshot.strategic.aiMarketingEvaluations?.data,
  ).slice(0, 5);
  const opsActions = asArray(
    snapshot.operations?.data?.suggestions ||
      snapshot.operations?.data?.actions ||
      snapshot.operations?.data,
  ).slice(0, 5);
  const totalSignals =
    approvals.length +
    financeActions.length +
    marketingPlans.length +
    marketingEvaluations.length +
    opsActions.length;

  const lines = [
    `Ket luan: ${totalSignals ? `Co ${totalSignals} tin hieu/de xuat can xem truoc khi duyet.` : "Chua thay hang doi phe duyet ro trong snapshot hien tai."}`,
    "Danh sach uu tien:",
    ...(approvals.length
      ? approvals.map(
          (item) =>
            `- ${item.title}: ${item.reason}. De xuat: ${item.proposedAction}`,
        )
      : ["- Chua co recommendation requiresApproval trong snapshot."]),
  ];

  if (financeActions.length) {
    lines.push(
      `Financial actions: ${financeActions
        .map((item: any) => item.title || item.type || item.action || item.id)
        .filter(Boolean)
        .join("; ")}.`,
    );
  }
  if (marketingPlans.length || marketingEvaluations.length) {
    lines.push(
      `AI marketing cho duyet: plans=${marketingPlans.length}, evaluations=${marketingEvaluations.length}.`,
    );
  }
  if (opsActions.length) {
    lines.push(
      `Ops suggestions: ${opsActions
        .map((item: any) => item.title || item.type || item.id)
        .filter(Boolean)
        .join("; ")}.`,
    );
  }

  lines.push(`Rui ro/thieu du lieu: ${dataGapSummary(snapshot)}`);
  lines.push(
    "Can duyet: AI chi tong hop. Approved/executed chi duoc noi khi co executor/audit log thanh cong.",
  );
  return lines.join("\n");
}

export function buildCfoDecisionContractAnswer(
  snapshot: AiOperatorSnapshot,
  recommendations: AiOperatorRecommendation[],
  intent: AiOperatorIntent,
): string {
  const dashboard = snapshot.finance.dashboard.data;
  const forecast = snapshot.finance.forecast.data;
  const budgetPreview = snapshot.strategic.budgetPreview.data;
  const availableFunds = snapshot.strategic.availableFunds.data?.latest;
  const freeCash = Number(
    dashboard?.freeCash ?? availableFunds?.available ?? 0,
  );
  const lowPoint = Number(forecast?.lowPoint ?? dashboard?.freeCash ?? 0);
  const blockedByCash =
    freeCash <= 0 ||
    lowPoint < 0 ||
    budgetPreview?.systemLocked ||
    budgetPreview?.globalStatus === "blocked";
  const paymentPriorities = recommendations
    .filter(
      (item) =>
        item.type.includes("finance") ||
        item.type.includes("loan") ||
        item.type.includes("supplier") ||
        item.type.includes("agent"),
    )
    .slice(0, 4);

  return [
    `Ket luan: ${blockedByCash ? "Chua nen duyet hanh dong chi tien/tang ads." : "Co the lap de xuat co kiem soat, nhung van can phe duyet."}`,
    `cashStatus: ${blockedByCash ? "tight" : "safe"}.`,
    `freeCash: ${formatMoney(freeCash)}.`,
    `forecastRisk: diem tien thap nhat ${formatMoney(lowPoint)}; budget gate ${budgetPreview?.systemLocked ? "dang khoa" : "chua khoa"}.`,
    `allowedActions: ${blockedByCash ? "chi sua du lieu, thu hoi cong no, giam chi bat buoc" : "co the tao draft tang ads/rut/chi tien trong gioi han rule"}.`,
    `blockedActions: ${blockedByCash ? "tang ngan sach ads, rut owner fund, tra them khoan khong bat buoc" : "khong co hanh dong bi chan boi fallback hien tai"}.`,
    "paymentPriorities:",
    ...(paymentPriorities.length
      ? paymentPriorities.map(
          (item) => `- ${item.title}: ${item.proposedAction}`,
        )
      : ["- Chua co uu tien thanh toan tu snapshot."]),
    `risks: ${dataGapSummary(snapshot)}`,
    "Can duyet: Moi thay doi ngan sach ads/rut owner/tra no/tao batch thanh toan phai tao draft action va approval request truoc khi executor goi API that.",
    `Intent: ${intent}.`,
  ].join("\n");
}

export function buildMarketingOptimizationContractAnswer(
  snapshot: AiOperatorSnapshot,
  recommendations: AiOperatorRecommendation[],
  intent: AiOperatorIntent,
): string {
  const classification = snapshot.ads.profitClassification.data;
  const groups = asArray(classification?.groups);
  const profitableGroups = groups
    .filter((item: any) => item.status === "profitable")
    .slice(0, 5);
  const lossGroups = groups
    .filter((item: any) => item.status === "loss")
    .slice(0, 5);
  const marketing =
    snapshot.manager?.marketing?.data ||
    snapshot.strategic.aiMarketingOverview.data ||
    {};
  const costPerOrder = snapshot.ads.costPerOrder.data;
  const budgetPreview =
    snapshot.strategic.budgetPreview.data ||
    snapshot.manager?.budgetPreview?.data;
  const financeGateAllowed = !(
    budgetPreview?.systemLocked || budgetPreview?.globalStatus === "blocked"
  );
  const creativeIssues = asArray(
    marketing.creativeIssues || marketing.creatives?.issues || marketing.alerts,
  ).slice(0, 5);
  const funnelBottlenecks = asArray(
    marketing.bottlenecks ||
      marketing.funnel?.bottlenecks ||
      marketing.overview?.bottlenecks,
  ).slice(0, 5);
  const salesIssues = recommendations
    .filter(
      (item) => item.type.includes("conversation") || item.type.includes("sla"),
    )
    .slice(0, 4);
  const scaleCandidates = recommendations
    .filter(
      (item) => item.type.includes("increase") || item.type.includes("scale"),
    )
    .slice(0, 5);
  const pauseCandidates = recommendations
    .filter(
      (item) =>
        item.type.includes("kill") ||
        item.type.includes("loss") ||
        item.type.includes("pause"),
    )
    .slice(0, 5);
  const cpoText =
    costPerOrder?.summary?.blendedCostPerOrder == null
      ? "N/A"
      : formatMoney(costPerOrder.summary.blendedCostPerOrder);
  const funnelBottleneckText = funnelBottlenecks.length
    ? JSON.stringify(funnelBottlenecks).slice(0, 500)
    : `chua co bottleneck ro; CPO ${cpoText}`;

  return [
    `Ket luan: ${financeGateAllowed ? "Co the phan tich toi uu marketing, nhung scale van phai qua CFO gate." : "Marketing khong duoc scale vi finance gate dang chan."}`,
    `profitableGroups: ${profitableGroups.length}; lossGroups: ${lossGroups.length}; watchGroups: ${groups.length - profitableGroups.length - lossGroups.length}.`,
    `scaleCandidates: ${scaleCandidates.length ? scaleCandidates.map((item) => item.title).join("; ") : "chua co ung vien scale du manh"}.`,
    `pauseCandidates: ${pauseCandidates.length ? pauseCandidates.map((item) => item.title).join("; ") : "chua co ung vien pause duoc xac nhan"}.`,
    `creativeIssues: ${creativeIssues.length ? JSON.stringify(creativeIssues).slice(0, 500) : "chua co creative issue ro trong snapshot"}.`,
    `funnelBottlenecks: ${funnelBottleneckText}.`,
    `salesIssues: ${salesIssues.length ? salesIssues.map((item) => item.title).join("; ") : "chua co SLA sale issue ro trong snapshot"}.`,
    `financeGate: allowed=${financeGateAllowed}; reason=${budgetPreview?.recommendation || budgetPreview?.globalStatus || "khong thay block tu budget preview"}.`,
    "recommendedActions:",
    ...(recommendations.slice(0, 5).length
      ? recommendations
          .slice(0, 5)
          .map((item) => `- ${item.title}: ${item.proposedAction}`)
      : ["- Bo sung funnel/creative/offer data truoc khi ra quyet dinh manh."]),
    `Rui ro/thieu du lieu: ${dataGapSummary(snapshot)}`,
    `Intent: ${intent}.`,
  ].join("\n");
}

export function buildSalesSlaTaskCreationAnswer(
  snapshot: AiOperatorSnapshot,
): string {
  const conversations = snapshot.manager?.conversations?.data || {};
  const pendingOrders = snapshot.manager?.pendingOrders?.data || {};
  const needsHuman = Number(
    conversations.needsHuman || conversations.needsHumanCount || 0,
  );
  const awaitingOrder = Number(
    conversations.awaitingOrder || conversations.awaitingOrderCount || 0,
  );
  const pendingRows = asArray(pendingOrders.recentPending).slice(0, 10);
  const draftCount = Math.max(needsHuman + awaitingOrder, pendingRows.length);

  return [
    "proposedAction: Tao task nhap cho sale xu ly lead/hoi thoai qua SLA.",
    "entity: lead/conversation/pending-order.",
    `beforeState: needsHuman=${needsHuman}; awaitingOrder=${awaitingOrder}; pendingRows=${pendingRows.length}.`,
    `afterState: ${draftCount} task nhap cho duyet, chua giao viec that.`,
    "reason: Lead qua han/chua goi lam giam ty le chot va khong duoc dung de ket luan ads loi neu sale SLA dang vi pham.",
    "expectedImpact: Giam lead bo sot va tach ro trach nhiem sale truoc khi quy ket cho marketing.",
    `risks: ${dataGapSummary(snapshot)}`,
    "requiredApproval: manager approve draft task truoc khi assign.",
    "status: draft.",
  ].join("\n");
}

export function buildRoleDecisionAnswer(
  role: string | undefined,
  snapshot: AiOperatorSnapshot,
  recommendations: AiOperatorRecommendation[],
  knowledge: ReturnType<typeof buildAiOperatorKnowledge>,
): string {
  const normalizedRole = removeVietnameseTone(role || "").toLowerCase();
  if (
    normalizedRole.includes("director") ||
    normalizedRole.includes("giam doc")
  ) {
    return buildDirectorOverviewAnswer(snapshot, recommendations);
  }
  if (
    normalizedRole.includes("account") ||
    normalizedRole.includes("cfo") ||
    normalizedRole.includes("ke toan")
  ) {
    return buildAccountantOverviewAnswer(snapshot, recommendations);
  }
  if (
    normalizedRole.includes("manager") ||
    normalizedRole.includes("quan ly")
  ) {
    return buildManagerOverviewAnswer(snapshot, recommendations);
  }
  if (normalizedRole.includes("ads")) {
    return buildAdsAnswer(snapshot, recommendations);
  }
  if (normalizedRole.includes("sale") || normalizedRole.includes("agent")) {
    return buildSalesAnswer(snapshot);
  }
  if (
    normalizedRole.includes("supplier") ||
    normalizedRole.includes("nha cung cap")
  ) {
    return buildSupplierAnswer(snapshot);
  }
  return buildRolePlaybookAnswer(role, knowledge);
}

export function buildDirectorOverviewAnswer(
  snapshot: AiOperatorSnapshot,
  recommendations: AiOperatorRecommendation[],
): string {
  const dashboard = snapshot.finance.dashboard.data;
  const forecast = snapshot.finance.forecast.data;
  const top = recommendations.slice(0, 5);
  const availableFunds = snapshot.strategic.availableFunds.data?.latest;
  const loanDashboard = snapshot.strategic.loanDashboard.data;
  const budgetPreview = snapshot.strategic.budgetPreview.data;
  const ownerFund = snapshot.strategic.ownerFund.data;
  const laborCashflow = snapshot.strategic.laborCashflow.data;
  const otherCostCashflow = snapshot.strategic.otherCostCashflow.data;
  const financeStatus = dashboard
    ? `free cash ${formatMoney(dashboard.freeCash)}, committed 14 ngay ${formatMoney(dashboard.committedCash)}, runway ${dashboard.runwayMonths == null ? "khong gioi han neu burn=0" : `${Number(dashboard.runwayMonths).toFixed(1)} thang`}`
    : "chua doc duoc Financial Control dashboard";
  const forecastLine = forecast
    ? `diem tien thap nhat 7 ngay ${formatMoney(forecast.lowPoint)} tai T+${forecast.lowPointDay}`
    : "chua doc duoc forecast 7 ngay";
  const cashDepth = [
    availableFunds
      ? `available conservative ${formatMoney(availableFunds.available || 0)}`
      : "available funds chua doc duoc",
    loanDashboard
      ? `no den han 14 ngay ${formatMoney(loanDashboard.due14Days || 0)}`
      : "loan dashboard chua doc duoc",
    budgetPreview
      ? `ads dry-run locked=${budgetPreview.systemLocked ? "co" : "khong"}`
      : "budget preview chua doc duoc",
    ownerFund
      ? `owner fund balance ${formatMoney(ownerFund.totalBalance || 0)}`
      : "owner fund chua doc duoc",
  ].join("; ");
  const commitments = `luong outstanding ${formatMoney(laborCashflow?.summary?.outstanding || 0)}, chi phi khac outstanding ${formatMoney(otherCostCashflow?.summary?.outstanding || 0)}`;

  return [
    `Ket luan ngan: Giam doc nen xem dong tien truoc, sau do moi den ads/cong no.`,
    `Du lieu da doc: ${loadedSourceSummary(snapshot)}.`,
    `Phan tich tinh huong: ${financeStatus}; ${forecastLine}; ${cashDepth}; ${commitments}.`,
    "Viec can lam:",
    ...(top.length
      ? top.map((item) => `- ${item.title}: ${item.proposedAction}`)
      : ["- Chua co khuyen nghi uu tien cao tu snapshot hien tai."]),
    `Rui ro/thieu du lieu: ${dataGapSummary(snapshot)}`,
    "Can duyet: Rut owner, tra no, tao batch thanh toan, tang/giam/tat ads that deu can xac nhan ro ID, so tien/pham vi va nguoi duyet.",
  ].join("\n");
}

export function buildAccountantOverviewAnswer(
  snapshot: AiOperatorSnapshot,
  recommendations: AiOperatorRecommendation[],
): string {
  const finance = buildFinanceAnswer(snapshot, recommendations);
  const receivables = buildReceivablesAnswer(snapshot, recommendations);
  return [
    "Ket luan ngan: Ke toan/CFO nen uu tien dong tien that, cong no den han va chung tu truoc khi ghi nhan thanh toan.",
    finance,
    receivables,
  ].join("\n");
}

export function buildManagerOverviewAnswer(
  snapshot: AiOperatorSnapshot,
  recommendations: AiOperatorRecommendation[],
): string {
  const operations = snapshot.operations.data;
  const actions = asArray(
    operations?.actions || operations?.items || operations,
  );
  const orders = snapshot.orders.data;
  const employeeKpi = snapshot.manager?.employeeKpi?.data;
  const tokenHealth = snapshot.manager?.tokenHealth?.data;
  const syncHealth = snapshot.ads.syncHealth?.data;
  const budgetPreview =
    snapshot.manager?.budgetPreview?.data ||
    snapshot.strategic.budgetPreview.data;
  const costPerOrder = snapshot.ads.costPerOrder?.data;
  const marketing = snapshot.manager?.marketing?.data;
  const conversations = snapshot.manager?.conversations?.data;
  const pendingOrders = snapshot.manager?.pendingOrders?.data;
  const managerRecommendations = recommendations
    .filter(
      (item) =>
        item.type.startsWith("manager.") ||
        item.type.startsWith("ops.") ||
        item.type.startsWith("ads.") ||
        item.type.includes("budget") ||
        item.type.includes("order"),
    )
    .slice(0, 6);
  const kpiLine = employeeKpi?.summary
    ? `KPI Ads: ${employeeKpi.summary.employeeCount || 0} nhan vien, ${employeeKpi.summary.underperformerCount || 0} under KPI, ${employeeKpi.summary.criticalAlerts || 0} alert critical`
    : "KPI Ads: chua doc duoc employee KPI";
  const tokenLine = tokenHealth?.summary
    ? `Token: ${tokenHealth.summary.activeTokens || 0}/${tokenHealth.summary.totalTokens || 0} active, failing ${tokenHealth.summary.failing || 0}, expiring ${tokenHealth.summary.expiringSoon || 0}`
    : "Token: chua doc duoc api-token health";
  const syncLine = syncHealth?.summary
    ? `Sync: ${syncHealth.summary.okPlatforms || 0}/${syncHealth.summary.platforms || 0} platform ok, stale ${syncHealth.summary.stalePlatforms || 0}, token issue ${syncHealth.summary.tokenIssues || 0}`
    : "Sync: chua doc duoc ads sync health";
  const cpoLine = costPerOrder?.summary
    ? `CPO: blended ${costPerOrder.summary.blendedCostPerOrder == null ? "N/A" : formatMoney(costPerOrder.summary.blendedCostPerOrder)}, no-order-spend ${costPerOrder.summary.noOrdersWithSpend || 0}`
    : "CPO: chua doc duoc cost/order";
  const marketingReadiness =
    marketing?.overview?.readiness?.status ||
    snapshot.strategic.aiMarketingOverview.data?.readiness?.status ||
    "chua co";
  const cashGate = budgetPreview?.systemLocked
    ? "budget/cashflow gate dang khoa scale"
    : budgetPreview?.summary
      ? `budget dry-run ok ${budgetPreview.summary.successCount || 0}, skipped ${budgetPreview.summary.skippedCount || 0}`
      : "chua doc duoc budget dry-run";
  const orderLine = orders
    ? `${orders.totalInWindow || 0} don trong ky, supplier pending ${orders.pendingPayments?.supplierPending || 0}, agent pending ${orders.pendingPayments?.agentPending || 0}`
    : "chua doc duoc order snapshot";
  const conversationLine = conversations
    ? `needs human ${conversations.needsHuman || 0}, awaiting order ${conversations.awaitingOrder || 0}, pending snapshot ${asArray(pendingOrders?.recentPending).length}`
    : "chua doc duoc conversation snapshot";

  return [
    "Ket luan ngan: Manager nen chot viec nong theo thu tu: cash/budget gate, ads/KPI, token-sync, order/SLA.",
    `Du lieu da doc: ${loadedSourceSummary(snapshot)}.`,
    `Phan tich tinh huong: ${cashGate}; ${kpiLine}; ${tokenLine}; ${syncLine}; ${cpoLine}; AI Marketing readiness ${marketingReadiness}; orders ${orderLine}; conversations ${conversationLine}; ops actions ${actions.length || 0}.`,
    "Viec can lam:",
    ...(managerRecommendations.length
      ? managerRecommendations.map(
          (item) => `- ${item.title}: ${item.proposedAction}`,
        )
      : [
          "- Chot owner cho ops actions/ads alerts dang mo.",
          "- Soat nhan vien Ads under KPI hoac qua tai truoc khi gan them ad group.",
          "- Kiem tra token/sync health neu so lieu ads/fanpage bat thuong.",
        ]),
    `Rui ro/thieu du lieu: ${dataGapSummary(snapshot)}`,
    "Can duyet: Bulk assign ad group, pause/scale ads, validate/rotate token, approve pending order va bat/tat auto-AI hoi thoai can xac nhan ro ID/pham vi.",
  ].join("\n");
}

export function buildReceivablesAnswer(
  snapshot: AiOperatorSnapshot,
  recommendations: AiOperatorRecommendation[],
): string {
  const receivables = snapshot.receivables.data;
  if (!receivables) {
    return [
      "Ket luan ngan: Chua doc duoc cong no NCC/dai ly.",
      `Du lieu da doc: ${loadedSourceSummary(snapshot)}.`,
      "Phan tich tinh huong: Thieu supplier-payable/agent-receivable lam cac quyet dinh chi tien va free cash co the sai.",
      "Viec can lam: Nap lai source cong no, kiem tra permission va doi chieu statement dang mo.",
      "Rui ro/thieu du lieu: Can nap supplier-payable/agent-receivable context truoc khi ket luan cong no.",
      "Can duyet: Khong tao batch/dong statement/ghi nhan payment khi chua co danh sach statement va tong tien.",
    ].join("\n");
  }

  const supplierOpen = receivables.supplier?.open || {};
  const agentOpen = receivables.agent?.open || {};
  const supplierOverdue = asArray(receivables.supplier?.overdue);
  const agentOverdue = asArray(receivables.agent?.overdue);
  const receivableRecommendations = recommendations.filter(
    (item) =>
      item.type.includes("supplier") ||
      item.type.includes("agent") ||
      item.type.includes("receivable") ||
      item.type.includes("payable"),
  );

  return [
    "Ket luan ngan: Can soat cong no qua han va statement dang mo truoc khi ra quyet dinh chi tien.",
    `Du lieu da doc: NCC open ${supplierOpen.count || 0} khoan, balance ${formatMoney(supplierOpen.balance || 0)}; dai ly open ${agentOpen.count || 0} statement, balance ${formatMoney(agentOpen.closingBalance || 0)}.`,
    `Phan tich tinh huong: NCC qua han ${supplierOverdue.length}; dai ly qua han ${agentOverdue.length}.`,
    "Viec can lam:",
    ...(receivableRecommendations.length
      ? receivableRecommendations
          .slice(0, 5)
          .map((item) => `- ${item.title}: ${item.proposedAction}`)
      : [
          "- Kiem tra statement qua han, doi chieu chung tu va xac nhan owner phu trach tung khoan.",
        ]),
    `Rui ro/thieu du lieu: ${dataGapSummary(snapshot)}`,
    "Can duyet: Tao/dong statement, ghi nhan payment, batch thanh toan lon va rollback cong no can nguoi duyet.",
  ].join("\n");
}

export function buildOrdersAnswer(snapshot: AiOperatorSnapshot): string {
  const orders = snapshot.orders.data;
  if (!orders) {
    return [
      "Ket luan ngan: Chua doc duoc order snapshot, nen chua ket luan duoc don hang.",
      `Du lieu da doc: ${loadedSourceSummary(snapshot)}.`,
      "Phan tich tinh huong: Thieu order context lam ROI, cong no va pending payment co the lech.",
      "Viec can lam: Kiem tra source orders/test-order2 va permission truoc khi chot van hanh.",
      `Rui ro/thieu du lieu: ${dataGapSummary(snapshot)}`,
      "Can duyet: Khong sua trang thai/gia/payment hang loat khi chua co danh sach don va nguoi duyet.",
    ].join("\n");
  }
  const pending = orders.pendingPayments || {};
  const statuses = asArray(orders.byStatus)
    .slice(0, 5)
    .map((item: any) => `${item._id}: ${item.count}`)
    .join(", ");
  return [
    `Ket luan ngan: Co ${orders.totalInWindow || 0} don trong ky ${snapshot.windowDays} ngay can theo doi.`,
    `Du lieu da doc: status top ${statuses || "khong co"}; payment pending supplier ${pending.supplierPending || 0}, agent ${pending.agentPending || 0}.`,
    "Phan tich tinh huong: Neu pending payment cao, dong tien/loi nhuan realized co the bi lech so voi bao cao uoc tinh.",
    "Viec can lam: Soat don tre, don thieu tracking, don pending payment va cac don loi nhuan am truoc khi chot bao cao.",
    `Rui ro/thieu du lieu: ${dataGapSummary(snapshot)}`,
    "Can duyet: Sua tien/gia/supplier/agent/trang thai thanh toan hang loat can xac nhan va audit.",
  ].join("\n");
}

export function buildOperationsAnswer(
  snapshot: AiOperatorSnapshot,
  recommendations: AiOperatorRecommendation[],
): string {
  const operations = snapshot.operations.data;
  const actions = asArray(
    operations?.actions || operations?.items || operations,
  );
  const top = recommendations
    .filter(
      (item) => item.type.startsWith("ops.") || item.type.includes("operation"),
    )
    .slice(0, 5);
  return [
    "Ket luan ngan: Viec van hanh nen uu tien cac task anh huong cashflow, SLA chat/order va ads alert.",
    `Du lieu da doc: ${loadedSourceSummary(snapshot)}; ops actions ${actions.length || 0}.`,
    `Phan tich tinh huong: ${actions.length ? "Da co danh sach viec ops can xu ly." : "Chua co action ops ro trong snapshot."}`,
    "Viec can lam:",
    ...(top.length
      ? top.map((item) => `- ${item.title}: ${item.proposedAction}`)
      : actions
          .slice(0, 5)
          .map(
            (item: any) =>
              `- ${item.title || item.name || item.type || "Viec can xu ly"}: ${item.description || item.reason || "kiem tra chi tiet trong module ops"}`,
          )),
    actions.length || top.length
      ? ""
      : "- Mo Ops Actions/Ads Alerts de chot owner va deadline.",
    `Rui ro/thieu du lieu: ${dataGapSummary(snapshot)}`,
    "Can duyet: Task co tac dong tai chinh, token, budget, payment hoac xoa/sua du lieu can phe duyet.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildSalesAnswer(snapshot: AiOperatorSnapshot): string {
  const orders = snapshot.orders.data;
  const totalOrders = orders?.totalInWindow || 0;
  return [
    "Ket luan ngan: Sale co the xem don/pending order, nhung module lead doc lap chua du manh de cham SLA sale 9+.",
    `Du lieu da doc: ${loadedSourceSummary(snapshot)}; don trong ky ${totalOrders}.`,
    "Phan tich tinh huong: Neu lead nam trong chat-message/pending-order thi AI co the ho tro nhac viec; neu lead o nguon khac thi chua du context.",
    "Viec can lam: Uu tien hoi thoai chua co so dien thoai, pending order chua chot, don thieu thong tin khach va san pham thieu gia/media.",
    `Rui ro/thieu du lieu: ${dataGapSummary(snapshot)}`,
    "Can duyet: Doi gia, doi supplier, sua hoa hong hoặc tao don bat thuong can nguoi phu trach xac nhan.",
  ].join("\n");
}

export function buildSupplierAnswer(snapshot: AiOperatorSnapshot): string {
  const orders = snapshot.orders.data;
  const returns = snapshot.returns?.data;
  return [
    "Ket luan ngan: Tro ly supplier nen chi doc va goi y trong pham vi don cua supplier, khong xem tai chinh toan cong ty.",
    `Du lieu da doc: ${loadedSourceSummary(snapshot)}; don trong ky ${orders?.totalInWindow || 0}; don hoan ${returns?.summary?.returnOrders || 0}.`,
    "Phan tich tinh huong: Nen uu tien don tre san xuat/giao hang, don thieu tracking, don hoan va phieu return can cap nhat ly do.",
    "Viec can lam: Cap nhat tracking/trang thai, ghi chu don loi, va bao ops khi co khieu nai hoac lech COD.",
    `Rui ro/thieu du lieu: ${dataGapSummary(snapshot)}`,
    "Can duyet: Supplier khong tu sua gia, payment, statement hoac don cua supplier khac.",
  ].join("\n");
}

export function loadedSourceSummary(snapshot: AiOperatorSnapshot): string {
  const sources = [
    ["bảng điều khiển tài chính", snapshot.finance.dashboard],
    ["dự báo dòng tiền", snapshot.finance.forecast],
    ["hành động tài chính", snapshot.finance.actions],
    ["hiệu suất quảng cáo", snapshot.ads.performance],
    ["phân loại lãi/lỗ nhóm quảng cáo", snapshot.ads.profitClassification],
    ["gợi ý quảng cáo", snapshot.ads.optimalSpendSuggestions],
    ["cảnh báo quảng cáo", snapshot.ads.alerts],
    ["chẩn đoán quảng cáo", snapshot.ads.diagnostic],
    ["sức khỏe đồng bộ quảng cáo", snapshot.ads.syncHealth],
    ["chi phí quảng cáo theo nhóm quảng cáo", snapshot.ads.costByAdGroup],
    ["chi phí quảng cáo trên mỗi đơn", snapshot.ads.costPerOrder],
    ["đơn hàng", snapshot.orders],
    ["hàng hoàn", snapshot.returns],
    ["công nợ phải thu", snapshot.receivables],
    ["vận hành", snapshot.operations],
    ["KPI nhân viên quảng cáo", snapshot.manager?.employeeKpi],
    ["sức khỏe token quảng cáo", snapshot.manager?.tokenHealth],
    ["ngữ cảnh marketing của quản lý", snapshot.manager?.marketing],
    ["hội thoại của quản lý", snapshot.manager?.conversations],
    ["đơn chờ xử lý của quản lý", snapshot.manager?.pendingOrders],
    ["ngữ cảnh media của quản lý", snapshot.manager?.media],
    ["thực thể quảng cáo của quản lý", snapshot.manager?.adEntities],
    ["tổng quan quỹ", snapshot.strategic.fundsOverview],
    ["vốn khả dụng", snapshot.strategic.availableFunds],
    ["xem trước ngân sách", snapshot.strategic.budgetPreview],
    ["bảng khoản vay", snapshot.strategic.loanDashboard],
    ["quỹ chủ sở hữu", snapshot.strategic.ownerFund],
    ["dòng tiền lương", snapshot.strategic.laborCashflow],
    ["dòng tiền chi phí khác", snapshot.strategic.otherCostCashflow],
    ["dòng tiền chi phí quảng cáo", snapshot.strategic.adsCostCashflow],
    ["tổng quan AI marketing", snapshot.strategic.aiMarketingOverview],
    ["kế hoạch AI marketing", snapshot.strategic.aiMarketingPlans],
    ["đánh giá AI marketing", snapshot.strategic.aiMarketingEvaluations],
    ["mức sẵn sàng báo giá", snapshot.strategic.quoteReadiness],
    ["kiểm toán truy cập", snapshot.strategic.accessAudit],
  ];
  const loaded = sources
    .filter(([, result]: any) => result?.ok && result?.data)
    .map(([name]) => name);
  const failed = sources
    .filter(([, result]: any) => result && result.ok === false)
    .map(([name]) => name);
  const chunks = [
    loaded.length ? `đã tải: ${loaded.join(", ")}` : "đã tải: chưa có",
  ];
  if (failed.length) chunks.push(`lỗi tải: ${failed.join(", ")}`);
  return chunks.join("; ");
}

export function dataGapSummary(snapshot: AiOperatorSnapshot): string {
  return snapshot.dataGaps.length
    ? snapshot.dataGaps.join(" | ")
    : "chua thay data gap lon trong snapshot hien tai.";
}

export function buildPermissionDeniedAnswer(
  context: AiOperatorScenarioContext,
): string {
  const route = context.route;
  const permissions = context.auth.permissions.length
    ? context.auth.permissions.join(", ")
    : "khong co permission nghiep vu";
  const denied = route.deniedSources?.length
    ? route.deniedSources.join(", ")
    : "workflow/API context";
  return [
    `Backend da nhan dien intent "${route.intent}"${route.scenarioId ? ` theo workflow ${route.scenarioId}` : ""}, nhung user hien tai khong du quyen doc du lieu can thiet.`,
    `Role: ${context.auth.role || "unknown"}; permissions: ${permissions}.`,
    `Nguon bi chan: ${denied}.`,
    "AI khong duoc dien giai hoac suy doan tren du lieu ma backend khong cho phep. Hay dung tai khoan co quyen phu hop hoac cap permission cho module lien quan.",
  ].join("\n");
}

export function buildApiCatalogAnswer(): string {
  const lines = [
    `AI da nhan dien ${ERP_API_CATALOG.length} nhom ERP API chinh can biet khi dieu hanh he thong:`,
    ...ERP_API_CATALOG.map((item) => {
      const read = item.readEndpoints.slice(0, 3).join(", ");
      const write = item.writeEndpoints.slice(0, 2).join(", ");
      return `- ${item.domain}: ${item.purpose} Doc: ${read}. Ghi: ${write}.`;
    }),
    "Mac dinh AI Operator chi doc/tom tat/de xuat. Cac API ghi nhu tao batch, rotate token, apply budget, rut owner can xac nhan ro ID, pham vi va nguoi duyet.",
  ];
  return lines.join("\n");
}

export function buildRolePlaybookAnswer(
  role?: string,
  knowledge?: ReturnType<typeof buildAiOperatorKnowledge>,
): string {
  const normalizedRole = String(role || "")
    .trim()
    .toLowerCase();
  const playbooks = normalizedRole
    ? ROLE_PLAYBOOKS.filter(
        (item) =>
          item.role === normalizedRole ||
          item.title.toLowerCase().includes(normalizedRole),
      )
    : ROLE_PLAYBOOKS;
  const selected = playbooks.length ? playbooks : ROLE_PLAYBOOKS;
  const workflows = (knowledge?.scenarioWorkflows || []).slice(0, 8);

  return [
    "Cac tinh huong van hanh thuong gap theo vai tro:",
    ...selected
      .slice(0, 6)
      .map((playbook) =>
        [
          `- ${playbook.title}: ${playbook.summary}`,
          `  Cau hoi moi ngay: ${playbook.dailyQuestions.slice(0, 3).join(" | ")}`,
          `  Tinh huong: ${playbook.frequentScenarios.slice(0, 3).join(" | ")}`,
        ].join("\n"),
      ),
    workflows.length ? "Workflow/API tuong ung:" : "",
    ...workflows.map((workflow) =>
      [
        `- ${workflow.scenarioId} ${workflow.title}: ${workflow.goal}`,
        `  Doc: ${workflow.readApis.slice(0, 3).join(", ")}`,
        `  Ghi sau duyet: ${workflow.writeApis.slice(0, 3).join(", ") || "khong ghi"}`,
        `  Muc du API: ${workflow.apiSufficiency}; gap: ${workflow.missingDataOrApi.slice(0, 2).join(" | ") || "khong ro"}`,
      ].join("\n"),
    ),
    "AI nen dung playbook nay de hoi lai khi thieu du lieu va khong tu thuc thi thao tac rui ro cao.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildTokenManagementAnswer(): string {
  return [
    "Quan ly AI API token trong he thong nen di theo OpenAI Config, khong tron voi token ads/social.",
    `- ${AI_TOKEN_MANAGEMENT_GUIDE.aiTokenRoutes[0].route}: tao/sua/test OpenAI API key, model, prompt, scope va config mac dinh cho AI.`,
    `- ${AI_TOKEN_MANAGEMENT_GUIDE.aiTokenRoutes[1].route}: quan ly Meta/Google/TikTok token cho sync ads va fanpage.`,
    `- ${AI_TOKEN_MANAGEMENT_GUIDE.aiTokenRoutes[2].route}: cau hinh credential sync ads theo platform.`,
    "Guardrail: khong hien full key/token trong danh sach, khong dua secret vao prompt, rotate key production phai co owner/ly do/thoi diem.",
  ].join("\n");
}

export function buildAdGroupProfitClassificationAnswer(
  snapshot: AiOperatorSnapshot,
): string {
  const report = snapshot.ads.profitClassification?.data;
  if (!report) {
    return [
      "Tôi chưa tải được báo cáo phân loại lãi/lỗ nhóm quảng cáo.",
      `Dữ liệu đã đọc: ${loadedSourceSummary(snapshot)}.`,
      "Cần bổ sung hoặc tải lại nguồn `ads.ad-group-profit-classification` từ API `GET /api/ads/ad-groups/profit-classification?days=7`.",
      "Hiện chưa có hành động cần duyệt vì đây mới là yêu cầu kiểm tra, chưa yêu cầu chỉnh ads.",
    ].join("\n");
  }

  const statusLabel: Record<string, string> = {
    profitable: "Lãi",
    loss: "Lỗ",
    break_even: "Hòa vốn",
    insufficient_data: "Chưa đủ dữ liệu",
  };
  const groups = asArray(report.groups);
  const tableRows = groups
    .slice(0, 20)
    .map((group: any) => [
      group.name || group.adGroupId || "Không rõ",
      group.platform || "-",
      formatMoney(group.spend || 0),
      String(group.leads || 0),
      String(group.orders || 0),
      formatMoney(group.revenue || 0),
      group.netProfitAfterAds == null
        ? "N/A"
        : formatMoney(group.netProfitAfterAds),
      statusLabel[group.status] || group.status || "Không rõ",
      group.reason || "-",
    ]);
  const scalable = groups
    .filter((group: any) => group.status === "profitable")
    .sort(
      (a: any, b: any) =>
        (b.netProfitAfterAds || 0) - (a.netProfitAfterAds || 0),
    )
    .slice(0, 5);
  const reduceOrPause = groups
    .filter((group: any) => group.status === "loss")
    .sort(
      (a: any, b: any) =>
        (a.netProfitAfterAds || 0) - (b.netProfitAfterAds || 0),
    )
    .slice(0, 5);
  const insufficient = groups
    .filter((group: any) => group.status === "insufficient_data")
    .slice(0, 5);
  const listNames = (items: any[]) =>
    items
      .map((item: any) => item.name || item.adGroupId)
      .filter(Boolean)
      .join(", ") || "không có";

  return [
    `Tôi kiểm tra trong ${report.periodDays || snapshot.windowDays} ngày gần nhất.`,
    "",
    `Tổng số nhóm quảng cáo đọc được: ${report.total || 0} nhóm.`,
    "",
    "Phân loại:",
    `- Lãi: ${report.summary?.profitable || 0} nhóm`,
    `- Lỗ: ${report.summary?.loss || 0} nhóm`,
    `- Hòa vốn: ${report.summary?.breakEven || 0} nhóm`,
    `- Chưa đủ dữ liệu: ${report.summary?.insufficientData || 0} nhóm`,
    "",
    "Bảng chi tiết:",
    "| Nhóm | Nền tảng | Spend | Lead | Đơn | Doanh thu | Lợi nhuận sau ads | Trạng thái | Lý do |",
    "|---|---:|---:|---:|---:|---:|---:|---|---|",
    ...tableRows.map((row) => `| ${row.join(" | ")} |`),
    groups.length > tableRows.length
      ? `| ... còn ${groups.length - tableRows.length} nhóm khác | | | | | | | | |`
      : "",
    "",
    "Kết luận:",
    `- Nhóm có thể xem xét tăng: ${listNames(scalable)}.`,
    `- Nhóm cần giảm/pause hoặc kiểm tra lại: ${listNames(reduceOrPause)}.`,
    `- Nhóm chưa đủ dữ liệu: ${listNames(insufficient)}.`,
    "",
    `Dữ liệu thiếu/chất lượng dữ liệu: ${asArray(report.dataQuality?.notes).length ? report.dataQuality.notes.join(" | ") : "chưa thấy cảnh báo lớn trong báo cáo phân loại."}`,
    "Cần duyệt: hiện chưa có hành động cần duyệt vì người dùng mới yêu cầu kiểm tra, chưa yêu cầu chỉnh ads.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function buildAdsDiagnosticChecklistAnswer(
  snapshot: AiOperatorSnapshot,
): string {
  const diagnostic = snapshot.ads.diagnostic?.data;
  if (!diagnostic) {
    return [
      "Kết luận ngắn: Chưa tải được gói chẩn đoán quảng cáo, nên chưa thể trả lời đủ 10 mục bằng số liệu thật.",
      `Dữ liệu đã đọc: ${loadedSourceSummary(snapshot)}.`,
      `Rủi ro/thiếu dữ liệu: ${dataGapSummary(snapshot)}`,
      "Cần làm: tải lại nguồn ads.diagnostic-overview hoặc cấp quyền đọc ad-accounts, ad-groups, fanpages, advertising-costs, chat-messages, pending-orders và ads-budget.",
      "Cần duyệt: chưa có hành động tăng/giảm ngân sách hay gọi provider nào được thực hiện.",
    ].join("\n");
  }

  const dateText = (value: any) => {
    if (!value) return "chưa có dữ liệu";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? "chưa có dữ liệu"
      : parsed.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  };
  const yesNoUnknown = (value: any) =>
    value === true ? "có" : value === false ? "không" : "chưa rõ";
  const listNames = (items: any[], nameKey = "name", limit = 5) => {
    const names = asArray(items)
      .slice(0, limit)
      .map(
        (item: any) =>
          item?.[nameKey] ||
          item?.adGroupName ||
          item?.accountName ||
          item?.pageId ||
          item?.adGroupId ||
          item?.accountId,
      )
      .filter(Boolean);
    return names.length ? names.join(", ") : "không có";
  };
  const listSpend = (items: any[], labelKey = "adGroupName", limit = 5) => {
    const rows = asArray(items)
      .slice(0, limit)
      .map((item: any) => {
        const label =
          item?.[labelKey] ||
          item?.adGroupName ||
          item?.accountName ||
          item?.adGroupId ||
          item?.accountId ||
          "unknown";
        return `${label}: ${formatMoney(item?.spent || 0)}`;
      });
    return rows.length ? rows.join("; ") : "không có";
  };
  const listProfit = (items: any[], limit = 5) => {
    const rows = asArray(items)
      .slice(0, limit)
      .map((item: any) => {
        const label =
          item?.adGroupName || item?.name || item?.adGroupId || "unknown";
        return `${label}: doanh thu ${formatMoney(item?.totalRevenue || 0)}, lợi nhuận ${formatMoney(item?.totalNetProfit || 0)}`;
      });
    return rows.length ? rows.join("; ") : "không có";
  };
  const readinessLabel = (item: any) => {
    const statusMap: Record<string, string> = {
      not_ready: "chưa đủ điều kiện",
      pending_approval: "đề xuất chờ duyệt",
      ready_review: "đủ dữ liệu, cần rà soát",
    };
    const label = item?.adGroupName || item?.adGroupId || "unknown";
    return `${label}: ${statusMap[item?.status] || item?.status || "chưa rõ"} (${item?.reason || "không có lý do"})`;
  };

  const accounts = diagnostic.accounts || {};
  const fanpages = diagnostic.fanpages || {};
  const sync = diagnostic.sync || {};
  const entities = diagnostic.entities || {};
  const spend7d = diagnostic.spend7d || {};
  const leads = diagnostic.leads || {};
  const attribution = diagnostic.attribution || {};
  const profit = diagnostic.profit || {};
  const pnl = diagnostic.pnl || {};
  const readiness = diagnostic.readiness || {};
  const missingData = asArray(diagnostic.missingData);
  const tokenSummary = accounts.tokenSummary || {};
  const syncSummary = sync.summary || {};
  const readinessItems = asArray(readiness.items);

  return [
    `Kết luận ngắn: Đã kiểm tra checklist quảng cáo theo cửa sổ ${diagnostic.windowDays || snapshot.windowDays} ngày. Tổng spend là ${formatMoney(spend7d.totalSpent || 0)}; đề xuất chờ duyệt ${readiness.summary?.pendingApproval || 0}; chưa đủ điều kiện ${readiness.summary?.notReady || 0}.`,
    "1. Kết nối tài khoản quảng cáo:",
    `- Đã kiểm tra: có. Tài khoản: ${accounts.total || 0} tổng, ${accounts.active || 0} active. Token còn hạn/hợp lệ: ${yesNoUnknown(accounts.tokenValid)}; active token ${tokenSummary.activeTokens ?? "chưa rõ"}/${tokenSummary.totalTokens ?? "chưa rõ"}, expired ${tokenSummary.expired ?? "chưa rõ"}, failing ${tokenSummary.failing ?? "chưa rõ"}. Lỗi provider: ${accounts.providerErrorCount || 0}; mẫu lỗi: ${listNames(accounts.providerErrors, "source", 3)}.`,
    "2. Fanpage:",
    `- Fanpage đã kết nối: ${fanpages.total || 0}; active: ${fanpages.active || 0}. Fanpage active: ${listNames(fanpages.activePages, "name", 6)}. Thiếu quyền/webhook/token: ${fanpages.missingPermissionCount || 0}; mẫu: ${listNames(fanpages.missingPermissions, "name", 5)}.`,
    "3. Đồng bộ dữ liệu:",
    `- Lần sync gần nhất: ${dateText(sync.lastSyncAt)}. Facebook lỗi: ${yesNoUnknown(sync.hasFacebookError)}; Google lỗi: ${yesNoUnknown(sync.hasGoogleError)}. Sync health: ok ${syncSummary.okPlatforms ?? "chưa rõ"}/${syncSummary.platforms ?? "chưa rõ"}, stale ${syncSummary.stalePlatforms ?? "chưa rõ"}, token issue ${syncSummary.tokenIssues ?? "chưa rõ"}. Log lỗi: ${listNames(sync.errorLogs, "source", 5)}.`,
    "4. Campaign/adset/ad:",
    `- Campaign active suy từ ad group: ${entities.campaigns?.activeInferred || 0}/${entities.campaigns?.totalInferred || 0}. Adset/ad group active: ${entities.adsets?.active || 0}/${entities.adsets?.total || 0}. Ads active: chưa đếm được vì chưa có collection Ads/Creative riêng. Campaign/adset paused/error: ${entities.adsets?.pausedOrError || 0}; mẫu: ${listNames(entities.adsets?.pausedOrErrorItems, "name", 5)}.`,
    "5. Spend 7 ngày:",
    `- Tổng spend: ${formatMoney(spend7d.totalSpent || 0)}; records ${spend7d.records || 0}, impressions ${spend7d.impressions || 0}, clicks ${spend7d.clicks || 0}, conversations ${spend7d.conversations || 0}. Theo tài khoản: ${listSpend(spend7d.byAccount, "accountName", 5)}. Theo nhóm quảng cáo: ${listSpend(spend7d.byAdGroup, "adGroupName", 5)}.`,
    "6. Lead/inbox/form:",
    `- Lead suy từ unique sender/inbox: ${leads.leadCount || 0}; inbox message: ${leads.inboxCount || 0}; form: chưa có module/Form API riêng; pending order: ${leads.pendingOrders || 0}. Lead chưa xử lý: ${leads.unhandledLeadCount || 0} gồm needsHuman ${leads.needsHuman || 0}, awaiting message ${leads.awaitingMessages || 0}, draft/awaiting order ${(leads.pendingByStatus?.draft || 0) + (leads.pendingByStatus?.awaiting || 0)}.`,
    "7. Lead gắn ERP:",
    `- Lead/conversation đã gắn khách/đơn hoặc pending-order: ${attribution.linkedToErp || 0}. Chưa attribution được: ${attribution.unattributed || 0}; conversation có ad group: ${attribution.conversationsWithAdGroup || 0}.`,
    "8. Doanh thu/lợi nhuận theo nhóm quảng cáo:",
    `- Nhóm có doanh thu: ${asArray(profit.groupsWithRevenue).length}; ${listProfit(profit.groupsWithRevenue, 5)}. Nhóm có lợi nhuận dương: ${asArray(profit.groupsWithProfit).length}; ${listProfit(profit.groupsWithProfit, 5)}. Nhóm chưa có dữ liệu profit/order: ${asArray(profit.groupsWithoutData).length}; ${listNames(profit.groupsWithoutData, "name", 5)}.`,
    "9. Nhóm lỗ/lãi:",
    `- Nhóm lãi: ${asArray(pnl.winning).length}; ${listProfit(pnl.winning, 5)}. Nhóm lỗ: ${asArray(pnl.losing).length}; ${listProfit(pnl.losing, 5)}. Nhóm chưa đủ dữ liệu: ${asArray(pnl.insufficientData).length}; ${listNames(pnl.insufficientData, "name", 5)}.`,
    "10. Đủ điều kiện tăng/giảm ngân sách chưa:",
    `- Quy tắc đang dùng: spend = 0 thì chưa đủ điều kiện; thiếu lead/profit thì chưa đủ điều kiện; đủ dữ liệu thì chỉ tạo đề xuất chờ duyệt, không tự apply provider. Kết quả: kiểm tra ${readiness.summary?.totalChecked || 0} nhóm, chưa đủ điều kiện ${readiness.summary?.notReady || 0}, đề xuất chờ duyệt ${readiness.summary?.pendingApproval || 0}, đủ dữ liệu cần rà soát ${readiness.summary?.readyReview || 0}. Mẫu: ${readinessItems.slice(0, 8).map(readinessLabel).join("; ") || "không có"}.`,
    `Rủi ro/thiếu dữ liệu: ${missingData.length ? missingData.join(" | ") : dataGapSummary(snapshot)}`,
    "Cần duyệt: Chưa có hành động tăng/giảm ngân sách, pause ads hoặc gọi provider nào được thực hiện.",
  ].join("\n");
}

export function buildAdsAnswer(
  snapshot: AiOperatorSnapshot,
  recommendations: AiOperatorRecommendation[],
): string {
  const adsRecommendations = recommendations.filter((item) =>
    item.type.startsWith("ads."),
  );
  const performance = asArray(snapshot.ads.performance.data);
  const losingCount = performance.filter(
    (ad: any) =>
      (ad.totalAdsSpent || 0) > 0 &&
      ((ad.totalNetProfit || 0) < 0 || (ad.roi || 0) < 50),
  ).length;
  const budgetPreview = snapshot.strategic.budgetPreview.data;
  const marketingOverview = snapshot.strategic.aiMarketingOverview.data;
  const adsCost = snapshot.strategic.adsCostCashflow.data;
  const syncHealth = snapshot.ads.syncHealth?.data;
  const costPerOrder = snapshot.ads.costPerOrder?.data;
  const cashGate = budgetPreview?.systemLocked
    ? "bi khoa boi budget/cashflow gate"
    : budgetPreview?.summary
      ? `dry-run allocation ${budgetPreview.summary.successCount || 0} ok, ${budgetPreview.summary.skippedCount || 0} skipped`
      : "chua doc duoc budget allocation dry-run";
  const syncLine = syncHealth?.summary
    ? `sync ${syncHealth.summary.okPlatforms || 0}/${syncHealth.summary.platforms || 0} ok, stale ${syncHealth.summary.stalePlatforms || 0}, token issue ${syncHealth.summary.tokenIssues || 0}`
    : "sync health chua co";
  const cpoLine = costPerOrder?.summary
    ? `CPO blended ${costPerOrder.summary.blendedCostPerOrder == null ? "N/A" : formatMoney(costPerOrder.summary.blendedCostPerOrder)}, no-order-spend ${costPerOrder.summary.noOrdersWithSpend || 0}`
    : "CPO chua co";

  if (!adsRecommendations.length) {
    return [
      `Ket luan ngan: Chua thay nhom quang cao lo ro trong ${snapshot.windowDays} ngay gan nhat tu du lieu doc duoc.`,
      `Du lieu da doc: ${loadedSourceSummary(snapshot)}.`,
      `Phan tich tinh huong: Cashflow gate ${cashGate}; ads spend ${formatMoney(adsCost?.summary?.spent || 0)}; ${syncLine}; ${cpoLine}; AI marketing readiness ${marketingOverview?.readiness?.status || "chua co"}.`,
      "Viec can lam:",
      "- Tiep tuc theo doi ROI, net profit, spend va chat luong lead truoc khi scale.",
      `Rui ro/thieu du lieu: ${dataGapSummary(snapshot)}`,
      "Can duyet: Moi thay doi ngan sach, pause/kill/scale va apply provider that deu can approval ro ID, muc tien va pham vi.",
    ].join("\n");
  }

  return [
    `Ket luan ngan: Co ${losingCount} nhom quang cao can xem trong ${snapshot.windowDays} ngay gan nhat.`,
    `Du lieu da doc: ${loadedSourceSummary(snapshot)}.`,
    `Phan tich tinh huong: Cashflow gate ${cashGate}; ads spend ${formatMoney(adsCost?.summary?.spent || 0)}; ${syncLine}; ${cpoLine}; leads/orders ROI marketing ${formatMoney(marketingOverview?.summary?.netProfit || 0)} net profit.`,
    "Viec can lam:",
    ...adsRecommendations
      .slice(0, 5)
      .map(
        (item) =>
          `- ${item.title}: ${item.reason} De xuat: ${item.proposedAction}`,
      ),
    `Rui ro/thieu du lieu: ${dataGapSummary(snapshot)}`,
    "Can duyet: Cac thay doi ads that van can buoc duyet, gioi han tang/giam va dry-run provider truoc khi apply.",
  ].join("\n");
}

export function buildFinanceAnswer(
  snapshot: AiOperatorSnapshot,
  recommendations: AiOperatorRecommendation[],
): string {
  const dashboard = snapshot.finance.dashboard.data;
  const forecast = snapshot.finance.forecast.data;
  const financeActions = asArray(snapshot.finance.actions.data?.actions);
  const financeRecommendations = recommendations.filter((item) =>
    item.type.startsWith("finance."),
  );
  const dataQuality = dashboard?.dataQuality;
  const receivables = snapshot.receivables.data;
  const availableFunds = snapshot.strategic.availableFunds.data?.latest;
  const fundsOverview = snapshot.strategic.fundsOverview.data;
  const loanDashboard = snapshot.strategic.loanDashboard.data;
  const laborCashflow = snapshot.strategic.laborCashflow.data;
  const otherCostCashflow = snapshot.strategic.otherCostCashflow.data;
  const budgetPreview = snapshot.strategic.budgetPreview.data;

  if (!dashboard) {
    return [
      "Ket luan ngan: Chua doc duoc Financial Control dashboard, nen khong duoc ket luan an toan dong tien.",
      `Du lieu da doc: ${loadedSourceSummary(snapshot)}.`,
      "Phan tich tinh huong: Thieu dashboard tai chinh lam moi quyet dinh rut tien, tra no hoac scale ads co rui ro cao.",
      "Viec can lam: Nap lai financial-control dashboard va kiem tra cac source bi failed/permission_denied truoc khi ra quyet dinh.",
      `Rui ro/thieu du lieu: ${dataGapSummary(snapshot)}`,
      "Can duyet: Khong duoc rut owner, tang ads budget hoac ghi nhan payment khi dashboard tai chinh chua doc duoc.",
    ].join("\n");
  }

  const lines = [
    `Ket luan ngan: ${dataQuality?.isDecisionLocked ? "Tam khoa quyet dinh rui ro cao vi chat luong du lieu chua du." : "Co the danh gia dong tien dua tren dashboard hien tai."}`,
    `Du lieu da doc: bank balance ${formatMoney(dashboard.bankBalance)}, free cash ${formatMoney(dashboard.freeCash)}, committed 14 ngay ${formatMoney(dashboard.committedCash)}, monthly burn ${formatMoney(dashboard.monthlyBurn)}, debt ${formatMoney(dashboard.totalDebtOutstanding || 0)}.`,
    `Phan tich tinh huong: runway ${dashboard.runwayMonths == null ? "khong gioi han neu burn = 0" : `${Number(dashboard.runwayMonths).toFixed(1)} thang`}; owner withdrawable ${formatMoney(dashboard.ownerWithdrawable || 0)}; ads budget approved 7 ngay ${formatMoney(dashboard.adsBudgetApproved || 0)}.`,
  ];

  if (forecast) {
    lines.push(
      `Forecast: diem thap nhat 7 ngay ${formatMoney(forecast.lowPoint)} vao T+${forecast.lowPointDay}; cash crunch=${forecast.isCashCrunch ? "co" : "khong"}; survival risk=${forecast.isSurvivalRisk ? "co" : "khong"}.`,
    );
  }

  if (receivables) {
    lines.push(
      `Cong no: NCC qua han ${asArray(receivables.supplier?.overdue).length}, dai ly qua han ${asArray(receivables.agent?.overdue).length}.`,
    );
  }

  if (availableFunds) {
    lines.push(
      `Von kha dung: available ${formatMoney(availableFunds.available)}, collected revenue ${formatMoney(availableFunds.collectedRevenue)}, loan available ${formatMoney(availableFunds.loanAvailable)}, reserved total ${formatMoney((availableFunds.reservedPayroll || 0) + (availableFunds.reservedPayables || 0) + (availableFunds.reservedOther || 0))}.`,
    );
  }

  if (fundsOverview?.validation) {
    lines.push(
      `Quy: validation ${fundsOverview.validation.isValid ? "khop" : "lech"}; ads allowed ${formatMoney(fundsOverview.formulas?.adsBudgetAllowed || 0)}; tien tu do ${formatMoney(fundsOverview.formulas?.tienTuDo || 0)}.`,
    );
  }

  if (loanDashboard) {
    lines.push(
      `No vay: outstanding ${formatMoney(loanDashboard.totalOutstanding || 0)}, den han 14 ngay ${formatMoney(loanDashboard.due14Days || 0)}, qua han ${formatMoney(loanDashboard.overdueAmount || 0)}.`,
    );
  }

  if (laborCashflow || otherCostCashflow) {
    lines.push(
      `Chi phi sap chi: luong outstanding ${formatMoney(laborCashflow?.summary?.outstanding || 0)}, chi phi khac outstanding ${formatMoney(otherCostCashflow?.summary?.outstanding || 0)}.`,
    );
  }

  if (budgetPreview) {
    lines.push(
      `Ads budget dry-run: available ${formatMoney(budgetPreview.totalAvailable || 0)}, allocated ${formatMoney(budgetPreview.totalAllocated || 0)}, systemLocked=${budgetPreview.systemLocked ? "co" : "khong"}.`,
    );
  }

  lines.push("Viec can lam:");
  if (financeActions.length) {
    lines.push(
      ...financeActions
        .slice(0, 5)
        .map(
          (item: any) =>
            `- ${item.title || item.type}: ${item.description || item.reason || "kiem tra chi tiet"}${item.amount ? ` (${formatMoney(item.amount)})` : ""}`,
        ),
    );
  } else if (financeRecommendations.length) {
    lines.push(
      ...financeRecommendations
        .slice(0, 5)
        .map((item) => `- ${item.title}: ${item.proposedAction}`),
    );
  } else {
    lines.push(
      "- Chua co action tai chinh uu tien cao; tiep tuc theo doi forecast, cong no va khoan vay den han.",
    );
  }

  const qualityNotes = [
    ...(dataQuality?.blockingReasons || []),
    ...(dataQuality?.notes || []),
    ...(budgetPreview?.systemLocked
      ? ["Budget allocation dang bi khoa/han che, khong nen scale ads."]
      : []),
    ...snapshot.dataGaps,
  ];
  if (qualityNotes.length) {
    lines.push(
      `Rui ro/thieu du lieu: ${Array.from(new Set(qualityNotes)).slice(0, 6).join(" | ")}`,
    );
  } else {
    lines.push(
      "Rui ro/thieu du lieu: Chua thay data gap lon trong snapshot tai chinh.",
    );
  }

  lines.push(
    "Can duyet: Rut owner, tra no, tao batch thanh toan, tang/giam ads budget va sua so tien deu can approval ro rang.",
  );
  return lines.join("\n");
}
import { BUSINESS_FACT_INTENTS } from "./ai-operator.intent";
