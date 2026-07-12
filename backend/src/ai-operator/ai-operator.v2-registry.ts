import {
  AiOperatorContextRoute,
  AiOperatorIntent,
  AiOperatorRecommendation,
  AiOperatorTokenMode,
  AiSourceResult,
} from './ai-operator.interfaces';

export type BusinessDomain =
  | 'marketing'
  | 'sales'
  | 'finance'
  | 'orders'
  | 'supplier'
  | 'integration'
  | 'overview';

export type MetricUnit = 'vnd' | 'percent' | 'count' | 'day' | 'minute' | 'ratio' | 'score';
export type MetricDirection = 'higher_is_better' | 'lower_is_better' | 'range_is_good';
export type ManagementSeverity = 'info' | 'watch' | 'warning' | 'danger' | 'critical';
export type DataQualityStatus = 'good' | 'usable' | 'weak' | 'bad';
export type DecisionOperator = '>' | '>=' | '<' | '<=' | '=' | 'between';
export type ErpApiDomain =
  | 'director'
  | 'marketing'
  | 'finance'
  | 'product'
  | 'sales'
  | 'orders'
  | 'receivables'
  | 'supplier'
  | 'integration'
  | 'task'
  | 'approval';
export type ManagementSituationDomain = ErpApiDomain | 'solution';

export interface ErpApiCatalogV2Item {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  domain: ErpApiDomain;
  purpose: string;
  readOrWrite: 'read' | 'write';
  requiredPermissions: string[];
  approvalRequired: boolean;
  riskLevel: 'read_only' | 'draft' | 'approval_required' | 'dangerous';
  inputParamsSchema?: unknown;
  outputSchema?: unknown;
  usedByWorkflows: string[];
  dataFreshness?: {
    maxAgeMinutes: number;
    staleMessage: string;
  };
}

export interface ManagementSituation {
  id: string;
  name: string;
  domain: ManagementSituationDomain;
  roles: Array<'owner' | 'director' | 'manager' | 'ads' | 'sales' | 'accountant' | 'supplier'>;
  purpose: string;
  exampleQuestions: string[];
  negativeExamples?: string[];
  intent: string;
  workflow: string;
  responseContract: string;
  tokenPolicy: AiOperatorTokenMode;
  requiredApis: string[];
  requiredMetrics?: string[];
  decisionRules?: string[];
  approvalRequired: boolean;
  priority: number;
}

export interface AiOperatorTestCase {
  id: string;
  question: string;
  role: string;
  expectedIntent: string;
  expectedWorkflow: string;
  expectedResponseContract: string;
  expectedTokenMode: AiOperatorTokenMode;
  shouldCallOpenAI: boolean;
  mustInclude: string[];
  mustNotInclude: string[];
  approvalExpected: boolean;
}

export interface BusinessMetric {
  id: string;
  name: string;
  domain: BusinessDomain;
  formula: string;
  unit: MetricUnit;
  ownerRole: string;
  sourceApis: string[];
  goodDirection: MetricDirection;
  warningThreshold?: number;
  dangerThreshold?: number;
  description: string;
}

export interface DecisionCondition {
  metric: string;
  operator: DecisionOperator;
  value: number | [number, number];
  severityIfFailed: Exclude<ManagementSeverity, 'critical'>;
  messageIfFailed: string;
}

export interface DecisionRule {
  id: string;
  domain: BusinessDomain;
  decisionType: string;
  requiredMetrics: string[];
  conditions: DecisionCondition[];
  outputIfPassed: string;
  outputIfFailed: string;
  approvalRequired: boolean;
}

export interface DataQualityReport {
  score: number;
  status: DataQualityStatus;
  missingFields: string[];
  staleSources: string[];
  syncIssues: string[];
  attributionIssues: string[];
  permissionIssues: string[];
  warningMessages: string[];
}

export interface ManagementIssue {
  id: string;
  domain: BusinessDomain | string;
  title: string;
  severity: ManagementSeverity;
  severityScore: number;
  financialImpact?: number;
  customerImpact?: number;
  operationalImpact?: number;
  urgency: 'today' | 'this_week' | 'this_month';
  ownerRole: string;
  recommendedAction: string;
}

export interface RecommendedAction {
  actionType: string;
  title: string;
  reason: string;
  expectedImpact?: string;
  riskLevel: 'low' | 'medium' | 'high';
  approvalRequired: boolean;
}

export interface ApprovalRequirement {
  required: boolean;
  reason: string;
  requiredApproverRole: string;
}

export interface WorkflowResult<TData = any> {
  workflowId: string;
  intent: string;
  period?: {
    from: string;
    to: string;
    days: number;
  };
  data: TData;
  dataQuality: DataQualityReport;
  issues: ManagementIssue[];
  recommendedActions: RecommendedAction[];
  permissions: {
    allowed: boolean;
    deniedSources: string[];
  };
  approval?: ApprovalRequirement;
}

export interface ResponseContractDefinition {
  id: string;
  name: string;
  intentGroups: string[];
  requiredSections: string[];
  schema: Record<string, string>;
  guardrails: string[];
}

export interface WorkflowTokenBudget {
  workflowId: string;
  defaultMode: AiOperatorTokenMode;
  maxInputTokens: number;
  maxOutputTokens: number;
  rawRowsLimit: number;
  allowChatHistory: boolean;
  allowApiCatalog: boolean;
}

export interface SlaRule {
  id: string;
  entity: 'lead' | 'order' | 'receivable' | 'supplier_payment';
  condition: string;
  warningAfterMinutes?: number;
  dangerAfterMinutes?: number;
  ownerRole: string;
  actionWhenViolated: 'notify' | 'create_task' | 'escalate';
}

export interface AiDecisionOutput {
  conclusion: string;
  confidence: number;
  keyFindings: string[];
  risks: string[];
  recommendedActions: RecommendedAction[];
  dataGaps: string[];
}

export interface DecisionEvaluationRequest {
  decisionType: string;
  metrics: Record<string, number | null | undefined>;
  dataQuality?: DataQualityReport;
}

export interface DecisionEvaluationResult {
  decisionType: string;
  ruleId: string | null;
  status: 'passed' | 'needs_review' | 'blocked' | 'unknown';
  allowed: boolean;
  approvalRequired: boolean;
  conclusion: string;
  confidence: number;
  failedConditions: Array<DecisionCondition & { actualValue: number | null }>;
  missingMetrics: string[];
  issues: ManagementIssue[];
  recommendedActions: RecommendedAction[];
  dataQuality: DataQualityReport | null;
}

