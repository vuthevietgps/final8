import { AiOperatorIntent } from "./ai-operator.interfaces";
import { removeVietnameseTone } from "./ai-operator.format";

export const BUSINESS_FACT_INTENTS: AiOperatorIntent[] = [
  "product_count",
  "product_list",
  "product_profit_leaderboard",
  "fanpage_performance_lookup",
  "chatbot_fanpage_performance_lookup",
  "agent_revenue_leaderboard",
  "agent_profit_leaderboard",
  "ads_product_profit_leaderboard",
  "product_ads_revenue_ratio",
];

export function isRootCauseAnalysisRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasExplicitWhy = ["vi sao", "tai sao", "nguyen nhan"].some((term) =>
    normalized.includes(term),
  );
  const hasDoDau = normalized.includes("do dau");
  const hasBusinessTopic = [
    "doanh thu",
    "loi nhuan",
    "lead",
    "don",
    "ads",
    "quang cao",
    "dong tien",
    "chi phi",
    "google",
    "facebook",
    "sale",
    "san pham",
  ].some((term) => normalized.includes(term));
  const classicLeadFunnelQuestion =
    normalized.includes("lead") && normalized.includes("don khong tang");
  if (classicLeadFunnelQuestion && !hasExplicitWhy) return false;
  return (hasExplicitWhy || hasDoDau) && hasBusinessTopic;
}

export function isAnomalyDetectionRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasAnomaly = [
    "bat thuong",
    "dot ngot",
    "tu nhien",
    "giam manh",
    "tang bat thuong",
    "xau dot ngot",
  ].some((term) => normalized.includes(term));
  const hasScope = [
    "hom nay",
    "chi so",
    "bo phan",
    "hieu suat",
    "khoan chi",
    "san pham",
    "nhom quang cao",
    "sale",
    "khach hang",
  ].some((term) => normalized.includes(term));
  return hasAnomaly && hasScope;
}

export function isPriorityRankingRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasPriority = [
    "uu tien",
    "xu ly 3 viec",
    "3 viec",
    "viec nao anh huong tien",
    "thiet hai lon nhat",
    "can thiep truoc",
    "tap trung vao",
  ].some((term) => normalized.includes(term));
  const hasDecisionScope = [
    "hom nay",
    "truoc",
    "viec",
    "bo phan",
    "ads",
    "sale",
    "don hang",
    "cong no",
    "toi phai tu quyet",
  ].some((term) => normalized.includes(term));
  return hasPriority && hasDecisionScope;
}

export function isResourceAllocationDecisionRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasDecision = ["co nen", "nen"].some((term) =>
    normalized.includes(term),
  );
  const hasResource = [
    "tuyen them sale",
    "tang nguoi",
    "xu ly don",
    "nhap them hang",
    "dung nhap",
    "don tien",
    "mo them kenh",
    "giam ngan sach",
    "tang nguon luc",
    "giam nguon luc",
  ].some((term) => normalized.includes(term));
  return hasDecision && hasResource;
}

export function isOwnerAccountabilityRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasWho = [
    "ai dang",
    "ai can",
    "ai xu ly",
    "ai de",
    "nguoi phu trach",
    "bo phan nao",
  ].some((term) => normalized.includes(term));
  const hasAccountability = [
    "cham",
    "ton nhieu task",
    "ton viec",
    "kem nhat",
    "tot nhat",
    "thuong",
    "dao tao",
    "thieu trach nhiem",
    "khong ro",
    "keo lui",
    "ket qua",
  ].some((term) => normalized.includes(term));
  return hasWho && hasAccountability;
}

export function isChannelProfitabilityRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasChannel = [
    "kenh",
    "facebook",
    "google",
    "tiktok",
    "zalo",
    "channel",
    "platform",
  ].some((term) => normalized.includes(term));
  const hasProfitability = [
    "loi nhuan",
    "hieu qua nhat",
    "chat luong thap",
    "khach mua tot",
    "tang dau tu",
    "nen giam",
    "chi phi tang bat thuong",
  ].some((term) => normalized.includes(term));
  return hasChannel && hasProfitability;
}

export function isProductDecisionReviewRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasProduct =
    normalized.includes("san pham") || normalized.includes("product");
  const hasDecision = [
    "nen day manh",
    "nen day",
    "nen dung",
    "dung nhap",
    "ban nhieu nhung lai thap",
    "it ban nhung lai cao",
    "lam moi",
    "kiem tien chinh",
    "nen chay remarketing",
    "nen tang gia",
    "nen giam gia",
    "hut khach",
  ].some((term) => normalized.includes(term));
  return hasProduct && hasDecision;
}

export function isCustomerValueAnalysisRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasCustomer = [
    "khach hang",
    "khach nao",
    "nhom khach",
    "tep khach",
    "customer",
  ].some((term) => normalized.includes(term));
  const hasValue = [
    "gia tri cao",
    "mua lai",
    "ltv",
    "roi bo",
    "no tien",
    "mua nhieu nhung loi nhuan thap",
    "remarketing",
    "upsell",
    "hoan/huy",
    "cham soc lai",
  ].some((term) => normalized.includes(term));
  return hasCustomer && hasValue;
}

export function isAdvancedCashflowScenarioRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasCash = ["dong tien", "tien", "cash", "free cash"].some((term) =>
    normalized.includes(term),
  );
  const hasAdvanced = [
    "ket o dau",
    "nam o",
    "ton kho",
    "cong no",
    "don chua thu",
    "giu tien hay scale",
    "doanh thu giam 20",
    "khach cham tra",
    "hoan chi",
    "bat buoc phai tra",
  ].some((term) => normalized.includes(term));
  return hasCash && hasAdvanced;
}

export function isTargetGapAnalysisRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasTarget = ["muc tieu", "kpi", "dat target", "dat muc tieu"].some(
    (term) => normalized.includes(term),
  );
  const hasGap = [
    "thang nay",
    "con thieu",
    "toc do hien tai",
    "can lam gi",
    "bao nhieu don/ngay",
    "bao nhieu lead",
    "keo lui",
  ].some((term) => normalized.includes(term));
  return hasTarget && hasGap;
}

export function isPeriodComparisonRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasCompare = [
    "so voi",
    "tot len",
    "xau di",
    "kem di",
    "tuan nay",
    "thang nay",
    "cung ky",
  ].some((term) => normalized.includes(term));
  const hasPeriod = [
    "hom qua",
    "tuan truoc",
    "thang truoc",
    "nam ngoai",
    "doanh thu",
    "loi nhuan",
    "ads",
    "sale",
  ].some((term) => normalized.includes(term));
  return hasCompare && hasPeriod;
}

export function isScenarioAnalysisRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  if (!normalized.startsWith("neu ") && !normalized.includes(" neu "))
    return false;
  const hasScenario = [
    "giam gia",
    "tang gia",
    "tuyen them",
    "nhap them hang",
    "dung san pham",
    "anh huong doanh thu",
    "hoa von",
    "thu hoi von",
    "can bao nhieu",
  ].some((term) => normalized.includes(term));
  return hasScenario;
}

export function isAiRecommendationReviewRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasAi = ["ai de xuat", "de xuat ai", "theo de xuat", "playbook"].some(
    (term) => normalized.includes(term),
  );
  const hasReview = [
    "hom qua",
    "da lam chua",
    "ket qua the nao",
    "hieu qua",
    "sai",
    "bai hoc",
    "can sua",
    "da lam duoc gi",
  ].some((term) => normalized.includes(term));
  const hasAdsAfterAction =
    normalized.includes("sau khi") && normalized.includes("chinh ads");
  return (hasAi && hasReview) || hasAdsAfterAction;
}

export function isConciseRoleBriefingRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasBrief = [
    "tom tat",
    "ngan gon",
    "5 dong",
    "chi noi",
    "ban danh cho",
  ].some((term) => normalized.includes(term));
  const hasScope = [
    "hom nay",
    "tinh hinh",
    "viec",
    "van de",
    "giam doc",
    "quan ly sale",
    "ke toan",
    "nghiem trong",
    "can toi quyet",
  ].some((term) => normalized.includes(term));
  return hasBrief && hasScope;
}

export function isDecisionWaitingApprovalRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasApproval = [
    "cho toi duyet",
    "cho duyet",
    "can toi duyet",
    "can duyet",
    "phe duyet",
    "approve",
    "approval",
  ].some((term) => normalized.includes(term));
  const hasDecision = [
    "quyet",
    "xu ly",
    "ke hoach",
    "khoan chi",
    "don",
    "hop dong",
    "task",
    "de xuat",
    "viec",
  ].some((term) => normalized.includes(term));
  return hasApproval && hasDecision;
}

export function isBusinessRiskRankingRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasRisk = [
    "rui ro",
    "van de",
    "van de lon",
    "van de nhat",
    "xau di",
    "nguy hiem",
    "bo phan nao dang co van de",
  ].some((term) => normalized.includes(term));
  const hasCompanyScope = [
    "cong ty",
    "hom nay",
    "bo phan",
    "tinh hinh",
    "can chu y",
  ].some((term) => normalized.includes(term));
  return hasRisk && hasCompanyScope;
}

export function isCompanyKpiScorecardRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  if (normalized.includes("company_kpi_scorecard")) return true;
  const hasKpi = [
    "doanh thu",
    "loi nhuan",
    "kpi",
    "muc tieu",
    "phan tram muc tieu",
    "dat bao nhieu phan tram",
    "tinh hinh tot len",
    "tinh hinh xau di",
  ].some((term) => normalized.includes(term));
  const hasPeriod = [
    "hom nay",
    "hom qua",
    "thang nay",
    "tuan nay",
    "so voi",
    "dang the nao",
    "bao nhieu",
  ].some((term) => normalized.includes(term));
  return hasKpi && hasPeriod;
}

export function isExecutiveDailyOverviewRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasDaily = ["hom nay", "dau ngay", "sang nay", "trong ngay"].some(
    (term) => normalized.includes(term),
  );
  const hasExecutiveQuestion = [
    "cong ty",
    "viec gi can",
    "can toi xu ly",
    "viec nao dang nong",
    "viec nong",
    "tong quan",
    "tinh hinh",
  ].some((term) => normalized.includes(term));
  return hasDaily && hasExecutiveQuestion;
}

export function isProductPerformanceQuestion(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasProduct =
    normalized.includes("san pham") || normalized.includes("product");
  const hasPerformance = [
    "ban chay",
    "ban nhieu",
    "ban cham",
    "lai nhat",
    "dang lo",
    "ton kho",
    "sap het hang",
    "nen day quang cao",
    "nen dung nhap",
    "ty le hoan",
    "ty le huy",
    "hoan/huy cao",
    "refund risk",
    "stock risk",
  ].some((term) => normalized.includes(term));
  return hasProduct && hasPerformance;
}

