export interface AiSourceResult<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface AiOperatorRecommendation {
  id: string;
  type: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  reason: string;
  proposedAction: string;
  requiresApproval: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  source?: {
    module: string;
    id?: string;
    linkTo?: string;
  };
}

export interface AiOperatorSnapshot {
  generatedAt: string;
  windowDays: number;
  finance: {
    dashboard: AiSourceResult;
    forecast: AiSourceResult;
    optimalAds: AiSourceResult;
    actions: AiSourceResult;
  };
  ads: {
    performance: AiSourceResult;
    profitClassification?: AiSourceResult;
    optimalSpendSuggestions: AiSourceResult;
    alerts: AiSourceResult;
    diagnostic?: AiSourceResult;
    syncHealth?: AiSourceResult;
    costByAdGroup?: AiSourceResult;
    costPerOrder?: AiSourceResult;
  };
  orders: AiSourceResult;
  returns?: AiSourceResult;
  receivables: AiSourceResult;
  operations: AiSourceResult;
  businessFacts?: AiSourceResult;
  manager?: {
    employeeKpi?: AiSourceResult;
    tokenHealth?: AiSourceResult;
    budgetPreview?: AiSourceResult;
    marketing?: AiSourceResult;
    conversations?: AiSourceResult;
    pendingOrders?: AiSourceResult;
    media?: AiSourceResult;
    adEntities?: AiSourceResult;
  };
  strategic: {
    fundsOverview: AiSourceResult;
    availableFunds: AiSourceResult;
    budgetPreview: AiSourceResult;
    loanDashboard: AiSourceResult;
    ownerFund: AiSourceResult;
    laborCashflow: AiSourceResult;
    otherCostCashflow: AiSourceResult;
    adsCostCashflow: AiSourceResult;
    aiMarketingOverview: AiSourceResult;
    aiMarketingPlans: AiSourceResult;
    aiMarketingEvaluations: AiSourceResult;
    quoteReadiness: AiSourceResult;
    accessAudit: AiSourceResult;
  };
  dataGaps: string[];
}

export interface AiOperatorTokenStatus {
  activeOpenAIConfigs: number;
  defaultOpenAIConfigs: number;
  totalOpenAIConfigs: number;
  byPurpose: {
    adminAssistant: { total: number; active: number; default: number };
    customerChatbot: { total: number; active: number; default: number };
    general: { total: number; active: number; default: number };
  };
  configs: any[];
}

export type AiOperatorIntent =
  | 'overview'
  | 'director_daily_overview'
  | 'director_weekly_priority'
  | 'business_risk_ranking'
  | 'decision_waiting_approval'
  | 'company_kpi_scorecard'
  | 'root_cause_analysis'
  | 'anomaly_detection_daily'
  | 'priority_ranking'
  | 'resource_allocation_decision'
  | 'owner_accountability_review'
  | 'finance'
  | 'free_cash_summary'
  | 'cashflow_forecast'
  | 'ads_budget_cashflow_gate'
  | 'advanced_cashflow_scenario'
  | 'target_gap_analysis'
  | 'period_comparison'
  | 'scenario_analysis'
  | 'owner_withdrawal_readiness'
  | 'supplier_payment_priority'
  | 'receivables_collection_priority'
  | 'double_payment_risk'
  | 'tax_cash_reserve_check'
  | 'unit_economics'
  | 'ads'
  | 'ad_group_profit_classification'
  | 'ads_diagnostic_checklist'
  | 'marketing_funnel_health'
  | 'creative_fatigue_review'
  | 'offer_performance_review'
  | 'channel_mix_review'
  | 'channel_profitability_review'
  | 'ads_scale_readiness'
  | 'ads_kill_or_pause_recommendation'
  | 'lead_quality_by_campaign'
  | 'attribution_quality_check'
  | 'product_count'
  | 'product_list'
  | 'product_profit_leaderboard'
  | 'product_decision_review'
  | 'fanpage_performance_lookup'
  | 'chatbot_fanpage_performance_lookup'
  | 'agent_revenue_leaderboard'
  | 'agent_profit_leaderboard'
  | 'ads_product_profit_leaderboard'
  | 'product_ads_revenue_ratio'
  | 'orders'
  | 'late_order_diagnostic'
  | 'fulfillment_bottleneck'
  | 'tracking_issue_check'
  | 'cancel_refund_risk'
  | 'supplier_delay_risk'
  | 'receivables'
  | 'operations'
  | 'token'
  | 'token_health_check'
  | 'fanpage_permission_check'
  | 'platform_sync_health'
  | 'openai_config_health'
  | 'webhook_failure_diagnostic'
  | 'api'
  | 'sales'
  | 'customer_value_analysis'
  | 'lead_followup_health'
  | 'sales_conversion_by_user'
  | 'lead_quality_by_source'
  | 'lost_reason_summary'
  | 'sales_sla_violation'
  | 'sales_sla_task_creation'
  | 'quote_readiness'
  | 'supplier'
  | 'ai_recommendation_review'
  | 'concise_role_briefing'
  | 'loose';

export type AiOperatorTokenMode = 'no_ai' | 'small_ai' | 'schema_ai' | 'analysis_ai' | 'deep_ai';

export interface AiOperatorTokenPolicy {
  mode: AiOperatorTokenMode;
  maxInputTokens: number;
  maxOutputTokens: number;
  includeApiCatalog: boolean;
  includeLoadedSourcesList: boolean;
  includeAssistantQuality: boolean;
  includeDataGaps: boolean;
  includeChatHistoryTurns: number;
  includeTaskSummary: boolean;
  includeRawRowsLimit: number;
  includeDebugTrace: boolean;
}

export interface AiOperatorContextRoute {
  intent: AiOperatorIntent;
  scenarioId?: string | null;
  scenarioTitle?: string | null;
  apiSufficiency?: string | null;
  executionMode?: string | null;
  approvalRequired?: boolean;
  blocked?: boolean;
  blockedReason?: string | null;
  deniedSources?: string[];
  tokenPolicy?: AiOperatorTokenPolicy;
  reason: string;
}

export type AiOperatorAgentStatus = 'ok' | 'warn' | 'blocked' | 'skipped';

export interface AiOperatorAgentTraceStep {
  agent: string;
  status: AiOperatorAgentStatus;
  summary: string;
  inputs?: string[];
  outputs?: string[];
  guardrails?: string[];
}

export interface AiOperatorAgentTrace {
  mode: 'read_only' | 'approval_only';
  generatedAt: string;
  traceId: string;
  steps: AiOperatorAgentTraceStep[];
}

export interface AiOperatorAuthContext {
  userId: string | null;
  role: string | null;
  requestedRole?: string | null;
  fullName?: string | null;
  permissions: string[];
}

export interface AiOperatorScenarioContext {
  success: true;
  generatedAt: string;
  windowDays: number;
  role: string | null;
  auth: AiOperatorAuthContext;
  route: AiOperatorContextRoute;
  context: any;
  sources: Record<string, AiSourceResult>;
  recommendations: AiOperatorRecommendation[];
  dataGaps: string[];
  tokenPolicy?: AiOperatorTokenPolicy;
  agentTrace?: AiOperatorAgentTrace;
}