export const ERP_API_CATALOG_V2: ErpApiCatalogV2Item[] = [
  {
    id: 'director_daily_overview',
    method: 'GET',
    path: '/api/director/daily-overview',
    domain: 'director',
    purpose: 'Return a normalized executive overview across cashflow, ads, orders, receivables and pending approvals.',
    readOrWrite: 'read',
    requiredPermissions: ['ai-assistant', 'finance', 'reports'],
    approvalRequired: false,
    riskLevel: 'read_only',
    usedByWorkflows: ['directorDailyOverviewWorkflow', 'businessAnomalyDailyWorkflow'],
    dataFreshness: {
      maxAgeMinutes: 60,
      staleMessage: 'Executive overview may be stale if finance, ads or order sync has not completed in the last hour.',
    },
  },
  {
    id: 'director_priority_ranking',
    method: 'GET',
    path: '/api/director/priority-ranking',
    domain: 'director',
    purpose: 'Rank management issues by money impact, urgency, customer impact and operational risk.',
    readOrWrite: 'read',
    requiredPermissions: ['ai-assistant', 'reports'],
    approvalRequired: false,
    riskLevel: 'read_only',
    usedByWorkflows: ['dailyPriorityRankingWorkflow'],
  },
  {
    id: 'ads_ad_group_profit_ranking',
    method: 'GET',
    path: '/api/ads/ad-groups/profit-ranking',
    domain: 'marketing',
    purpose: 'Rank ad groups by net profit after ads for a selected period.',
    readOrWrite: 'read',
    requiredPermissions: ['ads-budget', 'ad-groups'],
    approvalRequired: false,
    riskLevel: 'read_only',
    usedByWorkflows: ['adGroupProfitRankingWorkflow', 'adGroupProfitClassificationWorkflow'],
    dataFreshness: {
      maxAgeMinutes: 60,
      staleMessage: 'Ads cost, attribution and order mapping may lag during the latest sync window.',
    },
  },
  {
    id: 'ads_scale_readiness',
    method: 'GET',
    path: '/api/ads/scale-readiness',
    domain: 'marketing',
    purpose: 'Check whether an ad group can be proposed for scale after profit, attribution, order and cashflow gates.',
    readOrWrite: 'read',
    requiredPermissions: ['ads-budget', 'finance'],
    approvalRequired: false,
    riskLevel: 'read_only',
    usedByWorkflows: ['adsScaleReadinessWorkflow'],
  },
  {
    id: 'marketing_funnel_summary',
    method: 'GET',
    path: '/api/marketing/funnel-summary',
    domain: 'marketing',
    purpose: 'Summarize lead, follow-up, order and paid-order conversion for funnel diagnostics.',
    readOrWrite: 'read',
    requiredPermissions: ['ai-assistant', 'chat-messages', 'orders'],
    approvalRequired: false,
    riskLevel: 'read_only',
    usedByWorkflows: ['marketingFunnelHealthWorkflow', 'leadQualityBySourceWorkflow'],
  },
  {
    id: 'products_profit_ranking',
    method: 'GET',
    path: '/api/products/profit-ranking',
    domain: 'product',
    purpose: 'Rank products by net profit and expose revenue, cost, order and margin inputs.',
    readOrWrite: 'read',
    requiredPermissions: ['products', 'orders-test2', 'reports'],
    approvalRequired: false,
    riskLevel: 'read_only',
    usedByWorkflows: ['productProfitRankingWorkflow'],
  },
  {
    id: 'finance_free_cash_summary',
    method: 'GET',
    path: '/api/finance/free-cash-summary',
    domain: 'finance',
    purpose: 'Return cash balance, committed cash, reserves, free cash and survival floor for CFO decisions.',
    readOrWrite: 'read',
    requiredPermissions: ['finance'],
    approvalRequired: false,
    riskLevel: 'read_only',
    usedByWorkflows: ['freeCashSummaryWorkflow', 'adsBudgetCashflowGateWorkflow', 'ownerWithdrawalReadinessWorkflow'],
  },
  {
    id: 'finance_ads_budget_cashflow_gate',
    method: 'GET',
    path: '/api/finance/ads-budget-cashflow-gate',
    domain: 'finance',
    purpose: 'Evaluate whether a proposed ads budget increase is allowed by current cashflow and survival constraints.',
    readOrWrite: 'read',
    requiredPermissions: ['finance', 'ads-budget'],
    approvalRequired: false,
    riskLevel: 'read_only',
    usedByWorkflows: ['adsBudgetCashflowGateWorkflow'],
  },
  {
    id: 'sales_lead_followup_health',
    method: 'GET',
    path: '/api/sales/lead-followup-health',
    domain: 'sales',
    purpose: 'Summarize open leads, late follow-up, owner assignment and SLA risk by sales user/source.',
    readOrWrite: 'read',
    requiredPermissions: ['chat-messages', 'orders'],
    approvalRequired: false,
    riskLevel: 'read_only',
    usedByWorkflows: ['leadFollowupHealthWorkflow', 'salesSlaViolationWorkflow'],
  },
  {
    id: 'orders_late_diagnostic',
    method: 'GET',
    path: '/api/orders/late-diagnostic',
    domain: 'orders',
    purpose: 'Diagnose late orders by status, supplier, tracking, production and delivery bottleneck.',
    readOrWrite: 'read',
    requiredPermissions: ['orders', 'orders-test2'],
    approvalRequired: false,
    riskLevel: 'read_only',
    usedByWorkflows: ['lateOrderDiagnosticWorkflow', 'fulfillmentBottleneckWorkflow'],
  },
  {
    id: 'receivables_aging_summary',
    method: 'GET',
    path: '/api/receivables/aging-summary',
    domain: 'receivables',
    purpose: 'Return aging buckets and overdue receivable/payment exposure for collection priority.',
    readOrWrite: 'read',
    requiredPermissions: ['finance', 'purchase-costs', 'quotes'],
    approvalRequired: false,
    riskLevel: 'read_only',
    usedByWorkflows: ['receivablesAgingSummaryWorkflow', 'collectionPriorityWorkflow'],
  },
  {
    id: 'integration_health_overview',
    method: 'GET',
    path: '/api/integration/health-overview',
    domain: 'integration',
    purpose: 'Summarize OpenAI config, platform token, fanpage permission, sync and webhook health.',
    readOrWrite: 'read',
    requiredPermissions: ['openai-configs', 'api-tokens', 'fanpages'],
    approvalRequired: false,
    riskLevel: 'read_only',
    usedByWorkflows: ['tokenHealthCheckWorkflow', 'platformSyncHealthWorkflow', 'webhookFailureDiagnosticWorkflow'],
  },
  {
    id: 'ai_actions_draft',
    method: 'POST',
    path: '/api/ai-actions/draft',
    domain: 'approval',
    purpose: 'Create a draft action proposal for budget, payment, task or operational changes before approval.',
    readOrWrite: 'write',
    requiredPermissions: ['ai-assistant'],
    approvalRequired: true,
    riskLevel: 'approval_required',
    usedByWorkflows: ['actionDraftWorkflow', 'adsScaleReadinessWorkflow', 'supplierPaymentPriorityWorkflow'],
  },
  {
    id: 'tasks_create_from_ai_issue',
    method: 'POST',
    path: '/api/tasks/create-from-ai-issue',
    domain: 'task',
    purpose: 'Create or draft a task from a management issue detected by AI Operator.',
    readOrWrite: 'write',
    requiredPermissions: ['ai-assistant'],
    approvalRequired: true,
    riskLevel: 'approval_required',
    usedByWorkflows: ['salesSlaTaskCreationWorkflow', 'dailyPriorityRankingWorkflow'],
  },
];