export function isCustomerValueOrCareRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasCustomer = ["khach hang", "khach nao", "khach", "customer"].some(
    (term) => normalized.includes(term),
  );
  const hasCareOrValue = [
    "mua nhieu",
    "gia tri cao",
    "lau roi chua mua",
    "khieu nai",
    "cham soc lai",
    "remarketing",
    "tep khach",
    "ltv",
    "nguon khach",
  ].some((term) => normalized.includes(term));
  return hasCustomer && hasCareOrValue;
}

export function isPeoplePerformanceRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  if (
    [
      "tao task",
      "lap task",
      "create task",
      "bulk create",
      "lead",
      "sale",
      "sales",
    ].some((term) => normalized.includes(term))
  )
    return false;
  const hasPeopleScope = [
    "nhan vien",
    "bo phan",
    "ai dang",
    "workload",
    "task",
  ].some((term) => normalized.includes(term));
  const hasPerformance = [
    "ton viec",
    "xu ly cham",
    "qua han",
    "hoan thanh",
    "tot nhat",
    "chua co nguoi phu trach",
    "can nhac viec",
    "kpi",
  ].some((term) => normalized.includes(term));
  return hasPeopleScope && hasPerformance;
}

export function isAdsScaleReadinessRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasAds = ["ads", "quang cao", "nhom", "ad group", "adset"].some(
    (term) => normalized.includes(term),
  );
  const hasScale = [
    "co nen tang",
    "nen tang",
    "tang ngan sach",
    "scale",
    "du dieu kien tang",
    "duoc tang",
  ].some((term) => normalized.includes(term));
  return hasAds && hasScale;
}

export function isAdsKillOrPauseRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasAds = [
    "ads",
    "quang cao",
    "camp",
    "campaign",
    "nhom",
    "ad group",
    "adset",
  ].some((term) => normalized.includes(term));
  const hasWaste = [
    "dot tien",
    "dang lo",
    "nen tat",
    "tam dung",
    "pause",
    "kill",
    "spend nhung khong ra don",
    "co spend nhung khong ra don",
  ].some((term) => normalized.includes(term));
  return hasAds && hasWaste;
}

export function isChannelMixReviewRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasChannel = [
    "facebook",
    "google",
    "tiktok",
    "kenh nao",
    "channel",
    "platform",
  ].some((term) => normalized.includes(term));
  const hasCompare = [
    "hieu qua hon",
    "tot hon",
    "loi nhuan tot nhat",
    "mang lai loi nhuan",
    "roi tot",
    "so sanh",
  ].some((term) => normalized.includes(term));
  return hasChannel && hasCompare;
}

export function isLeadFollowupHealthRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasLead = [
    "lead",
    "khach nong",
    "khach nao nong",
    "hoi thoai",
    "inbox",
  ].some((term) => normalized.includes(term));
  const hasFollowup = [
    "chua xu ly",
    "bo quen",
    "can goi",
    "goi ngay",
    "chua goi",
    "cham soc",
    "follow up",
    "followup",
  ].some((term) => normalized.includes(term));
  return hasLead && hasFollowup;
}

export function isSalesSlaViolationRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasSales = ["sale", "nhan vien sale", "tu van"].some((term) =>
    normalized.includes(term),
  );
  const hasSlow = [
    "phan hoi cham",
    "xu ly cham",
    "chua goi",
    "qua han",
    "sla",
    "bo quen",
  ].some((term) => normalized.includes(term));
  return hasSales && hasSlow;
}

export function isSalesConversionByUserRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasSales = ["sale", "nhan vien sale"].some((term) =>
    normalized.includes(term),
  );
  const hasConversion = [
    "chot tot",
    "chot tot nhat",
    "ty le chot",
    "conversion",
    "dang yeu",
  ].some((term) => normalized.includes(term));
  return hasSales && hasConversion;
}

export function isLeadQualityBySourceRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasLeadSource = [
    "nguon lead",
    "nguon khach",
    "lead source",
    "source",
  ].some((term) => normalized.includes(term));
  const hasQuality = [
    "chat luong",
    "tot nhat",
    "nhieu nhung khong ra don",
    "khong ra don",
    "loi nhuan tot",
  ].some((term) => normalized.includes(term));
  return hasLeadSource && hasQuality;
}

export function isAdGroupProfitClassificationRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  if (
    normalized.includes("ad_group_profit_classification") ||
    normalized.includes("profit classification")
  )
    return true;
  const adGroupTerms = [
    "nhom quang cao",
    "ad group",
    "adgroup",
    "ad set",
    "adset",
    "campaign",
  ];
  const classificationTerms = [
    "bao nhieu",
    "dem",
    "phan loai",
    "lai",
    "lo",
    "hoa von",
    "chua du du lieu",
    "du lieu",
    "doanh thu",
    "loi nhuan",
    "net profit",
    "profit after ads",
    "net profit after ads",
    "spend nhung khong co don",
  ];
  const hasAdGroup = adGroupTerms.some((term) => normalized.includes(term));
  const score = classificationTerms.filter((term) =>
    normalized.includes(term),
  ).length;
  return hasAdGroup && score >= 1;
}

export function isAdsBudgetCashflowGateRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  if (
    normalized.includes("ads_budget_cashflow_gate") ||
    normalized.includes("cashflow gate")
  )
    return true;
  const hasAdsBudget = [
    "ads",
    "quang cao",
    "ngan sach",
    "budget",
    "scale",
  ].some((term) => normalized.includes(term));
  const hasCashQuestion = [
    "du tien",
    "co tien",
    "dong tien",
    "free cash",
    "tien tu do",
    "cashflow",
    "tang them",
  ].some((term) => normalized.includes(term));
  const hasDecision = [
    "co nen",
    "duoc tang",
    "tang ads",
    "scale",
    "proposedincrease",
    "tang them",
  ].some((term) => normalized.includes(term));
  return hasAdsBudget && hasCashQuestion && hasDecision;
}

export function isMarketingFunnelHealthRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  if (
    normalized.includes("marketing_funnel_health") ||
    normalized.includes("funnel")
  )
    return true;
  const hasLead = ["lead", "inbox", "form", "khach tiem nang"].some((term) =>
    normalized.includes(term),
  );
  const hasOrderIssue = [
    "don khong tang",
    "khong ra don",
    "ty le chot",
    "chot don",
    "conversion",
  ].some((term) => normalized.includes(term));
  return hasLead && hasOrderIssue;
}

export function isCreativeFatigueRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  if (
    normalized.includes("creative_fatigue_review") ||
    normalized.includes("creative fatigue")
  )
    return true;
  const hasCreative = [
    "creative",
    "mau quang cao",
    "content",
    "noi dung",
    "asset",
  ].some((term) => normalized.includes(term));
  const hasFatigue = [
    "met",
    "giam hieu qua",
    "yeu",
    "frequency",
    "ctr",
    "cpc",
    "cpl",
    "can thay",
  ].some((term) => normalized.includes(term));
  return hasCreative && hasFatigue;
}

export function isOfferPerformanceRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  if (normalized.includes("offer_performance_review")) return true;
  const hasOffer = ["offer", "khuyen mai", "uu dai", "san pham"].some((term) =>
    normalized.includes(term),
  );
  const hasQuestion = [
    "yeu",
    "hieu qua",
    "lead nhung khong chot",
    "khong chot",
    "tot nhat",
  ].some((term) => normalized.includes(term));
  return hasOffer && hasQuestion;
}

export function isSalesSlaTaskCreationRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  if (normalized.includes("sales_sla_task_creation")) return true;
  const hasTask = ["tao task", "lap task", "giao viec", "create task"].some(
    (term) => normalized.includes(term),
  );
  const hasLeadSla = ["lead", "qua han", "chua goi", "sla", "sale"].some(
    (term) => normalized.includes(term),
  );
  return hasTask && hasLeadSla;
}

export function isLateOrderDiagnosticRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasOrder = ["don", "order"].some((term) => normalized.includes(term));
  const hasLate = ["tre", "qua han", "cham", "late", "delay"].some((term) =>
    normalized.includes(term),
  );
  return hasOrder && hasLate;
}

export function isFulfillmentBottleneckRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasBottleneck = [
    "nghen",
    "bottleneck",
    "khau nao",
    "xu ly cham",
    "bo phan nao",
  ].some((term) => normalized.includes(term));
  const hasOps = [
    "sale",
    "kho",
    "giao hang",
    "nha cung cap",
    "supplier",
    "van hanh",
    "don",
  ].some((term) => normalized.includes(term));
  return hasBottleneck && hasOps;
}

export function isTrackingIssueRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  return (
    normalized.includes("tracking") &&
    ["thieu", "loi", "chua co", "sai"].some((term) => normalized.includes(term))
  );
}

export function isCancelRefundRiskRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasOrder = ["don", "order", "khach"].some((term) =>
    normalized.includes(term),
  );
  const hasRisk = [
    "nguy co bi huy",
    "huy",
    "hoan",
    "refund",
    "khieu nai",
    "phan nan",
  ].some((term) => normalized.includes(term));
  return hasOrder && hasRisk;
}

export function isCashflowForecastRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasCash = ["tien", "dong tien", "cash", "free cash"].some((term) =>
    normalized.includes(term),
  );
  const hasForecast = [
    "7 ngay",
    "bay ngay",
    "tuan toi",
    "ngay toi",
    "du tien chi",
    "du tien tra",
    "forecast",
    "du bao",
  ].some((term) => normalized.includes(term));
  return hasCash && hasForecast;
}

export function isReceivablesCollectionPriorityRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasDebt = ["cong no", "phai thu", "khoan no", "khach no"].some((term) =>
    normalized.includes(term),
  );
  const hasCollect = [
    "can thu ngay",
    "thu ngay",
    "qua han",
    "lau nhat",
    "tuoi no",
    "mat kha nang thu",
  ].some((term) => normalized.includes(term));
  return hasDebt && hasCollect;
}

export function isSupplierPaymentPriorityRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasSupplier = ["nha cung cap", "ncc", "supplier", "phai tra"].some(
    (term) => normalized.includes(term),
  );
  const hasPayment = [
    "can tra truoc",
    "phai tra",
    "den han",
    "uu tien tra",
    "tra truoc",
  ].some((term) => normalized.includes(term));
  return hasSupplier && hasPayment;
}