export const MANAGEMENT_SITUATIONS: ManagementSituation[] = [
  {
    id: 'director_daily_overview',
    name: 'Daily executive overview',
    domain: 'director',
    roles: ['owner', 'director', 'manager'],
    purpose: 'Help leadership see the current company status and top operating risks.',
    exampleQuestions: [
      'Hom nay cong ty co van de gi?',
      'Hom nay co viec gi can toi xu ly?',
      'Bo phan nao dang co van de nhat?',
    ],
    intent: 'director_daily_overview',
    workflow: 'directorDailyOverviewWorkflow',
    responseContract: 'executiveSummary',
    tokenPolicy: 'analysis_ai',
    requiredApis: ['director_daily_overview', 'integration_health_overview'],
    requiredMetrics: ['free_cash', 'cashflow_status', 'late_orders'],
    approvalRequired: false,
    priority: 920,
  },
  {
    id: 'daily_priority_ranking',
    name: 'Daily priority ranking',
    domain: 'director',
    roles: ['owner', 'director', 'manager'],
    purpose: 'Rank the few issues that should be handled first today.',
    exampleQuestions: [
      'Bay gio nen xu ly viec gi truoc?',
      'Neu chi lam 3 viec hom nay thi la viec gi?',
      'Viec nao anh huong tien nhieu nhat?',
    ],
    intent: 'daily_priority_ranking',
    workflow: 'dailyPriorityRankingWorkflow',
    responseContract: 'solutionPlan',
    tokenPolicy: 'analysis_ai',
    requiredApis: [
      'finance_free_cash_summary',
      'marketing_funnel_summary',
      'orders_late_diagnostic',
      'receivables_aging_summary',
      'integration_health_overview',
    ],
    requiredMetrics: ['free_cash', 'overdue_receivables', 'late_orders'],
    approvalRequired: false,
    priority: 930,
  },
  {
    id: 'ad_group_profit_ranking',
    name: 'Ad group profit ranking',
    domain: 'marketing',
    roles: ['owner', 'director', 'manager', 'ads'],
    purpose: 'Show which ad groups are profitable, losing money or lacking enough data.',
    exampleQuestions: [
      'Nhom quang cao nao lai nhat?',
      'Nhom quang cao nao dang lo?',
      'Co bao nhieu nhom quang cao, nhom nao lai lo?',
    ],
    intent: 'ad_group_profit_ranking',
    workflow: 'adGroupProfitRankingWorkflow',
    responseContract: 'tableReport',
    tokenPolicy: 'no_ai',
    requiredApis: ['ads_ad_group_profit_ranking'],
    requiredMetrics: ['net_profit_after_ads', 'ad_spend', 'orders'],
    approvalRequired: false,
    priority: 880,
  },
  {
    id: 'ads_scale_readiness',
    name: 'Ads scale readiness',
    domain: 'marketing',
    roles: ['owner', 'director', 'manager', 'ads'],
    purpose: 'Decide whether an ads budget change can be drafted, blocked or needs review.',
    exampleQuestions: [
      'Co nen tang ngan sach ads khong?',
      'Nhom nao du dieu kien scale?',
      'Co du tien tang ads them khong?',
    ],
    intent: 'ads_scale_readiness',
    workflow: 'adsScaleReadinessWorkflow',
    responseContract: 'decisionProposal',
    tokenPolicy: 'analysis_ai',
    requiredApis: ['ads_scale_readiness', 'finance_ads_budget_cashflow_gate'],
    requiredMetrics: ['net_profit_after_ads', 'orders', 'cash_available_for_ads', 'attribution_quality_score'],
    decisionRules: ['ads_scale_readiness_rule'],
    approvalRequired: true,
    priority: 900,
  },
  {
    id: 'product_profit_ranking',
    name: 'Product profit ranking',
    domain: 'product',
    roles: ['owner', 'director', 'manager'],
    purpose: 'Rank products by net profit and show products that sell well but earn little.',
    exampleQuestions: [
      'San pham nao lai nhat?',
      'Top 10 san pham loi nhuan cao nhat?',
      'San pham nao ban nhieu nhung lai thap?',
    ],
    intent: 'product_profit_ranking',
    workflow: 'productProfitRankingWorkflow',
    responseContract: 'tableReport',
    tokenPolicy: 'no_ai',
    requiredApis: ['products_profit_ranking'],
    requiredMetrics: ['revenue', 'net_profit_after_ads'],
    approvalRequired: false,
    priority: 850,
  },
  {
    id: 'marketing_funnel_health',
    name: 'Marketing funnel health',
    domain: 'marketing',
    roles: ['owner', 'director', 'manager', 'ads', 'sales'],
    purpose: 'Diagnose whether lead, sale or order conversion is the current bottleneck.',
    exampleQuestions: [
      'Vi sao lead tang nhung don khong tang?',
      'Ads ra nhieu inbox nhung khong ra tien la do dau?',
      'Pheu marketing dang nghen o dau?',
    ],
    intent: 'marketing_funnel_health',
    workflow: 'marketingFunnelHealthWorkflow',
    responseContract: 'diagnosticChecklist',
    tokenPolicy: 'analysis_ai',
    requiredApis: ['marketing_funnel_summary', 'sales_lead_followup_health'],
    requiredMetrics: ['lead_to_order_rate', 'orders'],
    approvalRequired: false,
    priority: 860,
  },
  {
    id: 'sales_sla_task_creation',
    name: 'Sales SLA task creation',
    domain: 'task',
    roles: ['director', 'manager', 'sales'],
    purpose: 'Create draft tasks for sales users when leads are overdue or unassigned.',
    exampleQuestions: [
      'Tao task cho sale xu ly lead qua han.',
      'Giao ai xu ly lead bi bo quen?',
      'Lead nao can sale goi ngay?',
    ],
    intent: 'sales_sla_task_creation',
    workflow: 'salesSlaTaskCreationWorkflow',
    responseContract: 'actionApproval',
    tokenPolicy: 'no_ai',
    requiredApis: ['sales_lead_followup_health', 'tasks_create_from_ai_issue'],
    requiredMetrics: ['lead_first_response_minutes'],
    decisionRules: ['sales_sla_escalation_rule'],
    approvalRequired: true,
    priority: 840,
  },
  {
    id: 'emergency_response',
    name: 'Emergency response',
    domain: 'solution',
    roles: ['owner', 'director', 'manager'],
    purpose: 'Suggest immediate steps when cashflow, ads, order or integration risk is severe.',
    exampleQuestions: [
      'Neu hom nay dong tien nguy hiem thi phai lam gi?',
      'Neu ads dang dot tien thi xu ly ngay the nao?',
      'Neu token Facebook loi thi xu ly the nao?',
    ],
    intent: 'emergency_response',
    workflow: 'emergencyResponseWorkflow',
    responseContract: 'solutionPlan',
    tokenPolicy: 'analysis_ai',
    requiredApis: [
      'finance_free_cash_summary',
      'ads_ad_group_profit_ranking',
      'orders_late_diagnostic',
      'integration_health_overview',
    ],
    requiredMetrics: ['free_cash', 'late_orders', 'sync_error_count'],
    approvalRequired: false,
    priority: 950,
  },
  {
    id: 'ai_task_or_action_draft',
    name: 'AI task or action draft',
    domain: 'approval',
    roles: ['owner', 'director', 'manager'],
    purpose: 'Turn a recommended management action into a draft that waits for approval.',
    exampleQuestions: [
      'Tao ke hoach cho duyet de giam ngan sach nhom quang cao dang lo.',
      'Tao draft thanh toan nha cung cap uu tien.',
      'Lap task xu ly issue nay.',
    ],
    intent: 'ai_task_or_action_draft',
    workflow: 'actionDraftWorkflow',
    responseContract: 'actionApproval',
    tokenPolicy: 'schema_ai',
    requiredApis: ['ai_actions_draft'],
    decisionRules: ['ads_scale_readiness_rule', 'owner_withdrawal_readiness_rule'],
    approvalRequired: true,
    priority: 940,
  },
];

export const AI_OPERATOR_REGRESSION_TEST_CASES: AiOperatorTestCase[] = [
  {
    id: 'PROD-Q001',
    question: 'San pham nao lai nhat nam vua roi?',
    role: 'director',
    expectedIntent: 'product_profit_ranking',
    expectedWorkflow: 'productProfitRankingWorkflow',
    expectedResponseContract: 'tableReport',
    expectedTokenMode: 'no_ai',
    shouldCallOpenAI: false,
    mustInclude: ['San pham', 'Doanh thu', 'Loi nhuan rong'],
    mustNotInclude: ['Toi doan', 'Co the la'],
    approvalExpected: false,
  },
  {
    id: 'ADS-Q010',
    question: 'Nhom quang cao nao mang lai nhieu loi nhuan nhat thang vua roi?',
    role: 'director',
    expectedIntent: 'ad_group_profit_ranking',
    expectedWorkflow: 'adGroupProfitRankingWorkflow',
    expectedResponseContract: 'tableReport',
    expectedTokenMode: 'no_ai',
    shouldCallOpenAI: false,
    mustInclude: ['Nhom quang cao', 'Spend', 'Loi nhuan sau ads'],
    mustNotInclude: ['Can duyet tang ngan sach'],
    approvalExpected: false,
  },
  {
    id: 'SOL-Q001',
    question: 'Neu chi lam 3 viec hom nay thi la viec gi?',
    role: 'director',
    expectedIntent: 'daily_priority_ranking',
    expectedWorkflow: 'dailyPriorityRankingWorkflow',
    expectedResponseContract: 'solutionPlan',
    expectedTokenMode: 'analysis_ai',
    shouldCallOpenAI: true,
    mustInclude: ['Uu tien', 'Ly do', 'Rui ro', 'Nguoi phu trach'],
    mustNotInclude: ['da thuc hien'],
    approvalExpected: false,
  },
  {
    id: 'ACT-Q001',
    question: 'Tao ke hoach cho duyet de giam ngan sach nhom quang cao dang lo.',
    role: 'manager',
    expectedIntent: 'ai_task_or_action_draft',
    expectedWorkflow: 'actionDraftWorkflow',
    expectedResponseContract: 'actionApproval',
    expectedTokenMode: 'schema_ai',
    shouldCallOpenAI: true,
    mustInclude: ['Ke hoach nhap', 'Can duyet', 'Ly do'],
    mustNotInclude: ['da giam ngan sach'],
    approvalExpected: true,
  },
];

export const BUSINESS_METRICS: BusinessMetric[] = [
  {
    id: 'net_profit_after_ads',
    name: 'Net profit after ads',
    domain: 'marketing',
    formula: 'grossProfit - adSpend - allocatedVariableCost',
    unit: 'vnd',
    ownerRole: 'director',
    sourceApis: ['/api/ads/ad-groups/profit-classification', '/api/ad-group-profit-report/performance'],
    goodDirection: 'higher_is_better',
    warningThreshold: 0,
    dangerThreshold: -1000000,
    description: 'Profit after ads and variable costs. Ads scale decisions must not ignore this metric.',
  },
  {
    id: 'orders',
    name: 'Orders',
    domain: 'orders',
    formula: 'count(finalized_orders)',
    unit: 'count',
    ownerRole: 'manager',
    sourceApis: ['/api/test-order2', '/api/ads/ad-groups/profit-classification'],
    goodDirection: 'higher_is_better',
    warningThreshold: 3,
    dangerThreshold: 0,
    description: 'Number of orders in the evaluated period.',
  },
  {
    id: 'cash_available_for_ads',
    name: 'Cash available for ads',
    domain: 'finance',
    formula: 'freeCash - survivalFloor - committedPayables',
    unit: 'vnd',
    ownerRole: 'director',
    sourceApis: ['/api/financial-control/dashboard', '/api/budget-allocation/preview'],
    goodDirection: 'higher_is_better',
    warningThreshold: 0,
    dangerThreshold: -1,
    description: 'Cash gate for increasing ads budget.',
  },
  {
    id: 'free_cash',
    name: 'Free cash',
    domain: 'finance',
    formula: 'cashBalance - committedPayables - reserves',
    unit: 'vnd',
    ownerRole: 'cfo',
    sourceApis: ['/api/financial-control/dashboard', '/api/finance/available-funds/current'],
    goodDirection: 'higher_is_better',
    warningThreshold: 0,
    dangerThreshold: -1,
    description: 'Spendable cash after committed cash and reserves.',
  },
  {
    id: 'cashflow_lowest_14d',
    name: 'Lowest projected cash',
    domain: 'finance',
    formula: 'min(dailyProjectedCash[0..14])',
    unit: 'vnd',
    ownerRole: 'cfo',
    sourceApis: ['/api/financial-control/forecast', '/api/finance/cashflow-health'],
    goodDirection: 'higher_is_better',
    warningThreshold: 0,
    dangerThreshold: -1,
    description: 'Near-term projected low point used by CFO gate.',
  },
  {
    id: 'lead_to_order_rate',
    name: 'Lead to order rate',
    domain: 'sales',
    formula: 'orders / leads',
    unit: 'percent',
    ownerRole: 'manager',
    sourceApis: ['/api/ai-marketing/leads/funnel', '/api/chat-messages/conversations/list/all'],
    goodDirection: 'higher_is_better',
    warningThreshold: 5,
    dangerThreshold: 1,
    description: 'Funnel conversion from lead/inbox to order.',
  },
  {
    id: 'attribution_quality_score',
    name: 'Attribution quality score',
    domain: 'marketing',
    formula: '100 - syncPenalty - missingMappingPenalty',
    unit: 'score',
    ownerRole: 'manager',
    sourceApis: ['/api/advertising-cost/sync/health', '/api/ad-groups', '/api/fanpages'],
    goodDirection: 'higher_is_better',
    warningThreshold: 70,
    dangerThreshold: 50,
    description: 'Confidence score for ads attribution, mapping and sync freshness.',
  },
  {
    id: 'current_cac',
    name: 'Current CAC',
    domain: 'marketing',
    formula: 'adSpend / paidOrders',
    unit: 'vnd',
    ownerRole: 'ads',
    sourceApis: ['/api/ad-report/cost-per-order', '/api/marketing/funnel-summary'],
    goodDirection: 'lower_is_better',
    description: 'Current customer acquisition cost.',
  },
  {
    id: 'allowable_cac',
    name: 'Allowable CAC',
    domain: 'finance',
    formula: 'contributionMarginPerOrder * targetPaybackRate',
    unit: 'vnd',
    ownerRole: 'cfo',
    sourceApis: ['/api/finance/unit-economics'],
    goodDirection: 'higher_is_better',
    description: 'Maximum CAC allowed by unit economics.',
  },
  {
    id: 'creative_frequency',
    name: 'Creative frequency',
    domain: 'marketing',
    formula: 'impressions / reach',
    unit: 'ratio',
    ownerRole: 'ads',
    sourceApis: ['/api/ads/creative-fatigue', '/api/ai-marketing/creatives/performance'],
    goodDirection: 'lower_is_better',
    warningThreshold: 3,
    dangerThreshold: 5,
    description: 'Frequency signal used to detect creative fatigue.',
  },
  {
    id: 'creative_ctr',
    name: 'Creative CTR',
    domain: 'marketing',
    formula: 'clicks / impressions',
    unit: 'percent',
    ownerRole: 'ads',
    sourceApis: ['/api/ads/creative-fatigue', '/api/ai-marketing/creatives/performance'],
    goodDirection: 'higher_is_better',
    warningThreshold: 1,
    dangerThreshold: 0.5,
    description: 'Click-through rate for creative health.',
  },
  {
    id: 'lead_first_response_minutes',
    name: 'Lead first response minutes',
    domain: 'sales',
    formula: 'firstContactAt - createdAt',
    unit: 'minute',
    ownerRole: 'sales',
    sourceApis: ['/api/chat-messages/conversations/list/all', '/api/tasks/ai-followup-status'],
    goodDirection: 'lower_is_better',
    warningThreshold: 30,
    dangerThreshold: 120,
    description: 'SLA metric for first contact after a new lead arrives.',
  },
  {
    id: 'late_orders',
    name: 'Late orders',
    domain: 'orders',
    formula: 'count(now > promisedDeliveryAt)',
    unit: 'count',
    ownerRole: 'manager',
    sourceApis: ['/api/test-order2', '/api/order-status'],
    goodDirection: 'lower_is_better',
    warningThreshold: 1,
    dangerThreshold: 10,
    description: 'Orders past SLA or delivery promise.',
  },
  {
    id: 'overdue_receivables',
    name: 'Overdue receivables',
    domain: 'finance',
    formula: 'sum(balance where dueAt < today)',
    unit: 'vnd',
    ownerRole: 'accountant',
    sourceApis: ['/api/supplier-payables/summary/cashflow', '/api/agent-receivables/summary'],
    goodDirection: 'lower_is_better',
    warningThreshold: 1,
    dangerThreshold: 10000000,
    description: 'Overdue receivable/payable exposure that can distort free-cash decisions.',
  },
];