export function isTokenHealthCheckRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasToken = normalized.includes("token");
  const hasHealth = [
    "loi",
    "het han",
    "invalid",
    "error",
    "health",
    "co loi khong",
    "con han",
  ].some((term) => normalized.includes(term));
  return hasToken && hasHealth;
}

export function isFanpagePermissionCheckRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasFanpage =
    normalized.includes("fanpage") || normalized.includes("page");
  const hasPermission = [
    "mat ket noi",
    "thieu quyen",
    "permission",
    "quyen",
    "khong co quyen",
    "access",
  ].some((term) => normalized.includes(term));
  return hasFanpage && hasPermission;
}

export function isPlatformSyncHealthRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasSync = ["sync", "dong bo", "du lieu chua dong bo"].some((term) =>
    normalized.includes(term),
  );
  const hasPlatform = [
    "facebook",
    "google",
    "tiktok",
    "ads",
    "quang cao",
    "platform",
  ].some((term) => normalized.includes(term));
  return hasSync && hasPlatform;
}

export function isOpenAiConfigHealthRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  const hasOpenAi =
    normalized.includes("openai") ||
    normalized.includes("ai api") ||
    normalized.includes("api key");
  const hasHealth = [
    "hoat dong",
    "binh thuong",
    "loi",
    "config",
    "cau hinh",
    "key",
  ].some((term) => normalized.includes(term));
  return hasOpenAi && hasHealth;
}

export function isWebhookFailureRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  return (
    normalized.includes("webhook") &&
    ["loi", "fail", "failure", "error", "khong nhan"].some((term) =>
      normalized.includes(term),
    )
  );
}

export function isAdsDiagnosticChecklistRequest(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.trim()) return false;
  if (
    normalized.includes("ads_diagnostic_checklist") ||
    normalized.includes("diagnostic ads") ||
    normalized.includes("chan doan quang cao")
  ) {
    return true;
  }
  const adsTerms = [
    "quang cao",
    "ads",
    "ad account",
    "tai khoan quang cao",
    "fanpage",
    "campaign",
    "adset",
    "ad set",
    "spend",
    "lead",
    "inbox",
    "form",
    "attribution",
    "doanh thu",
    "loi nhuan",
    "lo lai",
    "ngan sach",
    "provider",
  ];
  const diagnosticTerms = [
    "kiem tra",
    "da kiem tra",
    "co bao nhieu",
    "con han",
    "thieu quyen",
    "dong bo",
    "sync",
    "loi",
    "error",
    "active",
    "paused",
    "gan nhat",
    "tong spend",
    "du dieu kien",
    "tang",
    "giam",
    "checklist",
  ];
  const adScore = adsTerms.filter((term) => normalized.includes(term)).length;
  const diagnosticScore = diagnosticTerms.filter((term) =>
    normalized.includes(term),
  ).length;
  return adScore >= 2 && diagnosticScore >= 2;
}

export function isProductAdsRevenueRatioQuestion(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  const hasAds = ["ads", "quang cao", "chi phi ads", "ad spend", "spend"].some(
    (term) => normalized.includes(term),
  );
  const hasRevenue = ["doanh thu", "revenue"].some((term) =>
    normalized.includes(term),
  );
  const hasRatio = ["%", "phan tram", "chiem bao nhieu", "chiem"].some((term) =>
    normalized.includes(term),
  );
  return (
    hasAds &&
    hasRevenue &&
    hasRatio &&
    (normalized.includes("san pham") || normalized.includes("product"))
  );
}

export function isAdsProductProfitQuestion(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  const hasAds = ["ads", "quang cao", "spend"].some((term) =>
    normalized.includes(term),
  );
  const hasProduct =
    normalized.includes("san pham") || normalized.includes("product");
  const hasProfit = ["loi nhuan", "lai", "profit", "net profit"].some((term) =>
    normalized.includes(term),
  );
  const hasRank = ["cao nhat", "tot nhat", "nhat", "top", "lai nhat"].some(
    (term) => normalized.includes(term),
  );
  return hasAds && hasProduct && hasProfit && hasRank;
}

export function isProductProfitLeaderboardQuestion(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  const hasProduct =
    normalized.includes("san pham") || normalized.includes("product");
  const hasProfit = ["loi nhuan", "lai", "profit"].some((term) =>
    normalized.includes(term),
  );
  const hasPeriodOrRank = [
    "tuan",
    "thang",
    "cao nhat",
    "tot nhat",
    "nhat",
    "top",
    "vua roi",
  ].some((term) => normalized.includes(term));
  return hasProduct && hasProfit && hasPeriodOrRank;
}

export function isProductCountQuestion(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  const hasProduct =
    normalized.includes("san pham") || normalized.includes("product");
  const asksCount = [
    "bao nhieu",
    "so luong",
    "tong so",
    "hien tai co",
    "dem",
  ].some((term) => normalized.includes(term));
  const asksList = [
    "nhung san pham gi",
    "co nhung",
    "danh sach",
    "liet ke",
  ].some((term) => normalized.includes(term));
  return hasProduct && asksCount && !asksList;
}

export function isProductListQuestion(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  const hasProduct =
    normalized.includes("san pham") || normalized.includes("product");
  const asksList = [
    "nhung san pham gi",
    "co nhung",
    "danh sach",
    "liet ke",
    "san pham gi",
  ].some((term) => normalized.includes(term));
  return hasProduct && asksList;
}

export function isChatbotFanpagePerformanceQuestion(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  return (
    normalized.includes("chatbot") &&
    normalized.includes("fanpage") &&
    ["tot", "hieu qua", "hoat dong"].some((term) => normalized.includes(term))
  );
}

export function isFanpagePerformanceQuestion(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  if (!normalized.includes("fanpage")) return false;
  if (
    [
      "mat ket noi",
      "ket noi",
      "thieu quyen",
      "permission",
      "quyen",
      "loi",
      "disconnect",
      "access",
    ].some((term) => normalized.includes(term))
  )
    return false;
  return [
    "bao nhieu",
    "tong so",
    "hoat dong tot",
    "hieu qua",
    "tot nhat",
    "fanpage nao",
  ].some((term) => normalized.includes(term));
}

export function isAgentRevenueLeaderboardQuestion(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  const hasAgent =
    normalized.includes("dai ly") || normalized.includes("agent");
  const hasRevenue =
    normalized.includes("doanh thu") || normalized.includes("revenue");
  const hasRank = ["cao nhat", "nhat", "top", "tot nhat"].some((term) =>
    normalized.includes(term),
  );
  return hasAgent && hasRevenue && hasRank;
}

export function isAgentProfitLeaderboardQuestion(value: string): boolean {
  const normalized = removeVietnameseTone(value || "").toLowerCase();
  const hasAgent =
    normalized.includes("dai ly") || normalized.includes("agent");
  const hasProfit = ["loi nhuan", "lai", "profit"].some((term) =>
    normalized.includes(term),
  );
  const hasRank = ["cao nhat", "nhat", "top", "tot nhat"].some((term) =>
    normalized.includes(term),
  );
  return hasAgent && hasProfit && hasRank;
}

export function intentFromTextOrRole(
  message: string,
  role?: string,
): AiOperatorIntent {
  const normalized = removeVietnameseTone(
    `${message || ""} ${role || ""}`,
  ).toLowerCase();
  if (isConciseRoleBriefingRequest(normalized)) return "concise_role_briefing";
  if (isAiRecommendationReviewRequest(normalized))
    return "ai_recommendation_review";
  if (isRootCauseAnalysisRequest(normalized)) return "root_cause_analysis";
  if (isAnomalyDetectionRequest(normalized)) return "anomaly_detection_daily";
  if (isPriorityRankingRequest(normalized)) return "priority_ranking";
  if (isTargetGapAnalysisRequest(normalized)) return "target_gap_analysis";
  if (isPeriodComparisonRequest(normalized)) return "period_comparison";
  if (isProductAdsRevenueRatioQuestion(normalized))
    return "product_ads_revenue_ratio";
  if (isAdsProductProfitQuestion(normalized))
    return "ads_product_profit_leaderboard";
  if (isProductDecisionReviewRequest(normalized))
    return "product_decision_review";
  if (isProductPerformanceQuestion(normalized))
    return "product_profit_leaderboard";
  if (isProductProfitLeaderboardQuestion(normalized))
    return "product_profit_leaderboard";
  if (isProductCountQuestion(normalized)) return "product_count";
  if (isProductListQuestion(normalized)) return "product_list";
  if (isChatbotFanpagePerformanceQuestion(normalized))
    return "chatbot_fanpage_performance_lookup";
  if (isFanpagePerformanceQuestion(normalized))
    return "fanpage_performance_lookup";
  if (isCustomerValueAnalysisRequest(normalized))
    return "customer_value_analysis";
  if (isCustomerValueOrCareRequest(normalized)) return "sales";
  if (isAgentRevenueLeaderboardQuestion(normalized))
    return "agent_revenue_leaderboard";
  if (isAgentProfitLeaderboardQuestion(normalized))
    return "agent_profit_leaderboard";
  if (isDecisionWaitingApprovalRequest(normalized))
    return "decision_waiting_approval";
  if (isBusinessRiskRankingRequest(normalized)) return "business_risk_ranking";
  if (isCompanyKpiScorecardRequest(normalized)) return "company_kpi_scorecard";
  if (isExecutiveDailyOverviewRequest(normalized))
    return "director_daily_overview";
  if (isOwnerAccountabilityRequest(normalized))
    return "owner_accountability_review";
  if (isPeoplePerformanceRequest(normalized)) return "operations";
  if (isAdGroupProfitClassificationRequest(normalized))
    return "ad_group_profit_classification";
  if (isAdsBudgetCashflowGateRequest(normalized))
    return "ads_budget_cashflow_gate";
  if (isAdsScaleReadinessRequest(normalized)) return "ads_scale_readiness";
  if (isAdsKillOrPauseRequest(normalized))
    return "ads_kill_or_pause_recommendation";
  if (isChannelProfitabilityRequest(normalized))
    return "channel_profitability_review";
  if (isChannelMixReviewRequest(normalized)) return "channel_mix_review";
  if (isResourceAllocationDecisionRequest(normalized))
    return "resource_allocation_decision";
  if (isSalesSlaTaskCreationRequest(normalized))
    return "sales_sla_task_creation";
  if (isSalesSlaViolationRequest(normalized)) return "sales_sla_violation";
  if (isLeadQualityBySourceRequest(normalized)) return "lead_quality_by_source";
  if (isSalesConversionByUserRequest(normalized))
    return "sales_conversion_by_user";
  if (isLeadFollowupHealthRequest(normalized)) return "lead_followup_health";
  if (isMarketingFunnelHealthRequest(normalized))
    return "marketing_funnel_health";
  if (isCreativeFatigueRequest(normalized)) return "creative_fatigue_review";
  if (isOfferPerformanceRequest(normalized)) return "offer_performance_review";
  if (isAdsDiagnosticChecklistRequest(normalized))
    return "ads_diagnostic_checklist";
  if (isLateOrderDiagnosticRequest(normalized)) return "late_order_diagnostic";
  if (isFulfillmentBottleneckRequest(normalized))
    return "fulfillment_bottleneck";
  if (isTrackingIssueRequest(normalized)) return "tracking_issue_check";
  if (isCancelRefundRiskRequest(normalized)) return "cancel_refund_risk";
  if (isCashflowForecastRequest(normalized)) return "cashflow_forecast";
  if (isAdvancedCashflowScenarioRequest(normalized))
    return "advanced_cashflow_scenario";
  if (isScenarioAnalysisRequest(normalized)) return "scenario_analysis";
  if (isReceivablesCollectionPriorityRequest(normalized))
    return "receivables_collection_priority";
  if (isSupplierPaymentPriorityRequest(normalized))
    return "supplier_payment_priority";
  if (isTokenHealthCheckRequest(normalized)) return "token_health_check";
  if (isFanpagePermissionCheckRequest(normalized))
    return "fanpage_permission_check";
  if (isPlatformSyncHealthRequest(normalized)) return "platform_sync_health";
  if (isOpenAiConfigHealthRequest(normalized)) return "openai_config_health";
  if (isWebhookFailureRequest(normalized)) return "webhook_failure_diagnostic";
  if (normalized.includes("free cash") || normalized.includes("tien tu do"))
    return "free_cash_summary";
  if (
    normalized.includes("du bao dong tien") ||
    normalized.includes("forecast")
  )
    return "cashflow_forecast";
  if (
    normalized.includes("unit economics") ||
    normalized.includes("allowable cac")
  )
    return "unit_economics";
  if (
    normalized.includes("scale readiness") ||
    normalized.includes("du dieu kien scale")
  )
    return "ads_scale_readiness";
  if (
    normalized.includes("ads") ||
    normalized.includes("quang cao") ||
    normalized.includes("roi") ||
    normalized.includes("budget")
  )
    return "ads";
  if (
    normalized.includes("tai chinh") ||
    normalized.includes("dong tien") ||
    normalized.includes("cash") ||
    normalized.includes("runway") ||
    normalized.includes("von")
  )
    return "finance";
  if (
    normalized.includes("cong no") ||
    normalized.includes("thanh toan") ||
    normalized.includes("hoa hong") ||
    normalized.includes("ncc")
  )
    return "receivables";
  if (
    normalized.includes("don") ||
    normalized.includes("order") ||
    normalized.includes("tracking") ||
    normalized.includes("giao hang")
  )
    return "orders";
  if (normalized.includes("sale") || normalized.includes("agent"))
    return "sales";
  if (normalized.includes("supplier")) return "supplier";
  if (
    normalized.includes("manager") ||
    normalized.includes("quan ly") ||
    normalized.includes("van hanh")
  )
    return "operations";
  if (normalized.includes("director") || normalized.includes("giam doc"))
    return "overview";
  return "loose";
}