export const DECISION_RULES: DecisionRule[] = [
  {
    id: 'ads_scale_readiness_rule',
    domain: 'marketing',
    decisionType: 'scale_ads',
    requiredMetrics: [
      'net_profit_after_ads',
      'orders',
      'cash_available_for_ads',
      'lead_to_order_rate',
      'attribution_quality_score',
    ],
    conditions: [
      {
        metric: 'net_profit_after_ads',
        operator: '>',
        value: 0,
        severityIfFailed: 'danger',
        messageIfFailed: 'Ad group is not profitable after ads.',
      },
      {
        metric: 'orders',
        operator: '>=',
        value: 3,
        severityIfFailed: 'warning',
        messageIfFailed: 'Order count is still too low for confident scale.',
      },
      {
        metric: 'cash_available_for_ads',
        operator: '>',
        value: 0,
        severityIfFailed: 'danger',
        messageIfFailed: 'Free cash does not allow additional ads budget.',
      },
      {
        metric: 'lead_to_order_rate',
        operator: '>',
        value: 0,
        severityIfFailed: 'warning',
        messageIfFailed: 'Lead-to-order conversion is missing or weak.',
      },
      {
        metric: 'attribution_quality_score',
        operator: '>=',
        value: 70,
        severityIfFailed: 'danger',
        messageIfFailed: 'Attribution/sync quality is too weak for an ads scale decision.',
      },
    ],
    outputIfPassed: 'Ads can be proposed for controlled scale.',
    outputIfFailed: 'Ads should not be scaled yet.',
    approvalRequired: true,
  },
  {
    id: 'owner_withdrawal_readiness_rule',
    domain: 'finance',
    decisionType: 'owner_withdrawal',
    requiredMetrics: ['free_cash', 'cashflow_lowest_14d'],
    conditions: [
      {
        metric: 'free_cash',
        operator: '>',
        value: 0,
        severityIfFailed: 'danger',
        messageIfFailed: 'Free cash is not positive after committed cash and reserves.',
      },
      {
        metric: 'cashflow_lowest_14d',
        operator: '>',
        value: 0,
        severityIfFailed: 'danger',
        messageIfFailed: 'Projected cash low point becomes negative in the near-term forecast.',
      },
    ],
    outputIfPassed: 'Owner withdrawal can be drafted for approval.',
    outputIfFailed: 'Owner withdrawal is blocked until free cash and forecast are safe.',
    approvalRequired: true,
  },
  {
    id: 'creative_fatigue_rule',
    domain: 'marketing',
    decisionType: 'replace_or_test_creative',
    requiredMetrics: ['creative_frequency', 'creative_ctr'],
    conditions: [
      {
        metric: 'creative_frequency',
        operator: '<=',
        value: 5,
        severityIfFailed: 'warning',
        messageIfFailed: 'Creative frequency is high; audience fatigue is likely.',
      },
      {
        metric: 'creative_ctr',
        operator: '>=',
        value: 0.5,
        severityIfFailed: 'warning',
        messageIfFailed: 'Creative CTR is weak.',
      },
    ],
    outputIfPassed: 'Creative is not blocked by fatigue signals.',
    outputIfFailed: 'Creative should be reviewed or tested with a new variant.',
    approvalRequired: false,
  },
  {
    id: 'sales_sla_escalation_rule',
    domain: 'sales',
    decisionType: 'sales_sla_task_creation',
    requiredMetrics: ['lead_first_response_minutes'],
    conditions: [
      {
        metric: 'lead_first_response_minutes',
        operator: '<=',
        value: 30,
        severityIfFailed: 'warning',
        messageIfFailed: 'Lead response exceeds warning SLA.',
      },
      {
        metric: 'lead_first_response_minutes',
        operator: '<=',
        value: 120,
        severityIfFailed: 'danger',
        messageIfFailed: 'Lead response exceeds danger SLA and should be escalated.',
      },
    ],
    outputIfPassed: 'Lead SLA is inside the expected response window.',
    outputIfFailed: 'Create draft tasks for overdue leads and escalate danger cases.',
    approvalRequired: true,
  },
];