export function normalizeIntent(value?: string): AiOperatorIntent | null {
  const normalized = removeVietnameseTone(value || "")
    .toLowerCase()
    .trim();
  if (
    normalized === "ad_group_profit_classification" ||
    normalized === "ad group profit classification" ||
    normalized === "profit classification" ||
    normalized === "phan loai nhom quang cao" ||
    normalized === "lai lo nhom quang cao"
  ) {
    return "ad_group_profit_classification";
  }
  if (
    normalized === "ads_diagnostic_checklist" ||
    normalized === "ads diagnostic" ||
    normalized === "ads-diagnostic" ||
    normalized === "diagnostic ads" ||
    normalized === "chan doan quang cao" ||
    normalized === "kiem tra quang cao"
  ) {
    return "ads_diagnostic_checklist";
  }
  const aliases: Record<string, AiOperatorIntent> = {
    overview: "overview",
    director_daily_overview: "director_daily_overview",
    director_weekly_priority: "director_weekly_priority",
    business_risk_ranking: "business_risk_ranking",
    decision_waiting_approval: "decision_waiting_approval",
    company_kpi_scorecard: "company_kpi_scorecard",
    root_cause_analysis: "root_cause_analysis",
    "root cause analysis": "root_cause_analysis",
    "phan tich nguyen nhan": "root_cause_analysis",
    anomaly_detection_daily: "anomaly_detection_daily",
    "anomaly detection daily": "anomaly_detection_daily",
    "bat thuong hom nay": "anomaly_detection_daily",
    priority_ranking: "priority_ranking",
    "priority ranking": "priority_ranking",
    "xep hang uu tien": "priority_ranking",
    resource_allocation_decision: "resource_allocation_decision",
    "resource allocation decision": "resource_allocation_decision",
    "quyet dinh nguon luc": "resource_allocation_decision",
    owner_accountability_review: "owner_accountability_review",
    "owner accountability review": "owner_accountability_review",
    "trach nhiem xu ly": "owner_accountability_review",
    finance: "finance",
    financial: "finance",
    cashflow: "finance",
    free_cash_summary: "free_cash_summary",
    free_cash: "free_cash_summary",
    "free cash summary": "free_cash_summary",
    "free cash": "free_cash_summary",
    cashflow_forecast: "cashflow_forecast",
    "cashflow forecast": "cashflow_forecast",
    ads_budget_cashflow_gate: "ads_budget_cashflow_gate",
    "ads budget cashflow gate": "ads_budget_cashflow_gate",
    advanced_cashflow_scenario: "advanced_cashflow_scenario",
    "advanced cashflow scenario": "advanced_cashflow_scenario",
    "cashflow scenario": "advanced_cashflow_scenario",
    target_gap_analysis: "target_gap_analysis",
    "target gap analysis": "target_gap_analysis",
    "phan tich gap muc tieu": "target_gap_analysis",
    period_comparison: "period_comparison",
    "period comparison": "period_comparison",
    "so sanh ky": "period_comparison",
    scenario_analysis: "scenario_analysis",
    "scenario analysis": "scenario_analysis",
    "phan tich neu thi": "scenario_analysis",
    product_count: "product_count",
    "product count": "product_count",
    product_list: "product_list",
    "product list": "product_list",
    product_profit_leaderboard: "product_profit_leaderboard",
    "product profit leaderboard": "product_profit_leaderboard",
    product_decision_review: "product_decision_review",
    "product decision review": "product_decision_review",
    fanpage_performance_lookup: "fanpage_performance_lookup",
    "fanpage performance lookup": "fanpage_performance_lookup",
    chatbot_fanpage_performance_lookup: "chatbot_fanpage_performance_lookup",
    "chatbot fanpage performance lookup": "chatbot_fanpage_performance_lookup",
    agent_revenue_leaderboard: "agent_revenue_leaderboard",
    "agent revenue leaderboard": "agent_revenue_leaderboard",
    agent_profit_leaderboard: "agent_profit_leaderboard",
    "agent profit leaderboard": "agent_profit_leaderboard",
    ads_product_profit_leaderboard: "ads_product_profit_leaderboard",
    "ads product profit leaderboard": "ads_product_profit_leaderboard",
    product_ads_revenue_ratio: "product_ads_revenue_ratio",
    "product ads revenue ratio": "product_ads_revenue_ratio",
    owner_withdrawal_readiness: "owner_withdrawal_readiness",
    "owner withdrawal readiness": "owner_withdrawal_readiness",
    supplier_payment_priority: "supplier_payment_priority",
    receivables_collection_priority: "receivables_collection_priority",
    double_payment_risk: "double_payment_risk",
    tax_cash_reserve_check: "tax_cash_reserve_check",
    unit_economics: "unit_economics",
    "unit economics": "unit_economics",
    ads: "ads",
    advertising: "ads",
    marketing_funnel_health: "marketing_funnel_health",
    "marketing funnel health": "marketing_funnel_health",
    creative_fatigue_review: "creative_fatigue_review",
    "creative fatigue review": "creative_fatigue_review",
    offer_performance_review: "offer_performance_review",
    "offer performance review": "offer_performance_review",
    channel_mix_review: "channel_mix_review",
    channel_profitability_review: "channel_profitability_review",
    "channel profitability review": "channel_profitability_review",
    ads_scale_readiness: "ads_scale_readiness",
    ads_kill_or_pause_recommendation: "ads_kill_or_pause_recommendation",
    lead_quality_by_campaign: "lead_quality_by_campaign",
    attribution_quality_check: "attribution_quality_check",
    orders: "orders",
    order: "orders",
    late_order_diagnostic: "late_order_diagnostic",
    fulfillment_bottleneck: "fulfillment_bottleneck",
    tracking_issue_check: "tracking_issue_check",
    cancel_refund_risk: "cancel_refund_risk",
    supplier_delay_risk: "supplier_delay_risk",
    receivables: "receivables",
    payment: "receivables",
    operations: "operations",
    ops: "operations",
    token: "token",
    token_health_check: "token_health_check",
    fanpage_permission_check: "fanpage_permission_check",
    platform_sync_health: "platform_sync_health",
    openai_config_health: "openai_config_health",
    webhook_failure_diagnostic: "webhook_failure_diagnostic",
    api: "api",
    sales: "sales",
    sale: "sales",
    customer_value_analysis: "customer_value_analysis",
    "customer value analysis": "customer_value_analysis",
    lead_followup_health: "lead_followup_health",
    sales_conversion_by_user: "sales_conversion_by_user",
    lead_quality_by_source: "lead_quality_by_source",
    lost_reason_summary: "lost_reason_summary",
    sales_sla_violation: "sales_sla_violation",
    sales_sla_task_creation: "sales_sla_task_creation",
    "sales sla task creation": "sales_sla_task_creation",
    quote_readiness: "quote_readiness",
    supplier: "supplier",
    ai_recommendation_review: "ai_recommendation_review",
    "ai recommendation review": "ai_recommendation_review",
    "hau kiem ai": "ai_recommendation_review",
    concise_role_briefing: "concise_role_briefing",
    "concise role briefing": "concise_role_briefing",
    "tom tat theo vai tro": "concise_role_briefing",
    loose: "loose",
  };
  return aliases[normalized] || null;
}