export const RESPONSE_CONTRACTS: ResponseContractDefinition[] = [
  {
    id: 'executiveSummary',
    name: 'Executive Summary Contract',
    intentGroups: [
      'overview',
      'director_daily_overview',
      'business_risk_ranking',
      'company_kpi_scorecard',
      'root_cause_analysis',
      'anomaly_detection_daily',
      'priority_ranking',
      'owner_accountability_review',
      'target_gap_analysis',
      'period_comparison',
      'customer_value_analysis',
      'concise_role_briefing',
    ],
    requiredSections: ['conclusion', 'companyStatus', 'topIssues', 'keyNumbers', 'decisionsNeeded', 'recommendedFocus', 'risksIfNoAction'],
    schema: {
      conclusion: 'string',
      companyStatus: 'good|watch|risk|danger',
      topIssues: 'ManagementIssue[]',
      keyNumbers: '{name,value,status}[]',
      decisionsNeeded: '{title,urgency,approvalRequired}[]',
      recommendedFocus: 'string[]',
      risksIfNoAction: 'string[]',
    },
    guardrails: ['show top 3-7 issues only', 'state missing data before conclusion'],
  },
  {
    id: 'cfoDecision',
    name: 'CFO Decision Contract',
    intentGroups: [
      'finance',
      'free_cash_summary',
      'cashflow_forecast',
      'ads_budget_cashflow_gate',
      'advanced_cashflow_scenario',
      'scenario_analysis',
      'owner_withdrawal_readiness',
      'unit_economics',
    ],
    requiredSections: ['conclusion', 'cashStatus', 'freeCash', 'forecastRisk', 'allowedActions', 'blockedActions', 'paymentPriorities', 'risks'],
    schema: {
      conclusion: 'string',
      cashStatus: 'safe|watch|tight|danger',
      freeCash: 'number',
      forecastRisk: 'string',
      allowedActions: 'string[]',
      blockedActions: 'string[]',
      paymentPriorities: 'string[]',
      risks: 'string[]',
    },
    guardrails: ['do not approve ads scale when free cash gate fails', 'do not approve owner withdrawal when free cash is insufficient'],
  },
  {
    id: 'marketingOptimization',
    name: 'Marketing Optimization Contract',
    intentGroups: [
      'ads',
      'marketing_funnel_health',
      'creative_fatigue_review',
      'offer_performance_review',
      'channel_mix_review',
      'channel_profitability_review',
      'product_decision_review',
      'resource_allocation_decision',
      'ads_scale_readiness',
      'ads_kill_or_pause_recommendation',
    ],
    requiredSections: ['conclusion', 'profitableGroups', 'lossGroups', 'scaleCandidates', 'pauseCandidates', 'creativeIssues', 'funnelBottlenecks', 'financeGate', 'recommendedActions'],
    schema: {
      conclusion: 'string',
      profitableGroups: 'unknown[]',
      lossGroups: 'unknown[]',
      watchGroups: 'unknown[]',
      scaleCandidates: 'unknown[]',
      pauseCandidates: 'unknown[]',
      creativeIssues: 'unknown[]',
      funnelBottlenecks: 'unknown[]',
      financeGate: '{allowed,maxAdditionalBudget?,reason}',
      recommendedActions: 'unknown[]',
    },
    guardrails: ['cashflow gate before scale', 'do not blame ads when sales SLA is severely violated'],
  },
  {
    id: 'actionApproval',
    name: 'Action Approval Contract',
    intentGroups: ['decision_waiting_approval', 'sales_sla_task_creation', 'ai_recommendation_review'],
    requiredSections: ['proposedAction', 'entity', 'beforeState', 'afterState', 'reason', 'expectedImpact', 'risks', 'requiredApproval', 'status'],
    schema: {
      proposedAction: 'string',
      entity: 'string',
      beforeState: 'unknown',
      afterState: 'unknown',
      reason: 'string',
      expectedImpact: 'string',
      risks: 'string[]',
      requiredApproval: 'string',
      status: 'draft|waiting_approval|approved|executed',
    },
    guardrails: ['never say executed before executor confirms success', 'approval stores before/after state'],
  },
];

export const WORKFLOW_TOKEN_BUDGETS: WorkflowTokenBudget[] = [
  {
    workflowId: 'ad_group_profit_classification',
    defaultMode: 'no_ai',
    maxInputTokens: 0,
    maxOutputTokens: 600,
    rawRowsLimit: 20,
    allowChatHistory: false,
    allowApiCatalog: false,
  },
  {
    workflowId: 'ads_budget_cashflow_gate',
    defaultMode: 'small_ai',
    maxInputTokens: 2500,
    maxOutputTokens: 900,
    rawRowsLimit: 5,
    allowChatHistory: false,
    allowApiCatalog: false,
  },
  {
    workflowId: 'marketing_funnel_health',
    defaultMode: 'analysis_ai',
    maxInputTokens: 4500,
    maxOutputTokens: 1200,
    rawRowsLimit: 10,
    allowChatHistory: false,
    allowApiCatalog: false,
  },
  {
    workflowId: 'creative_fatigue_review',
    defaultMode: 'small_ai',
    maxInputTokens: 2500,
    maxOutputTokens: 800,
    rawRowsLimit: 10,
    allowChatHistory: false,
    allowApiCatalog: false,
  },
  {
    workflowId: 'sales_sla_task_creation',
    defaultMode: 'no_ai',
    maxInputTokens: 0,
    maxOutputTokens: 700,
    rawRowsLimit: 20,
    allowChatHistory: false,
    allowApiCatalog: false,
  },
  {
    workflowId: 'schema_decision_output',
    defaultMode: 'schema_ai',
    maxInputTokens: 2500,
    maxOutputTokens: 900,
    rawRowsLimit: 5,
    allowChatHistory: false,
    allowApiCatalog: false,
  },
];

export const SLA_RULES: SlaRule[] = [
  {
    id: 'lead_first_call_warning',
    entity: 'lead',
    condition: 'new lead has no first contact',
    warningAfterMinutes: 30,
    dangerAfterMinutes: 120,
    ownerRole: 'sales',
    actionWhenViolated: 'create_task',
  },
  {
    id: 'order_late_delivery',
    entity: 'order',
    condition: 'order is past promised delivery date',
    warningAfterMinutes: 1440,
    dangerAfterMinutes: 4320,
    ownerRole: 'manager',
    actionWhenViolated: 'escalate',
  },
  {
    id: 'receivable_overdue',
    entity: 'receivable',
    condition: 'receivable is overdue',
    warningAfterMinutes: 10080,
    dangerAfterMinutes: 43200,
    ownerRole: 'accountant',
    actionWhenViolated: 'notify',
  },
];

export function listAiOperatorV2Registries() {
  return {
    apiCatalog: ERP_API_CATALOG_V2,
    managementSituations: MANAGEMENT_SITUATIONS,
    metrics: BUSINESS_METRICS,
    decisionRules: DECISION_RULES,
    responseContracts: RESPONSE_CONTRACTS,
    workflowTokenBudgets: WORKFLOW_TOKEN_BUDGETS,
    slaRules: SLA_RULES,
    regressionTestCases: AI_OPERATOR_REGRESSION_TEST_CASES,
  };
}

export function responseContractForV2Intent(intent: AiOperatorIntent | string): ResponseContractDefinition {
  return (
    RESPONSE_CONTRACTS.find((contract) => contract.intentGroups.includes(String(intent))) ||
    RESPONSE_CONTRACTS.find((contract) => contract.id === 'executiveSummary') ||
    RESPONSE_CONTRACTS[0]
  );
}

export function buildDataQualityReport(params: {
  route: AiOperatorContextRoute;
  sources: Record<string, AiSourceResult>;
  dataGaps: string[];
}): DataQualityReport {
  const failedSources = Object.entries(params.sources || {})
    .filter(([, result]) => result?.ok === false)
    .map(([source, result]) => ({ source, error: String(result?.error || 'unknown') }));
  const permissionDenied = failedSources.filter((item) => item.error.startsWith('permission_denied'));
  const syncIssues = failedSources
    .filter((item) => item.source.includes('sync') || item.source.includes('token') || item.error.includes('sync'))
    .map((item) => `${item.source}: ${item.error}`);
  const attributionIssues: string[] = [];
  const routeText = `${params.route.intent} ${params.route.scenarioTitle || ''}`.toLowerCase();
  if ((routeText.includes('ads') || routeText.includes('marketing')) && !params.sources['advertising-cost.sync-health']?.ok) {
    attributionIssues.push('ads sync health source is not loaded');
  }
  if ((routeText.includes('ads') || routeText.includes('marketing')) && !params.sources['ad-groups']?.ok) {
    attributionIssues.push('ad group mapping source is not loaded');
  }

  let score = 100;
  score -= permissionDenied.length * 18;
  score -= (failedSources.length - permissionDenied.length) * 15;
  score -= Math.min(25, (params.dataGaps || []).length * 5);
  score -= Math.min(20, syncIssues.length * 10);
  score -= Math.min(20, attributionIssues.length * 10);
  if (params.route.apiSufficiency === 'partial') score -= 8;
  if (params.route.apiSufficiency === 'missing') score -= 25;
  if (params.route.blocked) score -= 35;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const status: DataQualityStatus =
    score >= 85 ? 'good' :
    score >= 65 ? 'usable' :
    score >= 40 ? 'weak' :
    'bad';

  const missingFields = [
    ...permissionDenied.map((item) => item.source),
    ...(params.dataGaps || []).filter(Boolean),
  ].slice(0, 12);

  const warningMessages = [
    ...failedSources.map((item) => `${item.source}: ${item.error}`),
    ...attributionIssues,
    ...(status === 'bad' ? ['dataQuality is bad: do not make a firm business conclusion'] : []),
  ].slice(0, 12);

  return {
    score,
    status,
    missingFields,
    staleSources: [],
    syncIssues,
    attributionIssues,
    permissionIssues: permissionDenied.map((item) => `${item.source}: ${item.error}`),
    warningMessages,
  };
}

export function extractBusinessMetricsFromContext(context: any, dataQuality?: DataQualityReport): Record<string, number> {
  const metrics: Record<string, number> = {};
  const setMetric = (key: string, value: any) => {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) metrics[key] = numeric;
  };

  const dashboard = context?.finance?.dashboard || {};
  const forecast = context?.finance?.forecastLowPoint || {};
  const budgetPreview = context?.strategic?.budgetPreview || context?.manager?.budgetPreview || {};
  const profitClassification = context?.ads?.profitClassification || {};
  const profitGroups = Array.isArray(profitClassification.groups) ? profitClassification.groups : [];
  const performanceRows = Array.isArray(context?.ads?.worstAdGroups) ? context.ads.worstAdGroups : [];
  const orders = context?.orders || {};
  const marketing = context?.aiMarketing?.decision || context?.manager?.marketing || {};
  const costPerOrder = context?.ads?.costPerOrder || {};
  const receivables = context?.receivables || {};

  setMetric('free_cash', dashboard.freeCash);
  setMetric('cashflow_lowest_14d', forecast.lowPoint);
  setMetric('cash_available_for_ads', firstFinite(
    dashboard.availableAfterSurvival,
    budgetPreview.availableAfterSurvival,
    budgetPreview.summary?.availableFunds,
    dashboard.freeCash,
  ));
  setMetric('orders', firstFinite(
    profitClassification.summary?.orders,
    orders.totalInWindow,
    profitGroups.reduce((sum: number, row: any) => sum + Number(row.orders || 0), 0),
  ));
  setMetric('net_profit_after_ads', firstFinite(
    profitClassification.summary?.netProfitAfterAds,
    profitGroups.reduce((sum: number, row: any) => sum + Number(row.netProfitAfterAds || 0), 0),
    performanceRows.reduce((sum: number, row: any) => sum + Number(row.totalNetProfit || 0), 0),
  ));
  setMetric('lead_to_order_rate', firstFinite(
    marketing.rates?.leadToOrderRate,
    marketing.funnel?.leadToOrderRate,
    marketing.overview?.funnel?.leadToOrderRate,
  ));
  setMetric('current_cac', firstFinite(
    costPerOrder.summary?.blendedCostPerOrder,
    marketing.rates?.cpl,
  ));
  setMetric('allowable_cac', firstFinite(marketing.unitEconomics?.allowableCAC));
  setMetric('creative_frequency', firstFinite(
    marketing.creativeSummary?.avgFrequency,
    marketing.creatives?.summary?.avgFrequency,
  ));
  setMetric('creative_ctr', firstFinite(
    marketing.creativeSummary?.avgCtr,
    marketing.creatives?.summary?.avgCtr,
  ));
  setMetric('late_orders', firstFinite(
    orders.lateCount,
    orders.overdueCount,
  ));
  setMetric('overdue_receivables', firstFinite(
    sumArray(receivables.supplier?.overdue, 'balance') + sumArray(receivables.agent?.overdue, 'closingBalance'),
  ));

  const attributionPenalty =
    (dataQuality?.syncIssues?.length || 0) * 20 +
    (dataQuality?.attributionIssues?.length || 0) * 20;
  setMetric('attribution_quality_score', Math.max(0, 100 - attributionPenalty));

  return metrics;
}

export function evaluateDecision(request: DecisionEvaluationRequest): DecisionEvaluationResult {
  const rule = DECISION_RULES.find((item) => item.decisionType === request.decisionType || item.id === request.decisionType);
  if (!rule) {
    return {
      decisionType: request.decisionType,
      ruleId: null,
      status: 'unknown',
      allowed: false,
      approvalRequired: true,
      conclusion: 'No decision rule is registered for this decision type.',
      confidence: 0.2,
      failedConditions: [],
      missingMetrics: [],
      issues: [],
      recommendedActions: [
        {
          actionType: 'define_decision_rule',
          title: 'Define a decision rule before making this decision',
          reason: `Missing rule for ${request.decisionType}.`,
          riskLevel: 'medium',
          approvalRequired: false,
        },
      ],
      dataQuality: request.dataQuality || null,
    };
  }

  const missingMetrics = rule.requiredMetrics.filter((metric) => !Number.isFinite(Number(request.metrics?.[metric])));
  const failedConditions = rule.conditions
    .map((condition) => ({
      ...condition,
      actualValue: Number.isFinite(Number(request.metrics?.[condition.metric])) ? Number(request.metrics?.[condition.metric]) : null,
    }))
    .filter((condition) => condition.actualValue == null || !passesCondition(condition.actualValue, condition.operator, condition.value));

  const hasDanger = failedConditions.some((condition) => condition.severityIfFailed === 'danger');
  const dataQualityBad = request.dataQuality?.status === 'bad';
  const allowed = failedConditions.length === 0 && !dataQualityBad;
  const status: DecisionEvaluationResult['status'] = allowed
    ? 'passed'
    : hasDanger || dataQualityBad
      ? 'blocked'
      : 'needs_review';

  const issues = failedConditions.map((condition, index) => buildIssueFromFailedCondition(rule, condition, index));
  if (dataQualityBad) {
    issues.unshift({
      id: `${rule.id}:data_quality_bad`,
      domain: rule.domain,
      title: 'Data quality is bad',
      severity: 'danger',
      severityScore: 85,
      urgency: 'today',
      ownerRole: 'manager',
      recommendedAction: 'Fix missing/sync/attribution data before making a strong decision.',
    });
  }

  const recommendedActions: RecommendedAction[] = allowed
    ? [
        {
          actionType: rule.decisionType,
          title: rule.outputIfPassed,
          reason: 'All registered decision conditions passed.',
          riskLevel: rule.approvalRequired ? 'medium' : 'low',
          approvalRequired: rule.approvalRequired,
        },
      ]
    : [
        {
          actionType: `fix_${rule.decisionType}_blockers`,
          title: rule.outputIfFailed,
          reason: failedConditions.map((item) => item.messageIfFailed).join(' '),
          riskLevel: hasDanger || dataQualityBad ? 'high' : 'medium',
          approvalRequired: false,
        },
      ];

  const confidenceBase = request.dataQuality ? request.dataQuality.score / 100 : 0.75;
  const confidencePenalty = Math.min(0.45, failedConditions.length * 0.08 + missingMetrics.length * 0.08);

  return {
    decisionType: rule.decisionType,
    ruleId: rule.id,
    status,
    allowed,
    approvalRequired: rule.approvalRequired,
    conclusion: allowed ? rule.outputIfPassed : rule.outputIfFailed,
    confidence: Math.max(0.1, Number((confidenceBase - confidencePenalty).toFixed(2))),
    failedConditions,
    missingMetrics,
    issues,
    recommendedActions,
    dataQuality: request.dataQuality || null,
  };
}

export function buildDecisionSupport(params: {
  route: AiOperatorContextRoute;
  context: any;
  sources: Record<string, AiSourceResult>;
  dataGaps: string[];
  recommendations: AiOperatorRecommendation[];
}): {
  dataQuality: DataQualityReport;
  metrics: Record<string, number>;
  evaluations: DecisionEvaluationResult[];
  responseContract: ResponseContractDefinition;
  workflowResult: WorkflowResult;
} {
  const dataQuality = buildDataQualityReport({
    route: params.route,
    sources: params.sources,
    dataGaps: params.dataGaps,
  });
  const metrics = extractBusinessMetricsFromContext(params.context, dataQuality);
  const decisionTypes = decisionTypesForIntent(params.route.intent);
  const evaluations = decisionTypes.map((decisionType) => evaluateDecision({ decisionType, metrics, dataQuality }));
  const issues = evaluations.flatMap((item) => item.issues).sort((a, b) => b.severityScore - a.severityScore).slice(0, 7);
  const recommendedActions = [
    ...evaluations.flatMap((item) => item.recommendedActions),
    ...(params.recommendations || []).slice(0, 5).map((item) => ({
      actionType: item.type,
      title: item.title,
      reason: item.reason,
      riskLevel: item.riskLevel,
      approvalRequired: item.requiresApproval,
    })),
  ].slice(0, 8);
  const responseContract = responseContractForV2Intent(params.route.intent);

  return {
    dataQuality,
    metrics,
    evaluations,
    responseContract,
    workflowResult: {
      workflowId: params.route.scenarioId || params.route.intent,
      intent: params.route.intent,
      data: params.context,
      dataQuality,
      issues,
      recommendedActions,
      permissions: {
        allowed: !params.route.blocked,
        deniedSources: params.route.deniedSources || [],
      },
      approval: params.route.approvalRequired || evaluations.some((item) => item.approvalRequired)
        ? {
            required: true,
            reason: 'Decision/action requires approval before execution.',
            requiredApproverRole: approvalRoleForIntent(params.route.intent),
          }
        : undefined,
    },
  };
}

export function decisionTypesForIntent(intent: AiOperatorIntent | string): string[] {
  switch (intent) {
    case 'ads_budget_cashflow_gate':
    case 'ads_scale_readiness':
    case 'ads':
      return ['scale_ads'];
    case 'owner_withdrawal_readiness':
      return ['owner_withdrawal'];
    case 'creative_fatigue_review':
      return ['replace_or_test_creative'];
    case 'sales_sla_violation':
    case 'sales_sla_task_creation':
    case 'lead_followup_health':
      return ['sales_sla_task_creation'];
    default:
      return [];
  }
}

function firstFinite(...values: any[]): number | undefined {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return undefined;
}

function sumArray(rows: any, field: string): number {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((sum, row) => sum + Number(row?.[field] || 0), 0);
}

function passesCondition(actual: number, operator: DecisionOperator, expected: number | [number, number]): boolean {
  switch (operator) {
    case '>':
      return actual > Number(expected);
    case '>=':
      return actual >= Number(expected);
    case '<':
      return actual < Number(expected);
    case '<=':
      return actual <= Number(expected);
    case '=':
      return actual === Number(expected);
    case 'between':
      return Array.isArray(expected) && actual >= expected[0] && actual <= expected[1];
    default:
      return false;
  }
}

function buildIssueFromFailedCondition(
  rule: DecisionRule,
  condition: DecisionCondition & { actualValue: number | null },
  index: number,
): ManagementIssue {
  const severity = condition.severityIfFailed === 'danger' ? 'danger' : condition.severityIfFailed;
  const financialImpactScore = condition.metric.includes('cash') || condition.metric.includes('profit') ? 80 : 35;
  const urgencyScore = severity === 'danger' ? 90 : severity === 'warning' ? 60 : 30;
  const customerImpactScore = condition.metric.includes('lead') || condition.metric.includes('order') ? 70 : 30;
  const repeatFrequencyScore = 50;
  const severityScore = Math.round(
    financialImpactScore * 0.4 +
    urgencyScore * 0.25 +
    customerImpactScore * 0.2 +
    repeatFrequencyScore * 0.15,
  );

  return {
    id: `${rule.id}:${condition.metric}:${index + 1}`,
    domain: rule.domain,
    title: condition.messageIfFailed,
    severity,
    severityScore,
    urgency: severity === 'danger' ? 'today' : 'this_week',
    ownerRole: ownerRoleForMetric(condition.metric),
    recommendedAction: actionForFailedMetric(condition.metric),
  };
}

function ownerRoleForMetric(metric: string): string {
  if (metric.includes('cash') || metric.includes('free')) return 'cfo';
  if (metric.includes('lead')) return 'sales';
  if (metric.includes('creative') || metric.includes('attribution') || metric.includes('profit')) return 'ads';
  return 'manager';
}

function actionForFailedMetric(metric: string): string {
  if (metric.includes('cash') || metric.includes('free')) return 'Review free cash, committed cash and forecast before approval.';
  if (metric.includes('attribution')) return 'Fix sync/mapping/attribution before making ads decisions.';
  if (metric.includes('lead')) return 'Create follow-up tasks and check sales SLA.';
  if (metric.includes('creative')) return 'Prepare new creative variants for testing.';
  if (metric.includes('orders')) return 'Wait for more orders or reduce scale confidence.';
  return 'Review the metric owner and update source data.';
}

function approvalRoleForIntent(intent: AiOperatorIntent | string): string {
  if (String(intent).includes('owner')) return 'owner';
  if (String(intent).includes('cash') || String(intent).includes('finance')) return 'director';
  if (String(intent).includes('ads')) return 'director';
  return 'manager';
}
