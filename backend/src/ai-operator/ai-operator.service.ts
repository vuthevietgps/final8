import {
  normalizeIntent,
  isConciseRoleBriefingRequest,
  isAiRecommendationReviewRequest,
  isRootCauseAnalysisRequest,
  isAnomalyDetectionRequest,
  isPriorityRankingRequest,
  isTargetGapAnalysisRequest,
  isPeriodComparisonRequest,
  isProductAdsRevenueRatioQuestion,
  isAdsProductProfitQuestion,
  isProductDecisionReviewRequest,
  isProductPerformanceQuestion,
  isProductProfitLeaderboardQuestion,
  isProductCountQuestion,
  isProductListQuestion,
  isChatbotFanpagePerformanceQuestion,
  isFanpagePerformanceQuestion,
  isCustomerValueAnalysisRequest,
  isCustomerValueOrCareRequest,
  isAgentRevenueLeaderboardQuestion,
  isAgentProfitLeaderboardQuestion,
  isDecisionWaitingApprovalRequest,
  isBusinessRiskRankingRequest,
  isCompanyKpiScorecardRequest,
  isExecutiveDailyOverviewRequest,
  isOwnerAccountabilityRequest,
  isPeoplePerformanceRequest,
  isAdGroupProfitClassificationRequest,
  isAdsBudgetCashflowGateRequest,
  isAdsScaleReadinessRequest,
  isAdsKillOrPauseRequest,
  isChannelProfitabilityRequest,
  isChannelMixReviewRequest,
  isResourceAllocationDecisionRequest,
  isSalesSlaTaskCreationRequest,
  isSalesSlaViolationRequest,
  isLeadQualityBySourceRequest,
  isSalesConversionByUserRequest,
  isLeadFollowupHealthRequest,
  isMarketingFunnelHealthRequest,
  isCreativeFatigueRequest,
  isOfferPerformanceRequest,
  isAdsDiagnosticChecklistRequest,
  isLateOrderDiagnosticRequest,
  isFulfillmentBottleneckRequest,
  isTrackingIssueRequest,
  isCancelRefundRiskRequest,
  isCashflowForecastRequest,
  isAdvancedCashflowScenarioRequest,
  isScenarioAnalysisRequest,
  isReceivablesCollectionPriorityRequest,
  isSupplierPaymentPriorityRequest,
  isTokenHealthCheckRequest,
  isFanpagePermissionCheckRequest,
  isPlatformSyncHealthRequest,
  isOpenAiConfigHealthRequest,
  isWebhookFailureRequest,
  intentFromTextOrRole,
} from './ai-operator.intent';
import { buildRecommendations } from './ai-operator.recommendations';
import {
  buildNoAiTokenUsage,
  buildAiModelInput,
  estimateTokenCount,
  supportsReasoningEffort,
  normalizeReasoningEffort,
  buildOpenAiTokenUsage,
} from './ai-operator.model-input';
import {
  ensureVietnameseUiResponse,
  enforceOperatorResponseContract,
} from './ai-operator.response-format';
import {
  buildPermissionDeniedAnswer,
  buildRuleBasedAnswer,
} from './ai-operator.answers';
import { removeVietnameseTone, asArray } from './ai-operator.format';
import { BUSINESS_FACT_INTENTS } from './ai-operator.intent';
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { AdsAlertsService } from '../ads-alerts/ads-alerts.service';
import { AdGroupProfitReportService } from '../ad-group-profit-report/ad-group-profit-report.service';
import { FinancialControlService } from '../finance/financial-control.service';
import { OpenAIConfigService } from '../openai-config/openai-config.service';
import { OpsActionService } from '../ops-action/ops-action.service';
import {
  buildAiAssistantQualityDirectives,
  gradeAssistantConfidence,
} from '../common/ai-assistant-quality';
import {
  AiOperatorAuthContext,
  AiOperatorAgentTrace,
  AiOperatorContextRoute,
  AiOperatorIntent,
  AiOperatorRecommendation,
  AiOperatorScenarioContext,
  AiOperatorSnapshot,
  AiSourceResult,
  AiOperatorTokenStatus,
  AiOperatorTokenPolicy,
} from './ai-operator.interfaces';
import {
  AI_TOKEN_MANAGEMENT_GUIDE,
  buildAiOperatorKnowledge,
  ERP_API_CATALOG,
  SCENARIO_WORKFLOWS,
  ScenarioWorkflow,
} from './ai-operator.knowledge';
import {
  buildDecisionSupport,
  evaluateDecision,
  listAiOperatorV2Registries,
} from './ai-operator.v2-registry';
import { AiOperatorOperationsReader } from './ai-operator.operations-reader';
import { AiOperatorBusinessReader } from './ai-operator.business-reader';
import { AiOperatorAdsReader } from './ai-operator.ads-reader';
import { AiOperatorFinanceReader } from './ai-operator.finance-reader';
import { DAY_MS } from './ai-operator.snapshot-utils';
import { buildAuthContext } from './ai-operator.auth-context';
import { AiOperatorSessionService } from './ai-operator.session.service';


const DEFAULT_AI_OPERATOR_TOKEN_POLICY: AiOperatorTokenPolicy = {
  mode: 'analysis_ai',
  maxInputTokens: 6000,
  maxOutputTokens: 1200,
  includeApiCatalog: false,
  includeLoadedSourcesList: false,
  includeAssistantQuality: true,
  includeDataGaps: true,
  includeChatHistoryTurns: 0,
  includeTaskSummary: true,
  includeRawRowsLimit: 10,
  includeDebugTrace: false,
};

const BUSINESS_FACT_TOKEN_POLICY: AiOperatorTokenPolicy = {
  mode: 'no_ai',
  maxInputTokens: 0,
  maxOutputTokens: 700,
  includeApiCatalog: false,
  includeLoadedSourcesList: false,
  includeAssistantQuality: true,
  includeDataGaps: true,
  includeChatHistoryTurns: 0,
  includeTaskSummary: false,
  includeRawRowsLimit: 20,
  includeDebugTrace: false,
};

const AI_OPERATOR_TOKEN_POLICIES: Partial<
  Record<AiOperatorIntent, AiOperatorTokenPolicy>
> = {
  director_daily_overview: {
    mode: 'analysis_ai',
    maxInputTokens: 4500,
    maxOutputTokens: 1200,
    includeApiCatalog: false,
    includeLoadedSourcesList: false,
    includeAssistantQuality: true,
    includeDataGaps: true,
    includeChatHistoryTurns: 0,
    includeTaskSummary: true,
    includeRawRowsLimit: 8,
    includeDebugTrace: false,
  },
  company_kpi_scorecard: {
    mode: 'small_ai',
    maxInputTokens: 3000,
    maxOutputTokens: 900,
    includeApiCatalog: false,
    includeLoadedSourcesList: false,
    includeAssistantQuality: true,
    includeDataGaps: true,
    includeChatHistoryTurns: 0,
    includeTaskSummary: true,
    includeRawRowsLimit: 6,
    includeDebugTrace: false,
  },
  free_cash_summary: {
    mode: 'small_ai',
    maxInputTokens: 2500,
    maxOutputTokens: 900,
    includeApiCatalog: false,
    includeLoadedSourcesList: false,
    includeAssistantQuality: true,
    includeDataGaps: true,
    includeChatHistoryTurns: 0,
    includeTaskSummary: true,
    includeRawRowsLimit: 5,
    includeDebugTrace: false,
  },
  cashflow_forecast: {
    mode: 'small_ai',
    maxInputTokens: 3000,
    maxOutputTokens: 900,
    includeApiCatalog: false,
    includeLoadedSourcesList: false,
    includeAssistantQuality: true,
    includeDataGaps: true,
    includeChatHistoryTurns: 0,
    includeTaskSummary: true,
    includeRawRowsLimit: 5,
    includeDebugTrace: false,
  },
  ads_budget_cashflow_gate: {
    mode: 'small_ai',
    maxInputTokens: 2500,
    maxOutputTokens: 900,
    includeApiCatalog: false,
    includeLoadedSourcesList: false,
    includeAssistantQuality: true,
    includeDataGaps: true,
    includeChatHistoryTurns: 0,
    includeTaskSummary: true,
    includeRawRowsLimit: 5,
    includeDebugTrace: false,
  },
  unit_economics: {
    mode: 'small_ai',
    maxInputTokens: 3000,
    maxOutputTokens: 900,
    includeApiCatalog: false,
    includeLoadedSourcesList: false,
    includeAssistantQuality: true,
    includeDataGaps: true,
    includeChatHistoryTurns: 0,
    includeTaskSummary: true,
    includeRawRowsLimit: 5,
    includeDebugTrace: false,
  },
  marketing_funnel_health: {
    mode: 'analysis_ai',
    maxInputTokens: 4500,
    maxOutputTokens: 1200,
    includeApiCatalog: false,
    includeLoadedSourcesList: false,
    includeAssistantQuality: true,
    includeDataGaps: true,
    includeChatHistoryTurns: 0,
    includeTaskSummary: true,
    includeRawRowsLimit: 10,
    includeDebugTrace: false,
  },
  creative_fatigue_review: {
    mode: 'small_ai',
    maxInputTokens: 2500,
    maxOutputTokens: 800,
    includeApiCatalog: false,
    includeLoadedSourcesList: false,
    includeAssistantQuality: true,
    includeDataGaps: true,
    includeChatHistoryTurns: 0,
    includeTaskSummary: true,
    includeRawRowsLimit: 10,
    includeDebugTrace: false,
  },
  offer_performance_review: {
    mode: 'analysis_ai',
    maxInputTokens: 4500,
    maxOutputTokens: 1200,
    includeApiCatalog: false,
    includeLoadedSourcesList: false,
    includeAssistantQuality: true,
    includeDataGaps: true,
    includeChatHistoryTurns: 0,
    includeTaskSummary: true,
    includeRawRowsLimit: 10,
    includeDebugTrace: false,
  },
  ads_scale_readiness: {
    mode: 'analysis_ai',
    maxInputTokens: 4500,
    maxOutputTokens: 1200,
    includeApiCatalog: false,
    includeLoadedSourcesList: false,
    includeAssistantQuality: true,
    includeDataGaps: true,
    includeChatHistoryTurns: 0,
    includeTaskSummary: true,
    includeRawRowsLimit: 10,
    includeDebugTrace: false,
  },
  sales_sla_task_creation: {
    mode: 'no_ai',
    maxInputTokens: 0,
    maxOutputTokens: 700,
    includeApiCatalog: false,
    includeLoadedSourcesList: false,
    includeAssistantQuality: true,
    includeDataGaps: true,
    includeChatHistoryTurns: 0,
    includeTaskSummary: true,
    includeRawRowsLimit: 20,
    includeDebugTrace: false,
  },
  ad_group_profit_classification: {
    mode: 'no_ai',
    maxInputTokens: 0,
    maxOutputTokens: 600,
    includeApiCatalog: false,
    includeLoadedSourcesList: false,
    includeAssistantQuality: false,
    includeDataGaps: true,
    includeChatHistoryTurns: 0,
    includeTaskSummary: true,
    includeRawRowsLimit: 20,
    includeDebugTrace: false,
  },
  ads_diagnostic_checklist: {
    mode: 'no_ai',
    maxInputTokens: 0,
    maxOutputTokens: 1200,
    includeApiCatalog: false,
    includeLoadedSourcesList: false,
    includeAssistantQuality: false,
    includeDataGaps: true,
    includeChatHistoryTurns: 0,
    includeTaskSummary: true,
    includeRawRowsLimit: 20,
    includeDebugTrace: false,
  },
  product_count: BUSINESS_FACT_TOKEN_POLICY,
  product_list: BUSINESS_FACT_TOKEN_POLICY,
  product_profit_leaderboard: BUSINESS_FACT_TOKEN_POLICY,
  fanpage_performance_lookup: BUSINESS_FACT_TOKEN_POLICY,
  chatbot_fanpage_performance_lookup: BUSINESS_FACT_TOKEN_POLICY,
  agent_revenue_leaderboard: BUSINESS_FACT_TOKEN_POLICY,
  agent_profit_leaderboard: BUSINESS_FACT_TOKEN_POLICY,
  ads_product_profit_leaderboard: BUSINESS_FACT_TOKEN_POLICY,
  product_ads_revenue_ratio: BUSINESS_FACT_TOKEN_POLICY,
  api: {
    mode: 'small_ai',
    maxInputTokens: 3000,
    maxOutputTokens: 1200,
    includeApiCatalog: true,
    includeLoadedSourcesList: false,
    includeAssistantQuality: false,
    includeDataGaps: false,
    includeChatHistoryTurns: 0,
    includeTaskSummary: false,
    includeRawRowsLimit: 0,
    includeDebugTrace: false,
  },
  token: {
    mode: 'small_ai',
    maxInputTokens: 2500,
    maxOutputTokens: 900,
    includeApiCatalog: false,
    includeLoadedSourcesList: false,
    includeAssistantQuality: true,
    includeDataGaps: true,
    includeChatHistoryTurns: 0,
    includeTaskSummary: true,
    includeRawRowsLimit: 10,
    includeDebugTrace: false,
  },
};

@Injectable()
export class AiOperatorService {
  private readonly logger = new Logger(AiOperatorService.name);

  constructor(
    private readonly operationsReader: AiOperatorOperationsReader,
    private readonly businessReader: AiOperatorBusinessReader,
    private readonly adsReader: AiOperatorAdsReader,
    private readonly financeReader: AiOperatorFinanceReader,
    private readonly financialControlService: FinancialControlService,
    private readonly profitReportService: AdGroupProfitReportService,
    private readonly adsAlertsService: AdsAlertsService,
    private readonly opsActionService: OpsActionService,
    private readonly openAIConfigService: OpenAIConfigService,
    private readonly sessions: AiOperatorSessionService,
  ) {}

  getKnowledge(role?: string, currentUser?: any) {
    const auth = buildAuthContext(currentUser, role);
    const knowledge = buildAiOperatorKnowledge(role || auth.role || undefined);
    return {
      success: true,
      generatedAt: new Date().toISOString(),
      role: role || auth.role || null,
      auth,
      ...this.filterKnowledgeByPermissions(knowledge, auth),
    };
  }

  async getTokenManagement(): Promise<{ success: true; generatedAt: string; status: AiOperatorTokenStatus; guide: typeof AI_TOKEN_MANAGEMENT_GUIDE }> {
    const configs = await this.openAIConfigService.findAll({});
    const publicConfigs = this.openAIConfigService.toPublicConfigs(configs);
    const purposeStats = (purpose: string) => {
      const items = publicConfigs.filter((item: any) => item.purpose === purpose);
      return {
        total: items.length,
        active: items.filter((item: any) => item.status === 'active').length,
        default: items.filter((item: any) => item.isDefault).length,
      };
    };

    return {
      success: true,
      generatedAt: new Date().toISOString(),
      status: {
        totalOpenAIConfigs: publicConfigs.length,
        activeOpenAIConfigs: publicConfigs.filter((item: any) => item.status === 'active').length,
        defaultOpenAIConfigs: publicConfigs.filter((item: any) => item.isDefault).length,
        byPurpose: {
          adminAssistant: purposeStats('admin-assistant'),
          customerChatbot: purposeStats('customer-chatbot'),
          general: purposeStats('general'),
        },
        configs: publicConfigs,
      },
      guide: AI_TOKEN_MANAGEMENT_GUIDE,
    };
  }

  getV2Registries() {
    return {
      success: true,
      generatedAt: new Date().toISOString(),
      ...listAiOperatorV2Registries(),
      note: 'V2 registry is metadata only. It does not execute live actions.',
    };
  }

  getV2MetricsRegistry() {
    const registries = listAiOperatorV2Registries();
    return {
      success: true,
      generatedAt: new Date().toISOString(),
      metrics: registries.metrics,
    };
  }

  getV2ApiCatalog() {
    const registries = listAiOperatorV2Registries();
    return {
      success: true,
      generatedAt: new Date().toISOString(),
      apiCatalog: registries.apiCatalog,
    };
  }

  getV2ManagementSituations() {
    const registries = listAiOperatorV2Registries();
    return {
      success: true,
      generatedAt: new Date().toISOString(),
      managementSituations: registries.managementSituations,
    };
  }

  getV2DecisionRules() {
    const registries = listAiOperatorV2Registries();
    return {
      success: true,
      generatedAt: new Date().toISOString(),
      rules: registries.decisionRules,
    };
  }

  getV2RegressionTestCases() {
    const registries = listAiOperatorV2Registries();
    return {
      success: true,
      generatedAt: new Date().toISOString(),
      testCases: registries.regressionTestCases,
    };
  }

  evaluateV2Decision(body: { decisionType?: string; metrics?: Record<string, number>; dataQuality?: any }) {
    return {
      success: true,
      generatedAt: new Date().toISOString(),
      evaluation: evaluateDecision({
        decisionType: body?.decisionType || '',
        metrics: body?.metrics || {},
        dataQuality: body?.dataQuality,
      }),
    };
  }

  async createSession(currentUser: any, dto?: { title?: string; role?: string }) {
    return this.sessions.createSession(currentUser, dto);
  }

  async listSessions(currentUser: any, query?: { limit?: any; status?: string; all?: any }) {
    return this.sessions.listSessions(currentUser, query);
  }

  async getSessionDetail(currentUser: any, sessionId: string, query?: { limit?: any }) {
    return this.sessions.getSessionDetail(currentUser, sessionId, query);
  }

  async updateSession(currentUser: any, sessionId: string, dto: { title?: string; status?: string }) {
    return this.sessions.updateSession(currentUser, sessionId, dto);
  }

  async submitMessageFeedback(
    currentUser: any,
    messageId: string,
    dto: {
      rating: 'up' | 'down' | 'neutral';
      reason?: string;
      correction?: string;
      expectedIntent?: string;
      expectedScenarioId?: string;
      tags?: string[];
    },
  ) {
    return this.sessions.submitMessageFeedback(currentUser, messageId, dto);
  }

  async reviewSession(
    currentUser: any,
    sessionId: string,
    dto: {
      outcome?: 'resolved' | 'needs_followup' | 'wrong_intent' | 'missing_data' | 'bad_answer' | 'useful';
      score?: number;
      improvementPriority?: 'none' | 'low' | 'medium' | 'high';
      notes?: string;
      tags?: string[];
    },
  ) {
    return this.sessions.reviewSession(currentUser, sessionId, dto);
  }

  async getConversationAnalytics(currentUser: any, query?: { from?: string; to?: string; limit?: any; all?: any }) {
    return this.sessions.getConversationAnalytics(currentUser, query);
  }

  getWorkflowQuality(currentUser: any, role?: string) {
    const auth = buildAuthContext(currentUser, role);
    const knowledge = this.filterKnowledgeByPermissions(buildAiOperatorKnowledge(role || auth.role || undefined), auth);
    const workflows = (knowledge.scenarioWorkflows || []).map((workflow: ScenarioWorkflow) => this.buildWorkflowQualityItem(workflow));
    const bySufficiency = workflows.reduce((acc: Record<string, number>, item: any) => {
      acc[item.apiSufficiency] = (acc[item.apiSufficiency] || 0) + 1;
      return acc;
    }, {});
    const byStatus = workflows.reduce((acc: Record<string, number>, item: any) => {
      acc[item.qualityStatus] = (acc[item.qualityStatus] || 0) + 1;
      return acc;
    }, {});

    return {
      success: true,
      generatedAt: new Date().toISOString(),
      role: role || auth.role || null,
      auth,
      summary: {
        totalWorkflows: workflows.length,
        bySufficiency,
        byStatus,
        missingApiCount: workflows.reduce((sum: number, item: any) => sum + item.missingReadApis.length, 0),
        missingWriteApiCount: workflows.reduce((sum: number, item: any) => sum + item.missingWriteApis.length, 0),
        notLoadedReadApiCount: workflows.reduce((sum: number, item: any) => sum + item.notLoadedReadApis.length, 0),
      },
      criticalFindings: workflows
        .filter((item: any) => item.qualityStatus !== 'good')
        .map((item: any) => ({
          scenarioId: item.scenarioId,
          title: item.title,
          qualityStatus: item.qualityStatus,
          score: item.score,
          apiSufficiency: item.apiSufficiency,
          missingApis: item.missingApis,
          notLoadedReadApis: item.notLoadedReadApis,
          notes: item.notes,
        })),
      workflows,
    };
  }

  private buildWorkflowQualityItem(workflow: ScenarioWorkflow) {
    const missingReadApis = workflow.readApis.filter((endpoint) => endpoint.startsWith('MISSING '));
    const missingWriteApis = workflow.writeApis.filter((endpoint) => endpoint.startsWith('MISSING '));
    const missingApis = [...missingReadApis, ...missingWriteApis];
    const readApiCoverage = workflow.readApis.map((endpoint) => ({
      endpoint,
      expectedSources: this.sourceKeysForEndpoint(endpoint),
    }));
    const notLoadedReadApis = readApiCoverage.filter((item) => !item.endpoint.startsWith('MISSING ') && item.expectedSources.length === 0);
    const duplicateReadApis = workflow.readApis.filter((endpoint, index, list) => list.indexOf(endpoint) !== index);
    const notes: string[] = [];
    if (missingReadApis.length) notes.push('Co API doc thieu duoc danh dau MISSING, AI chi duoc de xuat handoff/tao API.');
    if (missingWriteApis.length) notes.push('Co API ghi/executor chua co; khong anh huong doc-phan tich neu workflow dang approval/manual handoff.');
    if (notLoadedReadApis.length) notes.push('Co API that nhung AI Operator chua co source loader rieng trong compact context.');
    if (duplicateReadApis.length) notes.push('Co endpoint doc bi lap, nen don de tiet kiem token.');
    if (workflow.apiSufficiency === 'missing') notes.push('Workflow chua du du lieu/API de AI tra loi chat luong cao.');
    if (workflow.apiSufficiency === 'partial') notes.push('Workflow dung duoc cho goi y/read-only nhung chua nen cho AI execute tu dong.');

    let score = 100;
    if (workflow.apiSufficiency === 'partial') score -= missingReadApis.length ? 12 : 5;
    if (workflow.apiSufficiency === 'missing') score -= 35;
    score -= Math.min(40, missingReadApis.length * 16);
    score -= Math.min(12, missingWriteApis.length * (workflow.executionMode === 'approval_required' || workflow.executionMode === 'manual_handoff' ? 4 : 8));
    score -= Math.min(25, notLoadedReadApis.length * 5);
    score -= Math.min(10, duplicateReadApis.length * 5);
    score = Math.max(0, score);
    const qualityStatus = score >= 85 ? 'good' : score >= 65 ? 'needs_tuning' : 'weak';

    return {
      scenarioId: workflow.scenarioId,
      title: workflow.title,
      roles: workflow.roles,
      apiSufficiency: workflow.apiSufficiency,
      executionMode: workflow.executionMode,
      approvalRequired: workflow.approvalRequired,
      score,
      qualityStatus,
      missingApis,
      missingReadApis,
      missingWriteApis,
      duplicateReadApis,
      notLoadedReadApis,
      readApiCoverage,
      notes,
    };
  }

  private buildAgentTrace(params: {
    generatedAt: string;
    route: AiOperatorContextRoute;
    sources: Record<string, AiSourceResult>;
    recommendations: AiOperatorRecommendation[];
    dataGaps: string[];
    usedOpenAI: boolean;
  }): AiOperatorAgentTrace {
    const loadedSources = Object.entries(params.sources || {})
      .filter(([, result]) => result?.ok)
      .map(([name]) => name);
    const failedSources = Object.entries(params.sources || {})
      .filter(([, result]) => result && result.ok === false)
      .map(([name]) => name);
    const approvalCount = (params.recommendations || []).filter((item) => item.requiresApproval).length;

    return {
      mode: 'read_only',
      generatedAt: params.generatedAt,
      traceId: [
        params.route?.intent || 'unknown',
        params.route?.scenarioId || 'no-scenario',
        new Date(params.generatedAt).getTime() || Date.now(),
      ].join(':'),
      steps: [
        {
          agent: 'router',
          status: params.route?.blocked ? 'blocked' : 'ok',
          summary: params.route?.reason || 'Route request to the closest ERP workflow.',
          inputs: ['message', 'role', 'scenarioId', 'intent'],
          outputs: [
            `intent=${params.route?.intent || 'unknown'}`,
            `scenario=${params.route?.scenarioId || 'none'}`,
            `execution=${params.route?.executionMode || 'read_only'}`,
          ],
          guardrails: params.route?.blockedReason ? [params.route.blockedReason] : [],
        },
        {
          agent: 'data_readiness',
          status: failedSources.length || params.dataGaps?.length ? 'warn' : 'ok',
          summary: `${loadedSources.length} sources loaded, ${failedSources.length} sources failed, ${params.dataGaps?.length || 0} data gaps.`,
          inputs: Object.keys(params.sources || {}),
          outputs: loadedSources,
          guardrails: [...failedSources, ...(params.dataGaps || [])].slice(0, 8),
        },
        {
          agent: 'ops_suggestion',
          status: params.recommendations?.length ? 'ok' : 'skipped',
          summary: `${params.recommendations?.length || 0} recommendations generated from current context.`,
          inputs: loadedSources,
          outputs: (params.recommendations || []).slice(0, 6).map((item) => `${item.priority}:${item.type}`),
          guardrails: ['suggest_only', 'no_live_apply'],
        },
        {
          agent: 'approval_planner',
          status: approvalCount > 0 || params.route?.approvalRequired ? 'warn' : 'ok',
          summary: `${approvalCount} recommendations require approval before any write action.`,
          inputs: ['recommendations', 'route.executionMode'],
          outputs: [
            `approvalRequired=${Boolean(params.route?.approvalRequired || approvalCount > 0)}`,
            'liveApplyEnabled=false',
          ],
          guardrails: ['approval_only_no_live_apply'],
        },
        {
          agent: params.usedOpenAI ? 'openai_responder' : 'rule_based_responder',
          status: 'ok',
          summary: params.usedOpenAI
            ? 'OpenAI response used with ERP guardrail contract.'
            : 'Rule-based fallback response used; no external model call applied.',
          inputs: ['route', 'context', 'recommendations'],
          outputs: ['answer'],
          guardrails: ['read_only', 'must_state_missing_data'],
        },
      ],
    };
  }

  private ensureVietnameseRecommendations(recommendations: AiOperatorRecommendation[] = []): AiOperatorRecommendation[] {
    return recommendations.map((item) => ({
      ...item,
      title: ensureVietnameseUiResponse(item.title),
      reason: ensureVietnameseUiResponse(item.reason),
      proposedAction: ensureVietnameseUiResponse(item.proposedAction),
    }));
  }

  async getSnapshot(windowDays = 7, currentUser?: any): Promise<AiOperatorSnapshot> {
    const normalizedWindow = this.normalizeWindowDays(windowDays);
    const now = new Date();
    const startDate = new Date(now.getTime() - normalizedWindow * DAY_MS);
    const auth = currentUser ? buildAuthContext(currentUser) : null;
    const load = <T>(source: string, loader: () => Promise<T>) => this.safeSourceForAuth(source, auth, loader);

    const [
      dashboard,
      forecast,
      optimalAds,
      financeActions,
      adsPerformance,
      optimalSpendSuggestions,
      alerts,
      orders,
      returns,
      receivables,
      operations,
      employeeKpi,
      tokenHealth,
      adsSyncHealth,
      adCostByGroup,
      costPerOrder,
      marketingDecision,
      managerConversations,
      managerPendingOrders,
      managerMedia,
      managerAdGroups,
      managerFanpages,
      fundsOverview,
      availableFunds,
      budgetPreview,
      loanDashboard,
      ownerFund,
      laborCashflow,
      otherCostCashflow,
      adsCostCashflow,
      aiMarketingOverview,
      aiMarketingPlans,
      aiMarketingEvaluations,
      quoteReadiness,
      accessAudit,
    ] =
      await Promise.all([
        load('financial-control.dashboard', () => this.financialControlService.getDashboard()),
        load('financial-control.forecast', () => this.financialControlService.getForecastForDashboard()),
        load('financial-control.optimal-ads', () => this.financialControlService.getOptimalAdsSuggestion()),
        load('financial-control.actions', () => this.financialControlService.getActionSuggestions()),
        load('ad-group-profit-report.performance', () =>
          this.profitReportService.getAdGroupPerformanceReport({
            startDate,
            endDate: now,
            minOrders: 1,
            onlyFinalized: true,
          }),
        ),
        load('ad-group-profit-report.optimal-spend', () =>
          this.profitReportService.getOptimalSpendSuggestions({ lookbackDays: normalizedWindow }),
        ),
        load('ads-alerts', async () => ({
          summary: this.adsAlertsService.getSummary(),
          alerts: this.adsAlertsService.getAllAlerts().slice(0, 30),
        })),
        load('orders', () => this.operationsReader.buildOrderSnapshot(startDate, now)),
        load('returns', () => this.operationsReader.buildReturnSnapshot(startDate, now)),
        load('receivables', () => this.operationsReader.buildReceivablesSnapshot(now)),
        load('ops-actions', () => this.opsActionService.getActionSuggestions()),
        load('employee-ads-kpi', () => this.adsReader.buildEmployeeAdsKpiSnapshot(startDate, now)),
        load('api-tokens', () => this.adsReader.buildApiTokenSnapshot()),
        load('advertising-cost.sync-health', () => this.adsReader.buildAdsSyncHealthSnapshot()),
        load('advertising-cost.by-adgroup', () => this.adsReader.buildAdvertisingCostByAdGroupSnapshot(startDate, now)),
        load('ad-report.cost-per-order', () => this.adsReader.buildCostPerOrderSnapshot(startDate, now)),
        load('ai-marketing.decision', () => this.adsReader.buildMarketingDecisionSnapshot(normalizedWindow)),
        load('chat-conversations', () => this.operationsReader.buildConversationSnapshot()),
        load('sales-pending-orders', () => this.operationsReader.buildPendingOrderSnapshot()),
        load('media-assets', () => this.operationsReader.buildMediaSnapshot()),
        load('ad-groups', () => this.operationsReader.buildAdGroupSnapshot()),
        load('fanpages', () => this.operationsReader.buildFanpageSnapshot()),
        load('finance.funds-overview', () => this.financeReader.getFinanceFundsOverview()),
        load('finance.available-fund-current', () => this.financeReader.buildAvailableFundSnapshot()),
        load('budget-allocation.preview', () => this.financeReader.getBudgetAllocationPreview()),
        load('loan-management.dashboard', () => this.financeReader.getLoanDashboard()),
        load('owner-fund.summary', () => this.financeReader.buildOwnerFundSnapshot()),
        load('cost.labor-summary', () => this.financeReader.buildLaborCashflowSnapshot(now, normalizedWindow)),
        load('cost.other-summary', () => this.financeReader.buildOtherCostCashflowSnapshot(now, normalizedWindow)),
        load('ads.cost-summary', () => this.financeReader.buildAdsCostCashflowSnapshot(startDate, now)),
        load('ai-marketing.overview', () => this.adsReader.getAiMarketingOverview(normalizedWindow)),
        load('ai-marketing.plans', () => this.adsReader.getAiMarketingPlans()),
        load('ai-marketing.evaluations', () => this.adsReader.getAiMarketingEvaluations()),
        load('quotes.readiness', () => this.financeReader.buildQuoteReadinessSnapshot(now)),
        load('access.audit', () => this.financeReader.buildAccessAuditSnapshot()),
      ]);

    return {
      generatedAt: now.toISOString(),
      windowDays: normalizedWindow,
      finance: {
        dashboard,
        forecast,
        optimalAds,
        actions: financeActions,
      },
      ads: {
        performance: adsPerformance,
        optimalSpendSuggestions,
        alerts,
        syncHealth: adsSyncHealth,
        costByAdGroup: adCostByGroup,
        costPerOrder,
      },
      orders,
      returns,
      receivables,
      operations,
      manager: {
        employeeKpi,
        tokenHealth,
        budgetPreview,
        marketing: marketingDecision,
        conversations: managerConversations,
        pendingOrders: managerPendingOrders,
        media: managerMedia,
        adEntities: {
          ok: !!(managerAdGroups.ok || managerFanpages.ok),
          data: {
            adGroups: managerAdGroups.ok ? managerAdGroups.data : null,
            fanpages: managerFanpages.ok ? managerFanpages.data : null,
          },
          error: [managerAdGroups, managerFanpages]
            .filter((item) => item.ok === false)
            .map((item) => item.error)
            .filter(Boolean)
            .join('; ') || undefined,
        },
      },
      strategic: {
        fundsOverview,
        availableFunds,
        budgetPreview,
        loanDashboard,
        ownerFund,
        laborCashflow,
        otherCostCashflow,
        adsCostCashflow,
        aiMarketingOverview,
        aiMarketingPlans,
        aiMarketingEvaluations,
        quoteReadiness,
        accessAudit,
      },
      dataGaps: [
        'Chua thay module /leads rieng trong backend hien tai, nen AI chua ket luan duoc sale nao bo sot lead neu du lieu lead khong nam trong chat-message hoac pending-order.',
        'Chua thay module /invoices va /pending-approvals rieng trong backend hien tai; cong no hien duoc doc tu supplier-payable va agent-receivable.',
      ],
    };
  }

  async getScenarioContext(params: {
    message?: string;
    windowDays?: number;
    role?: string;
    scenarioId?: string;
    intent?: string;
    currentUser?: any;
  }): Promise<AiOperatorScenarioContext> {
    const normalizedWindow = this.normalizeWindowDays(params.windowDays || 7);
    const now = new Date();
    const startDate = new Date(now.getTime() - normalizedWindow * DAY_MS);
    const auth = buildAuthContext(params.currentUser, params.role);
    const effectiveRole = params.role || auth.role || undefined;
    const route = this.resolveContextRoute(params.message || '', effectiveRole, params.scenarioId, params.intent);
    const sources = await this.loadScenarioSources(route, startDate, now, normalizedWindow, auth);
    const authorizedRoute = this.applyRouteAuthorization(route, sources, auth);
    const dataGaps = this.buildContextDataGaps(route);
    const recommendations = authorizedRoute.blocked
      ? []
      : this.ensureVietnameseRecommendations(buildRecommendations(this.contextToSnapshot(now, normalizedWindow, sources, dataGaps)));
    const generatedAt = now.toISOString();
    const agentTrace = this.buildAgentTrace({
      generatedAt,
      route: authorizedRoute,
      sources,
      recommendations,
      dataGaps,
      usedOpenAI: false,
    });

    return {
      success: true,
      generatedAt,
      windowDays: normalizedWindow,
      role: effectiveRole || null,
      auth,
      route: authorizedRoute,
      context: this.compactScenarioContext(authorizedRoute, sources, dataGaps, auth, recommendations),
      sources,
      recommendations,
      dataGaps,
      tokenPolicy: authorizedRoute.tokenPolicy || this.getTokenPolicyForIntent(authorizedRoute.intent),
      agentTrace,
    };
  }

  async chat(message: string, windowDays = 7, role?: string, scenarioId?: string, intent?: string, currentUser?: any, sessionId?: string) {
    const scenarioContext = await this.getScenarioContext({ message, windowDays, role, scenarioId, intent, currentUser });
    const recommendations = this.ensureVietnameseRecommendations(scenarioContext.recommendations);
    const knowledge = buildAiOperatorKnowledge(role || scenarioContext.auth.role || undefined);
    const compactKnowledge = this.compactKnowledgeForContext(knowledge, scenarioContext.route, scenarioContext.auth);
    const tokenPolicy = scenarioContext.tokenPolicy || scenarioContext.route.tokenPolicy || this.getTokenPolicyForIntent(scenarioContext.route.intent);
    const aiResult = scenarioContext.route.blocked || tokenPolicy.mode === 'no_ai'
      ? null
      : await this.tryAskOpenAI(message, scenarioContext, recommendations, compactKnowledge, scenarioContext.role || undefined, tokenPolicy);
    const fallbackSnapshot = this.contextToSnapshot(
      new Date(scenarioContext.generatedAt),
      scenarioContext.windowDays,
      scenarioContext.sources,
      scenarioContext.dataGaps,
    );

    const rawAnswer = scenarioContext.route.blocked
      ? buildPermissionDeniedAnswer(scenarioContext)
      : aiResult?.answer || buildRuleBasedAnswer(message, fallbackSnapshot, recommendations, compactKnowledge as any, scenarioContext.role || undefined, scenarioContext.route);

    const response = {
      success: true,
      mode: 'read_only',
      generatedAt: scenarioContext.generatedAt,
      role: scenarioContext.role,
      auth: scenarioContext.auth,
      modelUsed: aiResult?.model || null,
      tokenPolicy,
      tokenUsage: aiResult?.tokenUsage || buildNoAiTokenUsage(scenarioContext, tokenPolicy),
      answer: ensureVietnameseUiResponse(rawAnswer),
      recommendations,
      knowledge: this.filterKnowledgeByPermissions(knowledge, scenarioContext.auth),
      context: scenarioContext.context,
      assistantQuality: scenarioContext.context?.assistantQuality || null,
      route: scenarioContext.route,
      agentTrace: this.buildAgentTrace({
        generatedAt: scenarioContext.generatedAt,
        route: scenarioContext.route,
        sources: scenarioContext.sources,
        recommendations,
        dataGaps: scenarioContext.dataGaps,
        usedOpenAI: !!aiResult,
      }),
      snapshot: scenarioContext.context,
      note: 'Giai đoạn 1: AI chỉ đọc và tóm tắt. Chưa có hành động nào được thực hiện.',
    };

    const persistedTurn = await this.sessions.persistChatTurn(currentUser, sessionId, message, response);

    return {
      ...response,
      sessionId: persistedTurn?.session?._id ? String(persistedTurn.session._id) : sessionId || null,
      assistantMessageId: persistedTurn?.assistantMessageId || null,
      userMessageId: persistedTurn?.userMessageId || null,
    };
  }

  async getRecommendations(windowDays = 7, currentUser?: any) {
    const snapshot = await this.getSnapshot(windowDays, currentUser);
    return {
      success: true,
      mode: 'suggest_only',
      generatedAt: snapshot.generatedAt,
      recommendations: this.ensureVietnameseRecommendations(buildRecommendations(snapshot)),
      note: 'Các đề xuất này chưa được đóng gói thành kế hoạch và chưa thực thi.',
    };
  }

  private filterKnowledgeByPermissions(knowledge: ReturnType<typeof buildAiOperatorKnowledge>, auth: AiOperatorAuthContext) {
    return {
      ...knowledge,
      apiCatalog: (knowledge.apiCatalog || []).filter((item) => this.isApiCatalogAllowed(item.domain, auth)),
      scenarioWorkflows: (knowledge.scenarioWorkflows || []).filter((workflow) => this.isWorkflowAllowed(workflow, auth)),
    };
  }

  private applyRouteAuthorization(
    route: AiOperatorContextRoute,
    sources: Record<string, AiSourceResult>,
    auth: AiOperatorAuthContext,
  ): AiOperatorContextRoute {
    const workflow = route.scenarioId ? this.findScenarioWorkflow(route.scenarioId) : null;
    const deniedSources = Object.entries(sources)
      .filter(([, result]) => result?.ok === false && String(result.error || '').startsWith('permission_denied'))
      .map(([source]) => source);
    const allowedSourceCount = Object.values(sources).filter((result) => result?.ok === true).length;

    if (workflow && !this.isWorkflowAllowed(workflow, auth)) {
      return {
        ...route,
        blocked: true,
        blockedReason: 'User does not have permission to read any API source required by this workflow.',
        deniedSources,
      };
    }

    if (route.intent !== 'api' && Object.keys(sources).length > 0 && allowedSourceCount === 0 && deniedSources.length > 0) {
      return {
        ...route,
        blocked: true,
        blockedReason: 'All selected ERP data sources were denied by permission checks.',
        deniedSources,
      };
    }

    return {
      ...route,
      blocked: false,
      blockedReason: null,
      deniedSources,
    };
  }

  private hasAnyPermission(auth: AiOperatorAuthContext, requiredPermissions: string[]) {
    if (!requiredPermissions.length) return true;
    return requiredPermissions.some((permission) => auth.permissions.includes(permission));
  }

  private requiredPermissionsForSource(source: string): string[] {
    if (source === 'financial-control.optimal-ads') return ['finance', 'ads-budget'];
    if (source.startsWith('financial-control')) return ['finance', 'reports', 'ads-budget'];
    if (source.startsWith('ad-group-profit-report')) return ['ads-budget'];
    if (source === 'ads-alerts') return ['ad-groups'];
    if (source === 'orders') return ['orders', 'orders-test2'];
    if (source === 'returns') return ['reports', 'purchase-costs'];
    if (source === 'receivables') return ['purchase-costs', 'quotes'];
    if (source === 'ops-actions') return ['purchase-costs', 'orders', 'orders-test2', 'ad-groups'];
    if (source === 'token-management') return ['openai-configs'];
    if (source === 'api-tokens') return ['api-tokens'];
    if (source === 'sales-products') return ['products'];
    if (source === 'sales-customers') return ['customers'];
    if (source === 'sales-pending-orders') return ['pending-orders'];
    if (source === 'chat-conversations') return ['chat-messages'];
    if (source === 'media-assets') return ['media'];
    if (source === 'business-facts') return ['products', 'fanpages', 'orders-test2', 'ad-groups', 'advertising-costs', 'chat-messages', 'pending-orders'];
    if (source === 'ads.ad-group-profit-classification') return ['ads-budget', 'ad-groups', 'advertising-costs'];
    if (source === 'ads.diagnostic-overview') return ['ad-accounts', 'ad-groups', 'fanpages', 'advertising-costs', 'chat-messages', 'pending-orders', 'ads-budget'];
    if (source === 'ad-groups') return ['ad-groups'];
    if (source === 'ad-accounts') return ['ad-accounts'];
    if (source === 'fanpages') return ['fanpages'];
    if (source === 'employee-ads-kpi') return ['employee-ads-kpi'];
    if (source === 'finance.funds-overview') return ['finance'];
    if (source === 'finance.available-fund-current') return ['finance'];
    if (source === 'budget-allocation.preview') return ['ads-budget', 'finance'];
    if (source === 'loan-management.dashboard') return ['finance'];
    if (source === 'owner-fund.summary') return ['owner-fund', 'finance'];
    if (source === 'cost.labor-summary') return ['labor-costs'];
    if (source === 'cost.other-summary') return ['other-costs'];
    if (source === 'ads.cost-summary') return ['advertising-costs'];
    if (source.startsWith('advertising-cost')) return ['advertising-costs'];
    if (source.startsWith('ad-report')) return ['advertising-costs', 'ads-budget'];
    if (source.startsWith('ai-marketing')) return ['ai-assistant', 'ads-budget', 'ad-groups'];
    if (source === 'quotes.readiness') return ['quotes', 'purchase-costs'];
    if (source === 'access.audit') return ['users'];
    return [];
  }

  private isWorkflowAllowed(workflow: ScenarioWorkflow, auth: AiOperatorAuthContext) {
    const readPermissions = workflow.readApis.flatMap((endpoint) => this.permissionsForEndpoint(endpoint));
    return this.hasAnyPermission(auth, Array.from(new Set(readPermissions)));
  }

  private isApiCatalogAllowed(domain: string, auth: AiOperatorAuthContext) {
    const permissions = this.permissionsForApiDomain(domain);
    return this.hasAnyPermission(auth, permissions);
  }

  private permissionsForApiDomain(domain: string): string[] {
    const normalized = removeVietnameseTone(domain || '').toLowerCase();
    if (normalized.includes('auth') || normalized.includes('user')) return ['users'];
    if (normalized.includes('order')) return ['orders', 'orders-test2'];
    if (normalized.includes('product') || normalized.includes('customer') || normalized.includes('quote')) {
      return ['products', 'customers', 'quotes', 'purchase-costs'];
    }
    if (normalized.includes('ads')) return ['ads-budget', 'ad-groups', 'advertising-costs'];
    if (normalized.includes('finance') || normalized.includes('cashflow') || normalized.includes('owner')) return ['finance', 'owner-fund'];
    if (normalized.includes('supplier') || normalized.includes('agent')) return ['purchase-costs', 'quotes'];
    if (normalized.includes('ai') || normalized.includes('chat') || normalized.includes('token')) return ['openai-configs', 'api-tokens', 'chat-messages'];
    return [];
  }

  private permissionsForEndpoint(endpoint: string): string[] {
    const normalized = removeVietnameseTone(endpoint || '').toLowerCase();
    if (!normalized || normalized.startsWith('missing ')) return [];
    if (normalized.includes('/api/users') || normalized.includes('/api/session-logs')) return ['users'];
    if (normalized.includes('/api/auth/')) return ['users'];
    if (normalized.includes('/api/financial-control')) return ['finance', 'reports', 'ads-budget'];
    if (normalized.includes('/api/finance') || normalized.includes('/api/capital-allocation')) return ['finance'];
    if (normalized.includes('/api/funds') || normalized.includes('/api/cashflow') || normalized.includes('/api/loan-management')) return ['finance'];
    if (normalized.includes('/api/owner-fund')) return ['owner-fund'];
    if (normalized.includes('/api/ad-group-profit-report') || normalized.includes('/api/ad-group-daily-report') || normalized.includes('/api/budget-allocation')) return ['ads-budget'];
    if (normalized.includes('/api/ad-groups') || normalized.includes('/api/ads-alerts') || normalized.includes('/api/emergency-actions')) return ['ad-groups'];
    if (normalized.includes('/api/ad-accounts')) return ['ad-accounts'];
    if (normalized.includes('/api/advertising-cost') || normalized.includes('/api/ad-report')) return ['advertising-costs'];
    if (normalized.includes('/api/employee-ads-kpi')) return ['employee-ads-kpi'];
    if (normalized.includes('/api/ai-marketing')) return ['ai-assistant', 'ads-budget', 'ad-groups'];
    if (
      normalized.includes('/api/test-order2') ||
      normalized.includes('/api/order-status') ||
      normalized.includes('/api/production-status') ||
      normalized.includes('/api/delivery-status') ||
      normalized.includes('/api/order-sheet-sync') ||
      normalized.includes('/api/order-update')
    ) {
      return ['orders', 'orders-test2', 'order-update'];
    }
    if (normalized.includes('/api/pending-orders')) return ['pending-orders'];
    if (normalized.includes('/api/products') || normalized.includes('/api/product-category')) return ['products', 'product-categories'];
    if (normalized.includes('/api/customers')) return ['customers'];
    if (normalized.includes('/api/quotes')) return ['quotes'];
    if (normalized.includes('/api/supplier-quotes')) return ['purchase-costs'];
    if (normalized.includes('/api/supplier-payables')) return ['purchase-costs'];
    if (normalized.includes('/api/return-report') || normalized.includes('/api/returns')) return ['reports', 'purchase-costs'];
    if (normalized.includes('/api/agent-receivables') || normalized.includes('/api/agent-payables')) return ['quotes'];
    if (normalized.includes('/api/chat-messages')) return ['chat-messages'];
    if (normalized.includes('/api/fanpages')) return ['fanpages'];
    if (normalized.includes('/api/api-tokens')) return ['api-tokens'];
    if (normalized.includes('/api/openai-configs')) return ['openai-configs'];
    if (normalized.includes('/api/media')) return ['media'];
    if (normalized.includes('/api/other-cost')) return ['other-costs'];
    if (normalized.includes('/api/labor-cost')) return ['labor-costs'];
    return [];
  }

  private resolveContextRoute(message: string, role?: string, scenarioId?: string, intent?: string): AiOperatorContextRoute {
    const explicitScenario = scenarioId ? this.findScenarioWorkflow(scenarioId) : null;
    if (explicitScenario) {
      return this.buildContextRoute(this.intentFromScenario(explicitScenario, role), explicitScenario, 'explicit_scenario');
    }

    const explicitIntent = normalizeIntent(intent);
    if (explicitIntent) {
      return this.buildContextRoute(explicitIntent, this.findBestScenario(message, role, explicitIntent), 'explicit_intent');
    }

    const normalizedMessage = removeVietnameseTone(message || '').toLowerCase();
    if (isConciseRoleBriefingRequest(normalizedMessage)) {
      return this.buildContextRoute('concise_role_briefing', this.findBestScenario(message, role, 'concise_role_briefing'), 'keyword_concise_role_briefing');
    }
    if (isAiRecommendationReviewRequest(normalizedMessage)) {
      return this.buildContextRoute('ai_recommendation_review', this.findBestScenario(message, role, 'ai_recommendation_review'), 'keyword_ai_recommendation_review');
    }
    if (isRootCauseAnalysisRequest(normalizedMessage)) {
      return this.buildContextRoute('root_cause_analysis', this.findBestScenario(message, role, 'root_cause_analysis'), 'keyword_root_cause_analysis');
    }
    if (isAnomalyDetectionRequest(normalizedMessage)) {
      return this.buildContextRoute('anomaly_detection_daily', this.findBestScenario(message, role, 'anomaly_detection_daily'), 'keyword_anomaly_detection_daily');
    }
    if (isPriorityRankingRequest(normalizedMessage)) {
      return this.buildContextRoute('priority_ranking', this.findBestScenario(message, role, 'priority_ranking'), 'keyword_priority_ranking');
    }
    if (isTargetGapAnalysisRequest(normalizedMessage)) {
      return this.buildContextRoute('target_gap_analysis', this.findBestScenario(message, role, 'target_gap_analysis'), 'keyword_target_gap_analysis');
    }
    if (isPeriodComparisonRequest(normalizedMessage)) {
      return this.buildContextRoute('period_comparison', this.findBestScenario(message, role, 'period_comparison'), 'keyword_period_comparison');
    }
    if (isProductAdsRevenueRatioQuestion(normalizedMessage)) {
      return this.buildContextRoute('product_ads_revenue_ratio', null, 'keyword_product_ads_revenue_ratio');
    }
    if (isAdsProductProfitQuestion(normalizedMessage)) {
      return this.buildContextRoute('ads_product_profit_leaderboard', null, 'keyword_ads_product_profit_leaderboard');
    }
    if (isProductDecisionReviewRequest(normalizedMessage)) {
      return this.buildContextRoute('product_decision_review', this.findBestScenario(message, role, 'product_decision_review'), 'keyword_product_decision_review');
    }
    if (isProductPerformanceQuestion(normalizedMessage)) {
      return this.buildContextRoute('product_profit_leaderboard', null, 'keyword_product_performance');
    }
    if (isProductProfitLeaderboardQuestion(normalizedMessage)) {
      return this.buildContextRoute('product_profit_leaderboard', null, 'keyword_product_profit_leaderboard');
    }
    if (isProductCountQuestion(normalizedMessage)) {
      return this.buildContextRoute('product_count', null, 'keyword_product_count');
    }
    if (isProductListQuestion(normalizedMessage)) {
      return this.buildContextRoute('product_list', null, 'keyword_product_list');
    }
    if (isChatbotFanpagePerformanceQuestion(normalizedMessage)) {
      return this.buildContextRoute('chatbot_fanpage_performance_lookup', null, 'keyword_chatbot_fanpage_performance');
    }
    if (isFanpagePerformanceQuestion(normalizedMessage)) {
      return this.buildContextRoute('fanpage_performance_lookup', null, 'keyword_fanpage_performance');
    }
    if (isCustomerValueAnalysisRequest(normalizedMessage)) {
      return this.buildContextRoute('customer_value_analysis', this.findBestScenario(message, role, 'customer_value_analysis'), 'keyword_customer_value_analysis');
    }
    if (isCustomerValueOrCareRequest(normalizedMessage)) {
      return this.buildContextRoute('sales', this.findBestScenario(message, role, 'sales'), 'keyword_customer_value_or_care');
    }
    if (isAgentRevenueLeaderboardQuestion(normalizedMessage)) {
      return this.buildContextRoute('agent_revenue_leaderboard', null, 'keyword_agent_revenue_leaderboard');
    }
    if (isAgentProfitLeaderboardQuestion(normalizedMessage)) {
      return this.buildContextRoute('agent_profit_leaderboard', null, 'keyword_agent_profit_leaderboard');
    }
    if (isDecisionWaitingApprovalRequest(normalizedMessage)) {
      return this.buildContextRoute('decision_waiting_approval', this.findBestScenario(message, role, 'decision_waiting_approval'), 'keyword_decision_waiting_approval');
    }
    if (isBusinessRiskRankingRequest(normalizedMessage)) {
      return this.buildContextRoute('business_risk_ranking', this.findBestScenario(message, role, 'business_risk_ranking'), 'keyword_business_risk_ranking');
    }
    if (isCompanyKpiScorecardRequest(normalizedMessage)) {
      return this.buildContextRoute('company_kpi_scorecard', this.findBestScenario(message, role, 'company_kpi_scorecard'), 'keyword_company_kpi_scorecard');
    }
    if (isExecutiveDailyOverviewRequest(normalizedMessage)) {
      return this.buildContextRoute('director_daily_overview', this.findBestScenario(message, role, 'director_daily_overview'), 'keyword_director_daily_overview');
    }
    if (isOwnerAccountabilityRequest(normalizedMessage)) {
      return this.buildContextRoute('owner_accountability_review', this.findBestScenario(message, role, 'owner_accountability_review'), 'keyword_owner_accountability_review');
    }
    if (isPeoplePerformanceRequest(normalizedMessage)) {
      return this.buildContextRoute('operations', this.findBestScenario(message, role, 'operations'), 'keyword_people_performance');
    }
    if (isAdGroupProfitClassificationRequest(normalizedMessage)) {
      return this.buildContextRoute('ad_group_profit_classification', null, 'keyword_ad_group_profit_classification');
    }
    if (isAdsBudgetCashflowGateRequest(normalizedMessage)) {
      return this.buildContextRoute('ads_budget_cashflow_gate', this.findBestScenario(message, role, 'ads_budget_cashflow_gate'), 'keyword_ads_budget_cashflow_gate');
    }
    if (isAdsScaleReadinessRequest(normalizedMessage)) {
      return this.buildContextRoute('ads_scale_readiness', this.findBestScenario(message, role, 'ads_scale_readiness'), 'keyword_ads_scale_readiness');
    }
    if (isAdsKillOrPauseRequest(normalizedMessage)) {
      return this.buildContextRoute('ads_kill_or_pause_recommendation', this.findBestScenario(message, role, 'ads_kill_or_pause_recommendation'), 'keyword_ads_kill_or_pause');
    }
    if (isChannelProfitabilityRequest(normalizedMessage)) {
      return this.buildContextRoute('channel_profitability_review', this.findBestScenario(message, role, 'channel_profitability_review'), 'keyword_channel_profitability_review');
    }
    if (isChannelMixReviewRequest(normalizedMessage)) {
      return this.buildContextRoute('channel_mix_review', this.findBestScenario(message, role, 'channel_mix_review'), 'keyword_channel_mix_review');
    }
    if (isResourceAllocationDecisionRequest(normalizedMessage)) {
      return this.buildContextRoute('resource_allocation_decision', this.findBestScenario(message, role, 'resource_allocation_decision'), 'keyword_resource_allocation_decision');
    }
    if (isSalesSlaTaskCreationRequest(normalizedMessage)) {
      return this.buildContextRoute('sales_sla_task_creation', this.findBestScenario(message, role, 'sales_sla_task_creation'), 'keyword_sales_sla_task_creation');
    }
    if (isSalesSlaViolationRequest(normalizedMessage)) {
      return this.buildContextRoute('sales_sla_violation', this.findBestScenario(message, role, 'sales_sla_violation'), 'keyword_sales_sla_violation');
    }
    if (isLeadQualityBySourceRequest(normalizedMessage)) {
      return this.buildContextRoute('lead_quality_by_source', this.findBestScenario(message, role, 'lead_quality_by_source'), 'keyword_lead_quality_by_source');
    }
    if (isSalesConversionByUserRequest(normalizedMessage)) {
      return this.buildContextRoute('sales_conversion_by_user', this.findBestScenario(message, role, 'sales_conversion_by_user'), 'keyword_sales_conversion_by_user');
    }
    if (isLeadFollowupHealthRequest(normalizedMessage)) {
      return this.buildContextRoute('lead_followup_health', this.findBestScenario(message, role, 'lead_followup_health'), 'keyword_lead_followup_health');
    }
    if (isMarketingFunnelHealthRequest(normalizedMessage)) {
      return this.buildContextRoute('marketing_funnel_health', this.findBestScenario(message, role, 'marketing_funnel_health'), 'keyword_marketing_funnel_health');
    }
    if (isCreativeFatigueRequest(normalizedMessage)) {
      return this.buildContextRoute('creative_fatigue_review', this.findBestScenario(message, role, 'creative_fatigue_review'), 'keyword_creative_fatigue_review');
    }
    if (isOfferPerformanceRequest(normalizedMessage)) {
      return this.buildContextRoute('offer_performance_review', this.findBestScenario(message, role, 'offer_performance_review'), 'keyword_offer_performance_review');
    }
    if (isAdsDiagnosticChecklistRequest(normalizedMessage)) {
      return this.buildContextRoute('ads_diagnostic_checklist', null, 'keyword_ads_diagnostic_checklist');
    }
    if (isLateOrderDiagnosticRequest(normalizedMessage)) {
      return this.buildContextRoute('late_order_diagnostic', this.findBestScenario(message, role, 'late_order_diagnostic'), 'keyword_late_order_diagnostic');
    }
    if (isFulfillmentBottleneckRequest(normalizedMessage)) {
      return this.buildContextRoute('fulfillment_bottleneck', this.findBestScenario(message, role, 'fulfillment_bottleneck'), 'keyword_fulfillment_bottleneck');
    }
    if (isTrackingIssueRequest(normalizedMessage)) {
      return this.buildContextRoute('tracking_issue_check', this.findBestScenario(message, role, 'tracking_issue_check'), 'keyword_tracking_issue');
    }
    if (isCancelRefundRiskRequest(normalizedMessage)) {
      return this.buildContextRoute('cancel_refund_risk', this.findBestScenario(message, role, 'cancel_refund_risk'), 'keyword_cancel_refund_risk');
    }
    if (isCashflowForecastRequest(normalizedMessage)) {
      return this.buildContextRoute('cashflow_forecast', this.findBestScenario(message, role, 'cashflow_forecast'), 'keyword_cashflow_forecast');
    }
    if (isAdvancedCashflowScenarioRequest(normalizedMessage)) {
      return this.buildContextRoute('advanced_cashflow_scenario', this.findBestScenario(message, role, 'advanced_cashflow_scenario'), 'keyword_advanced_cashflow_scenario');
    }
    if (isScenarioAnalysisRequest(normalizedMessage)) {
      return this.buildContextRoute('scenario_analysis', this.findBestScenario(message, role, 'scenario_analysis'), 'keyword_scenario_analysis');
    }
    if (isReceivablesCollectionPriorityRequest(normalizedMessage)) {
      return this.buildContextRoute('receivables_collection_priority', this.findBestScenario(message, role, 'receivables_collection_priority'), 'keyword_receivables_collection_priority');
    }
    if (isSupplierPaymentPriorityRequest(normalizedMessage)) {
      return this.buildContextRoute('supplier_payment_priority', this.findBestScenario(message, role, 'supplier_payment_priority'), 'keyword_supplier_payment_priority');
    }
    if (isTokenHealthCheckRequest(normalizedMessage)) {
      return this.buildContextRoute('token_health_check', this.findBestScenario(message, role, 'token_health_check'), 'keyword_token_health_check');
    }
    if (isFanpagePermissionCheckRequest(normalizedMessage)) {
      return this.buildContextRoute('fanpage_permission_check', this.findBestScenario(message, role, 'fanpage_permission_check'), 'keyword_fanpage_permission_check');
    }
    if (isPlatformSyncHealthRequest(normalizedMessage)) {
      return this.buildContextRoute('platform_sync_health', this.findBestScenario(message, role, 'platform_sync_health'), 'keyword_platform_sync_health');
    }
    if (isOpenAiConfigHealthRequest(normalizedMessage)) {
      return this.buildContextRoute('openai_config_health', this.findBestScenario(message, role, 'openai_config_health'), 'keyword_openai_config_health');
    }
    if (isWebhookFailureRequest(normalizedMessage)) {
      return this.buildContextRoute('webhook_failure_diagnostic', this.findBestScenario(message, role, 'webhook_failure_diagnostic'), 'keyword_webhook_failure');
    }
    if (normalizedMessage.includes('token') || normalizedMessage.includes('api key') || normalizedMessage.includes('openai')) {
      return this.buildContextRoute('token', this.findBestScenario(message, role, 'token'), 'keyword_token');
    }
    if (normalizedMessage.includes('endpoint') || normalizedMessage.includes('erp api')) {
      return this.buildContextRoute('api', this.findBestScenario(message, role, 'api'), 'keyword_api');
    }

    const matchedScenario = this.findBestScenario(message, role);
    if (matchedScenario) {
      return this.buildContextRoute(this.intentFromScenario(matchedScenario, role), matchedScenario, 'matched_scenario');
    }

    const inferredIntent = intentFromTextOrRole(message, role);
    return this.buildContextRoute(inferredIntent, null, 'inferred_intent');
  }

  private async loadScenarioSources(
    route: AiOperatorContextRoute,
    startDate: Date,
    now: Date,
    windowDays: number,
    auth: AiOperatorAuthContext,
  ): Promise<Record<string, AiSourceResult>> {
    const sources: Record<string, AiSourceResult> = {};
    const scheduled = new Set<string>();
    const tasks: Promise<void>[] = [];
    const add = <T>(key: string, loader: () => Promise<T>) => {
      if (scheduled.has(key)) return;
      scheduled.add(key);
      const requiredPermissions = this.requiredPermissionsForSource(key);
      if (!this.hasAnyPermission(auth, requiredPermissions)) {
        sources[key] = {
          ok: false,
          error: `permission_denied: ${requiredPermissions.join('|')}`,
        };
        return;
      }
      tasks.push(this.safeSource(key, loader).then((result) => {
        sources[key] = result;
      }));
    };
    const addFinance = () => {
      add('financial-control.dashboard', () => this.financialControlService.getDashboard());
      add('financial-control.forecast', () => this.financialControlService.getForecastForDashboard());
      add('financial-control.actions', () => this.financialControlService.getActionSuggestions());
    };
    const addAds = () => {
      add('financial-control.dashboard', () => this.financialControlService.getDashboard());
      add('financial-control.optimal-ads', () => this.financialControlService.getOptimalAdsSuggestion());
      add('ad-group-profit-report.performance', () =>
        this.profitReportService.getAdGroupPerformanceReport({
          startDate,
          endDate: now,
          minOrders: 1,
          onlyFinalized: true,
        }),
      );
      add('ad-group-profit-report.optimal-spend', () =>
        this.profitReportService.getOptimalSpendSuggestions({ lookbackDays: windowDays }),
      );
      addEmployeeKpi();
      addAdsSyncHealth();
      addAdsCostByAdGroup();
      addCostPerOrder();
      add('ads-alerts', async () => ({
        summary: this.adsAlertsService.getSummary(),
        alerts: this.adsAlertsService.getAllAlerts().slice(0, 30),
      }));
    };
    const addOrders = () => add('orders', () => this.operationsReader.buildOrderSnapshot(startDate, now));
    const addReturns = () => add('returns', () => this.operationsReader.buildReturnSnapshot(startDate, now));
    const addReceivables = () => add('receivables', () => this.operationsReader.buildReceivablesSnapshot(now));
    const addOperations = () => add('ops-actions', () => this.opsActionService.getActionSuggestions());
    const addToken = () => add('token-management', () => this.getTokenManagement());
    const addApiTokens = () => add('api-tokens', () => this.adsReader.buildApiTokenSnapshot());
    const addEmployeeKpi = () => add('employee-ads-kpi', () => this.adsReader.buildEmployeeAdsKpiSnapshot(startDate, now));
    const addAdsSyncHealth = () => add('advertising-cost.sync-health', () => this.adsReader.buildAdsSyncHealthSnapshot());
    const addAdsCostByAdGroup = () => add('advertising-cost.by-adgroup', () => this.adsReader.buildAdvertisingCostByAdGroupSnapshot(startDate, now));
    const addCostPerOrder = () => add('ad-report.cost-per-order', () => this.adsReader.buildCostPerOrderSnapshot(startDate, now));
    const addAdGroupProfitClassification = () => add('ads.ad-group-profit-classification', () =>
      this.profitReportService.getAdGroupProfitClassification({ days: windowDays, startDate, endDate: now }),
    );
    const addAdsDiagnostic = () => add('ads.diagnostic-overview', () => this.adsReader.buildAdsDiagnosticOverview(startDate, now, windowDays));
    const addDirectorFinanceDepth = () => {
      add('finance.funds-overview', () => this.financeReader.getFinanceFundsOverview());
      add('finance.available-fund-current', () => this.financeReader.buildAvailableFundSnapshot());
      add('loan-management.dashboard', () => this.financeReader.getLoanDashboard());
      add('owner-fund.summary', () => this.financeReader.buildOwnerFundSnapshot());
      add('cost.labor-summary', () => this.financeReader.buildLaborCashflowSnapshot(now, windowDays));
      add('cost.other-summary', () => this.financeReader.buildOtherCostCashflowSnapshot(now, windowDays));
      add('ads.cost-summary', () => this.financeReader.buildAdsCostCashflowSnapshot(startDate, now));
    };
    const addBudgetPreview = () => add('budget-allocation.preview', () => this.financeReader.getBudgetAllocationPreview());
    const addAiMarketing = () => {
      add('ai-marketing.overview', () => this.adsReader.getAiMarketingOverview(windowDays));
      add('ai-marketing.decision', () => this.adsReader.buildMarketingDecisionSnapshot(windowDays));
      add('ai-marketing.plans', () => this.adsReader.getAiMarketingPlans());
      add('ai-marketing.evaluations', () => this.adsReader.getAiMarketingEvaluations());
    };
    const addQuoteReadiness = () => add('quotes.readiness', () => this.financeReader.buildQuoteReadinessSnapshot(now));
    const addAccessAudit = () => add('access.audit', () => this.financeReader.buildAccessAuditSnapshot());
    const addSalesSupport = () => {
      add('sales-products', () => this.operationsReader.buildProductSalesSnapshot());
      add('sales-customers', () => this.operationsReader.buildCustomerSnapshot());
      add('sales-pending-orders', () => this.operationsReader.buildPendingOrderSnapshot());
    };
    const addBusinessFacts = () => add('business-facts', () => this.businessReader.buildBusinessFactsSnapshot(windowDays, now));
    const addPendingOrders = () => add('sales-pending-orders', () => this.operationsReader.buildPendingOrderSnapshot());
    const addChatSupport = () => add('chat-conversations', () => this.operationsReader.buildConversationSnapshot());
    const addMediaSupport = () => add('media-assets', () => this.operationsReader.buildMediaSnapshot());
    const addAdsEntities = () => {
      add('ad-groups', () => this.operationsReader.buildAdGroupSnapshot());
      add('ad-accounts', () => this.operationsReader.buildAdAccountSnapshot());
      add('fanpages', () => this.operationsReader.buildFanpageSnapshot());
    };
    const addSourceKey = (key: string) => {
      switch (key) {
        case 'financial-control.dashboard':
          add('financial-control.dashboard', () => this.financialControlService.getDashboard());
          break;
        case 'financial-control.forecast':
          add('financial-control.forecast', () => this.financialControlService.getForecastForDashboard());
          break;
        case 'financial-control.optimal-ads':
          add('financial-control.optimal-ads', () => this.financialControlService.getOptimalAdsSuggestion());
          break;
        case 'financial-control.actions':
          add('financial-control.actions', () => this.financialControlService.getActionSuggestions());
          break;
        case 'ad-group-profit-report.performance':
          add('ad-group-profit-report.performance', () =>
            this.profitReportService.getAdGroupPerformanceReport({
              startDate,
              endDate: now,
              minOrders: 1,
              onlyFinalized: true,
            }),
          );
          break;
        case 'ad-group-profit-report.optimal-spend':
          add('ad-group-profit-report.optimal-spend', () =>
            this.profitReportService.getOptimalSpendSuggestions({ lookbackDays: windowDays }),
          );
          break;
        case 'ads-alerts':
          add('ads-alerts', async () => ({
            summary: this.adsAlertsService.getSummary(),
            alerts: this.adsAlertsService.getAllAlerts().slice(0, 30),
          }));
          break;
        case 'orders':
          addOrders();
          break;
        case 'returns':
          addReturns();
          break;
        case 'receivables':
          addReceivables();
          break;
        case 'ops-actions':
          addOperations();
          break;
        case 'token-management':
          addToken();
          break;
        case 'api-tokens':
          addApiTokens();
          break;
        case 'employee-ads-kpi':
          addEmployeeKpi();
          break;
        case 'advertising-cost.sync-health':
          addAdsSyncHealth();
          break;
        case 'advertising-cost.by-adgroup':
          addAdsCostByAdGroup();
          break;
        case 'ad-report.cost-per-order':
          addCostPerOrder();
          break;
        case 'ads.ad-group-profit-classification':
          addAdGroupProfitClassification();
          break;
        case 'ads.diagnostic-overview':
          addAdsDiagnostic();
          break;
        case 'budget-allocation.preview':
          addBudgetPreview();
          break;
        case 'ai-marketing.overview':
        case 'ai-marketing.decision':
        case 'ai-marketing.plans':
        case 'ai-marketing.evaluations':
          addAiMarketing();
          break;
        case 'sales-products':
          add('sales-products', () => this.operationsReader.buildProductSalesSnapshot());
          break;
        case 'sales-customers':
          add('sales-customers', () => this.operationsReader.buildCustomerSnapshot());
          break;
        case 'sales-pending-orders':
          addPendingOrders();
          break;
        case 'business-facts':
          addBusinessFacts();
          break;
        case 'chat-conversations':
          addChatSupport();
          break;
        case 'media-assets':
          addMediaSupport();
          break;
        case 'ad-groups':
        case 'ad-accounts':
        case 'fanpages':
          addAdsEntities();
          break;
        case 'finance.funds-overview':
        case 'finance.available-fund-current':
        case 'loan-management.dashboard':
        case 'owner-fund.summary':
        case 'cost.labor-summary':
        case 'cost.other-summary':
        case 'ads.cost-summary':
          addDirectorFinanceDepth();
          break;
        case 'quotes.readiness':
          addQuoteReadiness();
          break;
        case 'access.audit':
          addAccessAudit();
          break;
      }
    };
    const addWorkflowReadSources = () => {
      const workflow = route.scenarioId ? this.findScenarioWorkflow(route.scenarioId) : null;
      if (!workflow) return;
      workflow.readApis
        .flatMap((endpoint) => this.sourceKeysForEndpoint(endpoint))
        .forEach((sourceKey) => addSourceKey(sourceKey));
    };

    switch (route.intent) {
      case 'product_count':
      case 'product_list':
      case 'product_profit_leaderboard':
      case 'fanpage_performance_lookup':
      case 'chatbot_fanpage_performance_lookup':
      case 'agent_revenue_leaderboard':
      case 'agent_profit_leaderboard':
      case 'ads_product_profit_leaderboard':
      case 'product_ads_revenue_ratio':
        addBusinessFacts();
        addWorkflowReadSources();
        await Promise.all(tasks);
        return sources;
      case 'director_daily_overview':
      case 'director_weekly_priority':
      case 'business_risk_ranking':
      case 'decision_waiting_approval':
      case 'company_kpi_scorecard':
      case 'root_cause_analysis':
      case 'anomaly_detection_daily':
      case 'priority_ranking':
      case 'owner_accountability_review':
      case 'target_gap_analysis':
      case 'period_comparison':
      case 'ai_recommendation_review':
      case 'concise_role_briefing':
        addFinance();
        addAds();
        addDirectorFinanceDepth();
        addBudgetPreview();
        addAiMarketing();
        addBusinessFacts();
        addOrders();
        addReceivables();
        addOperations();
        addApiTokens();
        addAdsSyncHealth();
        break;
      case 'finance':
      case 'free_cash_summary':
      case 'cashflow_forecast':
      case 'owner_withdrawal_readiness':
      case 'supplier_payment_priority':
      case 'receivables_collection_priority':
      case 'double_payment_risk':
      case 'tax_cash_reserve_check':
      case 'unit_economics':
        addFinance();
        addReceivables();
        addDirectorFinanceDepth();
        break;
      case 'advanced_cashflow_scenario':
      case 'scenario_analysis':
        addFinance();
        addReceivables();
        addDirectorFinanceDepth();
        addBudgetPreview();
        addAds();
        addAiMarketing();
        addBusinessFacts();
        addOrders();
        addSalesSupport();
        break;
      case 'ads_budget_cashflow_gate':
        addFinance();
        addReceivables();
        addDirectorFinanceDepth();
        addBudgetPreview();
        addAds();
        addAiMarketing();
        break;
      case 'ads':
      case 'marketing_funnel_health':
      case 'creative_fatigue_review':
      case 'offer_performance_review':
      case 'channel_mix_review':
      case 'channel_profitability_review':
      case 'product_decision_review':
      case 'resource_allocation_decision':
      case 'ads_scale_readiness':
      case 'ads_kill_or_pause_recommendation':
      case 'lead_quality_by_campaign':
      case 'attribution_quality_check':
        addAds();
        addAdsEntities();
        addBudgetPreview();
        addAiMarketing();
        addChatSupport();
        addPendingOrders();
        addSalesSupport();
        addBusinessFacts();
        addOrders();
        addReturns();
        addFinance();
        addDirectorFinanceDepth();
        break;
      case 'ad_group_profit_classification':
        addAdGroupProfitClassification();
        addWorkflowReadSources();
        await Promise.all(tasks);
        return sources;
      case 'ads_diagnostic_checklist':
        addAdsDiagnostic();
        addAds();
        addAdsEntities();
        addApiTokens();
        addChatSupport();
        addPendingOrders();
        addBudgetPreview();
        addAiMarketing();
        break;
      case 'orders':
      case 'late_order_diagnostic':
      case 'fulfillment_bottleneck':
      case 'tracking_issue_check':
      case 'cancel_refund_risk':
      case 'supplier_delay_risk':
      case 'sales':
      case 'lead_followup_health':
      case 'sales_conversion_by_user':
      case 'lead_quality_by_source':
      case 'lost_reason_summary':
      case 'sales_sla_violation':
      case 'sales_sla_task_creation':
      case 'customer_value_analysis':
      case 'quote_readiness':
        addOrders();
        addSalesSupport();
        addChatSupport();
        addMediaSupport();
        addAdsEntities();
        addOperations();
        break;
      case 'supplier':
        addOrders();
        addReturns();
        break;
      case 'receivables':
        addFinance();
        addReceivables();
        addDirectorFinanceDepth();
        break;
      case 'operations':
        addOperations();
        addOrders();
        addChatSupport();
        addPendingOrders();
        addEmployeeKpi();
        addApiTokens();
        addAdsSyncHealth();
        addAdsEntities();
        add('ads-alerts', async () => ({
          summary: this.adsAlertsService.getSummary(),
          alerts: this.adsAlertsService.getAllAlerts().slice(0, 30),
        }));
        break;
      case 'token':
      case 'token_health_check':
      case 'fanpage_permission_check':
      case 'platform_sync_health':
      case 'openai_config_health':
      case 'webhook_failure_diagnostic':
        addToken();
        addApiTokens();
        addAdsSyncHealth();
        addAdsEntities();
        break;
      case 'api':
        break;
      case 'overview':
      case 'loose':
      default:
        addFinance();
        addAds();
        addDirectorFinanceDepth();
        addBudgetPreview();
        addAiMarketing();
        addEmployeeKpi();
        addApiTokens();
        addAdsSyncHealth();
        addAdsCostByAdGroup();
        addCostPerOrder();
        addOrders();
        addReceivables();
        addOperations();
        addChatSupport();
        addPendingOrders();
        addMediaSupport();
        addAdsEntities();
        addQuoteReadiness();
        break;
    }

    const routeText = this.normalizeRouteText(route);
    if (routeText.includes('thanh toan') || routeText.includes('cong no') || routeText.includes('statement') || routeText.includes('hoa hong') || routeText.includes('ncc')) {
      addReceivables();
    }
    if (routeText.includes('don') || routeText.includes('tracking') || routeText.includes('giao hang')) {
      addOrders();
    }
    if (routeText.includes('return') || routeText.includes('hoan')) {
      addReturns();
    }
    if (routeText.includes('ads') || routeText.includes('roi') || routeText.includes('scale') || routeText.includes('budget')) {
      addAds();
      addAdsEntities();
      addBudgetPreview();
      addAiMarketing();
    }
    if (route.intent === 'ads_diagnostic_checklist') {
      addAdsDiagnostic();
    }
    if (routeText.includes('token') || routeText.includes('api-tokens') || routeText.includes('sync')) {
      addToken();
      addApiTokens();
      addAdsSyncHealth();
    }
    if (routeText.includes('kpi') || routeText.includes('phan cong') || routeText.includes('nhan vien') || routeText.includes('workload')) {
      addEmployeeKpi();
      addAdsEntities();
    }
    if (routeText.includes('cpo') || routeText.includes('cost') || routeText.includes('chi phi') || routeText.includes('cost-per-order')) {
      addAdsCostByAdGroup();
      addCostPerOrder();
    }
    if (routeText.includes('creative') || routeText.includes('lead') || routeText.includes('funnel') || routeText.includes('marketing')) {
      addAiMarketing();
    }
    if (routeText.includes('san pham') || routeText.includes('product') || routeText.includes('quote') || routeText.includes('bao gia')) {
      addSalesSupport();
      addQuoteReadiness();
    }
    if (
      routeText.includes('business-facts') ||
      routeText.includes('san pham') ||
      routeText.includes('product') ||
      routeText.includes('fanpage') ||
      routeText.includes('dai ly') ||
      routeText.includes('agent') ||
      routeText.includes('ads_product')
    ) {
      addBusinessFacts();
    }
    if (routeText.includes('media') || routeText.includes('creative') || routeText.includes('anh') || routeText.includes('asset')) {
      addMediaSupport();
      addSalesSupport();
    }
    if (routeText.includes('fanpage') || routeText.includes('hoi thoai') || routeText.includes('conversation') || routeText.includes('pending order')) {
      addChatSupport();
      addPendingOrders();
      addAdsEntities();
    }
    if (
      routeText.includes('owner') ||
      routeText.includes('von') ||
      routeText.includes('cash') ||
      routeText.includes('dong tien') ||
      routeText.includes('khoan vay') ||
      routeText.includes('chi phi') ||
      routeText.includes('runway')
    ) {
      addDirectorFinanceDepth();
    }
    if (routeText.includes('user') || routeText.includes('quyen') || routeText.includes('permission') || routeText.includes('phan quyen')) {
      addAccessAudit();
    }
    addWorkflowReadSources();

    await Promise.all(tasks);
    return sources;
  }

  private compactScenarioContext(
    route: AiOperatorContextRoute,
    sources: Record<string, AiSourceResult>,
    dataGaps: string[],
    auth: AiOperatorAuthContext,
    recommendations: AiOperatorRecommendation[] = [],
  ) {
    const performance = asArray(sources['ad-group-profit-report.performance']?.data);
    const suggestions = asArray(sources['ad-group-profit-report.optimal-spend']?.data);
    const selectedWorkflow = route.scenarioId ? this.findScenarioWorkflow(route.scenarioId) : null;
    const tokenPolicy = route.tokenPolicy || this.getTokenPolicyForIntent(route.intent);

    const compact = {
      route,
      tokenPolicy,
      authorization: {
        userId: auth.userId,
        role: auth.role,
        requestedRole: auth.requestedRole || null,
        permissions: auth.permissions,
        deniedSources: route.deniedSources || [],
        blocked: !!route.blocked,
        blockedReason: route.blockedReason || null,
      },
      selectedWorkflow: selectedWorkflow ? this.compactWorkflow(selectedWorkflow) : null,
      finance: {
        dashboard: sources['financial-control.dashboard']?.data || null,
        forecastLowPoint: sources['financial-control.forecast']?.data
          ? {
              lowPoint: sources['financial-control.forecast'].data.lowPoint,
              lowPointDay: sources['financial-control.forecast'].data.lowPointDay,
              isCashCrunch: sources['financial-control.forecast'].data.isCashCrunch,
              isSurvivalRisk: sources['financial-control.forecast'].data.isSurvivalRisk,
            }
          : null,
        optimalAds: sources['financial-control.optimal-ads']?.data || null,
        actions: sources['financial-control.actions']?.data?.actions?.slice?.(0, 10) || [],
      },
      ads: {
        diagnostic: sources['ads.diagnostic-overview']?.data || null,
        profitClassification: sources['ads.ad-group-profit-classification']?.data || null,
        alertsSummary: sources['ads-alerts']?.data?.summary || null,
        alerts: sources['ads-alerts']?.data?.alerts?.slice?.(0, 10) || [],
        syncHealth: sources['advertising-cost.sync-health']?.data || null,
        costByAdGroup: sources['advertising-cost.by-adgroup']?.data || null,
        costPerOrder: sources['ad-report.cost-per-order']?.data || null,
        worstAdGroups: performance
          .filter((item: any) => (item.totalAdsSpent || 0) > 0)
          .sort((a: any, b: any) => (a.totalNetProfit || 0) - (b.totalNetProfit || 0))
          .slice(0, 10),
        optimalSpendSuggestions: suggestions.slice(0, 10),
      },
      orders: sources.orders?.data || null,
      returns: sources.returns?.data || null,
      receivables: sources.receivables?.data || null,
      operations: sources['ops-actions']?.data || null,
      businessFacts: sources['business-facts']?.data || null,
      strategic: {
        fundsOverview: sources['finance.funds-overview']?.data || null,
        availableFunds: sources['finance.available-fund-current']?.data || null,
        budgetPreview: sources['budget-allocation.preview']?.data || null,
        loanDashboard: sources['loan-management.dashboard']?.data || null,
        ownerFund: sources['owner-fund.summary']?.data || null,
        laborCashflow: sources['cost.labor-summary']?.data || null,
        otherCostCashflow: sources['cost.other-summary']?.data || null,
        adsCostCashflow: sources['ads.cost-summary']?.data || null,
        quoteReadiness: sources['quotes.readiness']?.data || null,
        accessAudit: sources['access.audit']?.data || null,
      },
      tokenManagement: sources['token-management']?.data || null,
      manager: {
        employeeKpi: sources['employee-ads-kpi']?.data || null,
        tokenHealth: sources['api-tokens']?.data || null,
        budgetPreview: sources['budget-allocation.preview']?.data || null,
        marketing: sources['ai-marketing.decision']?.data || null,
        conversations: sources['chat-conversations']?.data || null,
        pendingOrders: sources['sales-pending-orders']?.data || null,
        media: sources['media-assets']?.data || null,
        adEntities: {
          adGroups: sources['ad-groups']?.data || null,
          adAccounts: sources['ad-accounts']?.data || null,
          fanpages: sources.fanpages?.data || null,
        },
      },
      aiMarketing: {
        overview: sources['ai-marketing.overview']?.data || null,
        decision: sources['ai-marketing.decision']?.data || null,
        plans: sources['ai-marketing.plans']?.data || null,
        evaluations: sources['ai-marketing.evaluations']?.data || null,
      },
      sales: {
        products: sources['sales-products']?.data || null,
        customers: sources['sales-customers']?.data || null,
        pendingOrders: sources['sales-pending-orders']?.data || null,
        conversations: sources['chat-conversations']?.data || null,
      },
      media: sources['media-assets']?.data || null,
      adsEntities: {
        adGroups: sources['ad-groups']?.data || null,
        adAccounts: sources['ad-accounts']?.data || null,
        fanpages: sources.fanpages?.data || null,
      },
      apiCatalog: tokenPolicy.includeApiCatalog ? this.filterApiCatalogForIntent(route.intent).slice(0, 4) : [],
      apiCoverage: this.buildApiCoverage(route, sources),
      assistantQuality: this.buildAssistantQualitySummary(route, sources, dataGaps),
      dataGaps,
    };

    const decisionSupport = buildDecisionSupport({
      route,
      context: compact,
      sources,
      dataGaps,
      recommendations,
    });

    return {
      ...compact,
      dataQuality: decisionSupport.dataQuality,
      decisionSupport: {
        metrics: decisionSupport.metrics,
        evaluations: decisionSupport.evaluations,
        responseContract: decisionSupport.responseContract,
      },
      workflowResult: {
        ...decisionSupport.workflowResult,
        data: {
          route: compact.route,
          finance: compact.finance,
          ads: compact.ads,
          orders: compact.orders,
          receivables: compact.receivables,
          operations: compact.operations,
          businessFacts: compact.businessFacts,
          strategic: compact.strategic,
          aiMarketing: compact.aiMarketing,
          sales: compact.sales,
        },
      },
    };
  }

  private buildAssistantQualitySummary(
    route: AiOperatorContextRoute,
    sources: Record<string, AiSourceResult>,
    dataGaps: string[],
  ) {
    const sourceRows = Object.entries(sources).map(([source, result]) => ({
      source,
      ok: !!result?.ok,
      error: result?.error || null,
    }));
    const loadedSources = sourceRows.filter((item) => item.ok).map((item) => item.source);
    const deniedSources = sourceRows
      .filter((item) => String(item.error || '').startsWith('permission_denied'))
      .map((item) => item.source);
    const failedSources = sourceRows
      .filter((item) => !item.ok && !String(item.error || '').startsWith('permission_denied'))
      .map((item) => ({ source: item.source, error: item.error }));
    const apiCoverage = this.buildApiCoverage(route, sources);

    let score = 100;
    score -= deniedSources.length * 20;
    score -= failedSources.length * 12;
    score -= apiCoverage.notLoadedReadApis.length * 8;
    score -= apiCoverage.missingApis.length * 20;
    score -= Math.min(20, dataGaps.length * 5);
    if (route.apiSufficiency === 'partial') score -= 10;
    if (route.apiSufficiency === 'missing') score -= 25;
    if (route.blocked) score -= 30;
    score = Math.max(0, Math.min(100, Math.round(score)));

    return {
      target: '9+',
      score,
      confidence: gradeAssistantConfidence(score),
      canAnswer: score >= 55 && !route.blocked,
      mustStateMissingData: deniedSources.length > 0 || failedSources.length > 0 || apiCoverage.notLoadedReadApis.length > 0 || dataGaps.length > 0,
      loadedSources,
      deniedSources,
      failedSources,
      coveredReadApiCount: apiCoverage.coveredReadApis.length,
      notLoadedReadApis: apiCoverage.notLoadedReadApis,
      missingApis: apiCoverage.missingApis,
      dataGaps,
      responseContract: [
        'Kết luận ngắn',
        'Dữ liệu đã đọc',
        'Phân tích tình huống',
        'Việc cần làm',
        'Rủi ro/thiếu dữ liệu',
        'Cần duyệt',
      ],
    };
  }

  private buildApiCoverage(route: AiOperatorContextRoute, sources: Record<string, AiSourceResult>) {
    const workflow = route.scenarioId ? this.findScenarioWorkflow(route.scenarioId) : null;
    const readApis = workflow?.readApis || [];
    const writeApis = workflow?.writeApis || [];
    const sourceStatus = Object.entries(sources).map(([source, result]) => ({
      source,
      ok: !!result?.ok,
      error: result?.error || null,
    }));
    const endpointCoverage = readApis.map((endpoint) => {
      const sourceKeys = this.sourceKeysForEndpoint(endpoint);
      const loadedSources = sourceKeys.filter((source) => sources[source]?.ok === true);
      const deniedSources = sourceKeys.filter((source) =>
        sources[source]?.ok === false && String(sources[source]?.error || '').startsWith('permission_denied'),
      );
      let status: 'loaded' | 'permission_denied' | 'not_loaded' | 'not_mapped' | 'missing_api' = 'not_mapped';
      if (endpoint.startsWith('MISSING ')) {
        status = 'missing_api';
      } else if (loadedSources.length) {
        status = 'loaded';
      } else if (deniedSources.length) {
        status = 'permission_denied';
      } else if (sourceKeys.length) {
        status = 'not_loaded';
      }
      return {
        endpoint,
        status,
        expectedSources: sourceKeys,
        loadedSources,
        deniedSources,
      };
    });

    return {
      scenarioId: workflow?.scenarioId || null,
      scenarioTitle: workflow?.title || null,
      apiSufficiency: workflow?.apiSufficiency || route.apiSufficiency || null,
      executionMode: workflow?.executionMode || route.executionMode || null,
      readApis,
      writeApis,
      loadedSources: sourceStatus.filter((item) => item.ok).map((item) => item.source),
      deniedSources: sourceStatus.filter((item) => String(item.error || '').startsWith('permission_denied')).map((item) => item.source),
      coveredReadApis: endpointCoverage.filter((item) => item.status === 'loaded').map((item) => item.endpoint),
      notLoadedReadApis: endpointCoverage
        .filter((item) => ['not_loaded', 'not_mapped', 'permission_denied'].includes(item.status))
        .map((item) => ({ endpoint: item.endpoint, status: item.status, expectedSources: item.expectedSources })),
      missingApis: [...readApis, ...writeApis].filter((endpoint) => endpoint.startsWith('MISSING ')),
      endpointCoverage,
    };
  }

  private sourceKeysForEndpoint(endpoint: string): string[] {
    const normalized = removeVietnameseTone(String(endpoint || '').replace(/^MISSING\s+/, '').replace(/\?.*$/, '')).toLowerCase();
    if (!normalized) return [];
    if (normalized.includes('/api/financial-control/dashboard')) return ['financial-control.dashboard'];
    if (normalized.includes('/api/financial-control/forecast')) return ['financial-control.forecast'];
    if (normalized.includes('/api/financial-control/optimal-ads')) return ['financial-control.optimal-ads'];
    if (normalized.includes('/api/financial-control/actions')) return ['financial-control.actions'];
    if (normalized.includes('/api/financial-control')) return ['financial-control.dashboard'];
    if (normalized.includes('/api/finance/free-cash-summary')) return ['financial-control.dashboard', 'finance.available-fund-current'];
    if (normalized.includes('/api/finance/cashflow-forecast')) return ['financial-control.forecast'];
    if (normalized.includes('/api/finance/unit-economics')) return ['ad-report.cost-per-order', 'ad-group-profit-report.performance'];
    if (normalized.includes('/api/finance/ads-budget-cashflow-gate')) return ['financial-control.dashboard', 'financial-control.forecast', 'budget-allocation.preview'];
    if (normalized.includes('/api/finance/supplier-payment-priority')) return ['receivables'];
    if (normalized.includes('/api/finance/tax-reserve-check')) return ['financial-control.dashboard'];
    if (normalized.includes('/api/finance/available-funds/current')) return ['finance.available-fund-current'];
    if (normalized.includes('/api/finance/repayments/upcoming')) return ['loan-management.dashboard'];
    if (normalized.includes('/api/finance/loan-contracts/summary/cashflow')) return ['loan-management.dashboard'];
    if (normalized.includes('/api/finance/loans') || normalized.includes('/api/loan-management')) return ['loan-management.dashboard'];
    if (normalized.includes('/api/finance/cashflow-health')) return ['financial-control.dashboard', 'financial-control.forecast'];
    if (normalized.includes('/api/funds/owner') || normalized.includes('/api/owner-fund')) return ['owner-fund.summary'];
    if (normalized.includes('/api/funds/ads')) return ['finance.funds-overview'];
    if (normalized.includes('/api/funds/survival-buffer') || normalized.includes('/api/finance/funds')) return ['finance.funds-overview'];
    if (normalized.includes('/api/budget-allocation')) return ['budget-allocation.preview'];
    if (normalized.includes('/api/cashflow/dashboard')) return ['financial-control.dashboard'];
    if (normalized.includes('/api/cashflow/alerts')) return ['financial-control.actions'];
    if (normalized.includes('/api/cashflow/ads/decision')) return ['financial-control.optimal-ads', 'budget-allocation.preview'];
    if (normalized.includes('/api/other-cost/summary/cashflow')) return ['cost.other-summary'];
    if (normalized.includes('/api/labor-cost1/summary/cashflow')) return ['cost.labor-summary'];
    if (normalized.includes('/api/labor-cost1/statements')) return ['cost.labor-summary'];
    if (normalized.includes('/api/other-cost')) return ['cost.other-summary'];
    if (normalized.includes('/api/advertising-cost/summary/cashflow')) return ['ads.cost-summary'];
    if (normalized.includes('/api/ads/ad-groups/profit-classification')) return ['ads.ad-group-profit-classification'];
    if (normalized.includes('/api/ads/diagnostic')) return ['ads.diagnostic-overview'];
    if (normalized.includes('/api/ads/creative-fatigue')) return ['ai-marketing.decision'];
    if (normalized.includes('/api/ads/channel-mix-review')) return ['advertising-cost.by-adgroup', 'ad-group-profit-report.performance'];
    if (normalized.includes('/api/ads/attribution-quality')) return ['advertising-cost.sync-health', 'ad-groups', 'fanpages'];
    if (normalized.includes('/api/marketing/funnel-summary')) return ['ai-marketing.decision', 'chat-conversations', 'sales-pending-orders'];
    if (normalized.includes('/api/marketing/offer-performance')) return ['ai-marketing.decision', 'sales-products', 'orders'];
    if (normalized.includes('/api/advertising-cost/sync/health')) return ['advertising-cost.sync-health'];
    if (normalized.includes('/api/advertising-cost/stats/by-adgroup')) return ['advertising-cost.by-adgroup'];
    if (normalized.includes('/api/advertising-cost/stats/summary') || normalized.includes('/api/advertising-cost/stats/daily-summary')) return ['advertising-cost.by-adgroup'];
    if (normalized.includes('/api/ad-report/cost-per-order')) return ['ad-report.cost-per-order'];
    if (normalized.includes('/api/ai-marketing/overview')) return ['ai-marketing.overview', 'ai-marketing.decision'];
    if (normalized.includes('/api/ai-marketing/leads/funnel')) return ['ai-marketing.decision'];
    if (normalized.includes('/api/ai-marketing/creatives/performance')) return ['ai-marketing.decision'];
    if (normalized.includes('/api/ai-marketing/creatives')) return ['ai-marketing.decision'];
    if (normalized.includes('/api/ai-marketing/plans')) return ['ai-marketing.plans'];
    if (normalized.includes('/api/ai-marketing/actions/evaluations')) return ['ai-marketing.evaluations'];
    if (normalized.includes('/api/employee-ads-kpi')) return ['employee-ads-kpi'];
    if (normalized.includes('/api/ad-group-profit-report/performance')) return ['ad-group-profit-report.performance'];
    if (normalized.includes('/api/ad-group-profit-report/optimal-spend') || normalized.includes('/api/ad-group-daily-report/optimal-spend')) {
      return ['ad-group-profit-report.optimal-spend'];
    }
    if (normalized.includes('/api/ad-group-profit-report') || normalized.includes('/api/ad-group-daily-report')) return ['ad-group-profit-report.performance'];
    if (normalized.includes('/api/ads-alerts')) return ['ads-alerts'];
    if (normalized.includes('/api/test-order2')) return ['orders'];
    if (normalized.includes('/api/order-status') || normalized.includes('/api/production-status') || normalized.includes('/api/delivery-status')) return ['orders'];
    if (normalized.includes('/api/return-report') || normalized.includes('/api/returns')) return ['returns'];
    if (normalized.includes('/api/supplier-payables') || normalized.includes('/api/agent-receivables') || normalized.includes('/api/agent-payables')) return ['receivables'];
    if (normalized.includes('/api/ops-actions') || normalized.includes('/api/emergency-actions')) return ['ops-actions'];
    if (normalized.includes('/api/tasks/create-from-ai-issue') || normalized.includes('/api/tasks/bulk-create-from-ai-report') || normalized.includes('/api/tasks/ai-followup-status')) {
      return ['ops-actions'];
    }
    if (normalized.includes('/api/ai-actions') || normalized.includes('/api/ai-decisions')) return ['ops-actions'];
    if (normalized.includes('/api/kpi') || normalized.includes('/api/metrics')) return ['financial-control.dashboard', 'ad-group-profit-report.performance', 'orders'];
    if (
      normalized.includes('/api/products/:id/media') ||
      normalized.includes('/api/products/:id/best-images') ||
      normalized.includes('/api/products/variation-images-report')
    ) {
      return ['sales-products', 'media-assets'];
    }
    if (normalized.includes('/api/products') || normalized.includes('/api/product-category')) return ['sales-products'];
    if (normalized.includes('/api/customers')) return ['sales-customers'];
    if (normalized.includes('/api/supplier-quotes') || normalized.includes('/api/quotes')) return ['quotes.readiness'];
    if (normalized.includes('/api/pending-orders')) return ['sales-pending-orders'];
    if (normalized.includes('/api/chat-messages')) return ['chat-conversations'];
    if (normalized.includes('/api/media')) return ['media-assets'];
    if (normalized.includes('/api/ad-groups')) return ['ad-groups'];
    if (normalized.includes('/api/ad-accounts')) return ['ad-accounts'];
    if (normalized.includes('/api/fanpages')) return ['fanpages'];
    if (normalized.includes('/api/api-tokens')) return ['api-tokens'];
    if (normalized.includes('/api/openai-configs')) return ['token-management'];
    if (normalized.includes('/api/users') || normalized.includes('/api/plan/info') || normalized.includes('/api/session-logs')) return ['access.audit'];
    return [];
  }

  private contextToSnapshot(
    now: Date,
    windowDays: number,
    sources: Record<string, AiSourceResult>,
    dataGaps: string[],
  ): AiOperatorSnapshot {
    const missing = (key: string): AiSourceResult => sources[key] || { ok: true, data: null };
    return {
      generatedAt: now.toISOString(),
      windowDays,
      finance: {
        dashboard: missing('financial-control.dashboard'),
        forecast: missing('financial-control.forecast'),
        optimalAds: missing('financial-control.optimal-ads'),
        actions: missing('financial-control.actions'),
      },
      ads: {
        performance: missing('ad-group-profit-report.performance'),
        profitClassification: missing('ads.ad-group-profit-classification'),
        optimalSpendSuggestions: missing('ad-group-profit-report.optimal-spend'),
        alerts: missing('ads-alerts'),
        diagnostic: missing('ads.diagnostic-overview'),
        syncHealth: missing('advertising-cost.sync-health'),
        costByAdGroup: missing('advertising-cost.by-adgroup'),
        costPerOrder: missing('ad-report.cost-per-order'),
      },
      orders: missing('orders'),
      returns: missing('returns'),
      receivables: missing('receivables'),
      operations: missing('ops-actions'),
      businessFacts: missing('business-facts'),
      manager: {
        employeeKpi: missing('employee-ads-kpi'),
        tokenHealth: missing('api-tokens'),
        budgetPreview: missing('budget-allocation.preview'),
        marketing: missing('ai-marketing.decision'),
        conversations: missing('chat-conversations'),
        pendingOrders: missing('sales-pending-orders'),
        media: missing('media-assets'),
        adEntities: {
          ok: !!(missing('ad-groups').ok || missing('fanpages').ok),
          data: {
            adGroups: missing('ad-groups').data || null,
            fanpages: missing('fanpages').data || null,
          },
          error: [missing('ad-groups'), missing('fanpages')]
            .filter((item) => item.ok === false)
            .map((item) => item.error)
            .filter(Boolean)
            .join('; ') || undefined,
        },
      },
      strategic: {
        fundsOverview: missing('finance.funds-overview'),
        availableFunds: missing('finance.available-fund-current'),
        budgetPreview: missing('budget-allocation.preview'),
        loanDashboard: missing('loan-management.dashboard'),
        ownerFund: missing('owner-fund.summary'),
        laborCashflow: missing('cost.labor-summary'),
        otherCostCashflow: missing('cost.other-summary'),
        adsCostCashflow: missing('ads.cost-summary'),
        aiMarketingOverview: missing('ai-marketing.overview'),
        aiMarketingPlans: missing('ai-marketing.plans'),
        aiMarketingEvaluations: missing('ai-marketing.evaluations'),
        quoteReadiness: missing('quotes.readiness'),
        accessAudit: missing('access.audit'),
      },
      dataGaps,
    };
  }

  private buildContextDataGaps(route: AiOperatorContextRoute): string[] {
    const workflow = route.scenarioId ? this.findScenarioWorkflow(route.scenarioId) : null;
    const gaps = [...(workflow?.missingDataOrApi || [])];
    const missingEndpoints = [...(workflow?.readApis || []), ...(workflow?.writeApis || [])].filter((endpoint) => endpoint.startsWith('MISSING '));
    if (missingEndpoints.length) {
      gaps.push(`Workflow ${workflow?.scenarioId} con thieu ERP API: ${missingEndpoints.join(', ')}.`);
    }
    if (route.intent === 'sales') {
      gaps.push('Lead module rieng chua ro; hien AI chi doc chat-message/pending-order/order neu co.');
    }
    if (route.intent === 'company_kpi_scorecard') {
      gaps.push('Target doanh thu/loi nhuan thang chua co API/config chuan trong AI snapshot; phan tram muc tieu chi tra duoc neu co target.');
    }
    if (['root_cause_analysis', 'anomaly_detection_daily', 'period_comparison'].includes(route.intent)) {
      gaps.push('Phan tich vi sao/bat thuong/so sanh can baseline hom qua, 7 ngay va 30 ngay; neu snapshot lich su thieu thi AI phai noi ro dang dung proxy tu ERP hien co.');
    }
    if (route.intent === 'priority_ranking') {
      gaps.push('Xep hang uu tien can cong thuc impact tien, khach hang, van hanh va urgency; neu thieu amount/owner thi chi xep theo tin hieu co du lieu.');
    }
    if (route.intent === 'owner_accountability_review') {
      gaps.push('Owner/accountability can task, SLA, KPI va audit owner chuan; hien co the phai suy tu ops-actions, employee KPI, conversation va order status.');
    }
    if (route.intent === 'target_gap_analysis') {
      gaps.push('Muc tieu doanh thu/loi nhuan/lead/order thang chua co API config chuan; cau tra loi can tach actual, target va gap neu target ton tai.');
    }
    if (['scenario_analysis', 'advanced_cashflow_scenario'].includes(route.intent)) {
      gaps.push('Phan tich neu-thi can gia dinh ve conversion, margin, cash collection, stock va payment timing; khong duoc trinh bay gia dinh nhu so lieu that.');
    }
    if (route.intent === 'resource_allocation_decision') {
      gaps.push('Quyet dinh tang/giam nguon luc can capacity, backlog, SLA va cash gate; hien chi duoc de xuat draft cho duyet.');
    }
    if (route.intent === 'channel_profitability_review') {
      gaps.push('Loi nhuan theo kenh phu thuoc attribution va mapping platform/ad group/source; neu mapping thieu phai neu ro do tin cay.');
    }
    if (route.intent === 'product_decision_review') {
      gaps.push('Quyet dinh day/dung san pham can ton kho realtime, return/cancel rate, margin sau ads va media readiness; neu thieu inventory phai canh bao.');
    }
    if (route.intent === 'customer_value_analysis') {
      gaps.push('CRM segmentation/LTV/consent remarketing chua chuan hoa; neu thieu thi dung order, conversation va source lead lam proxy.');
    }
    if (route.intent === 'ai_recommendation_review') {
      gaps.push('Can audit log de biet de xuat AI hom qua da duoc approve/executed hay chua; khong duoc noi da lam neu khong co log.');
    }
    if (route.intent === 'concise_role_briefing') {
      gaps.push('Ban tom tat ngan van phai giu data gaps va approval guardrail, khong duoc bo qua canh bao du lieu quan trong.');
    }
    if (route.intent === 'decision_waiting_approval') {
      gaps.push('Approval queue tap trung chua tach rieng; AI dang gom tu financial actions, ai-marketing plans/evaluations va ops suggestions.');
    }
    if (['lead_followup_health', 'sales_conversion_by_user', 'lead_quality_by_source', 'sales_sla_violation'].includes(route.intent)) {
      gaps.push('Lead module rieng chua day du; hien AI suy tu ai-marketing, chat-message, pending-order va order.');
    }
    if (['late_order_diagnostic', 'fulfillment_bottleneck', 'tracking_issue_check', 'cancel_refund_risk'].includes(route.intent)) {
      gaps.push('Ly do tre/khieu nai/tracking co the phai suy tu status neu carrier tracking hoac reason field chua du.');
    }
    if (route.intent === 'finance' || route.intent === 'receivables') {
      gaps.push('Invoice/payment approval va bank reconciliation chua duoc dong goi thanh context rieng cho AI.');
    }
    if (route.intent === 'ads') {
      gaps.push('Apply budget/pause campaign that van can approval executor va API platform ro rang.');
    }
    if (route.intent === 'ad_group_profit_classification') {
      gaps.push('Bao cao phan loai lai/lo nhom quang cao chi doc va phan tich; khong tu tang/giam/pause ads.');
      gaps.push('Neu spend = 0 thi phan loai chua du du lieu, khong noi mo ho la chua thay lo ro.');
    }
    if (BUSINESS_FACT_INTENTS.includes(route.intent)) {
      gaps.push('Business facts dung don hoan tat theo orderDate/createdAt; mapping ads-product phu thuoc adGroup.selectedProducts va advertisingcosts.adGroupId.');
    }
    if (route.intent === 'ads_diagnostic_checklist') {
      gaps.push('Campaign dang suy tu AdGroup.campaignId; chua co collection Campaign rieng.');
      gaps.push('Chua co collection Ads/Creative rieng de dem ads active that.');
      gaps.push('Chua co module Lead/Form rieng; lead/form duoc suy tu inbox, conversation va pending-order neu co.');
      gaps.push('Moi de xuat tang/giam ngan sach chi duoc tao o trang thai cho duyet; khong tu apply provider.');
    }
    if (route.intent === 'ads_budget_cashflow_gate') {
      gaps.push('Finance gate V2 dang dung Financial Control/Budget Allocation hien co; chua tach endpoint free-cash-summary rieng.');
      gaps.push('Tang ngan sach ads that van phai qua draft action, approval request va executor rieng.');
    }
    if (route.intent === 'marketing_funnel_health') {
      gaps.push('Marketing funnel V2 dang suy tu ai-marketing, conversation va pending-order; lead module rieng chua day du.');
    }
    if (route.intent === 'creative_fatigue_review') {
      gaps.push('Creative fatigue V2 can creative-level spend/frequency chuan neu provider chua sync du.');
    }
    if (route.intent === 'offer_performance_review') {
      gaps.push('Offer entity rieng chua co; offer performance dang suy tu product, quote va funnel signal.');
    }
    if (route.intent === 'sales_sla_task_creation') {
      gaps.push('Task API V2 duoc map tam vao ops-actions approval-only; chi tao task nhap neu executor that chua co.');
    }
    return Array.from(new Set(gaps));
  }

  private compactKnowledgeForContext(
    knowledge: ReturnType<typeof buildAiOperatorKnowledge>,
    route: AiOperatorContextRoute,
    auth: AiOperatorAuthContext,
  ) {
    const selectedWorkflow = route.scenarioId ? this.findScenarioWorkflow(route.scenarioId) : null;
    const filteredKnowledge = this.filterKnowledgeByPermissions(knowledge, auth);
    return {
      apiCatalog: this.filterApiCatalogForIntent(route.intent).filter((item) => this.isApiCatalogAllowed(item.domain, auth)).slice(0, 4),
      rolePlaybooks: (filteredKnowledge.rolePlaybooks || []).slice(0, 2),
      scenarioWorkflows: selectedWorkflow && this.isWorkflowAllowed(selectedWorkflow, auth)
        ? [selectedWorkflow]
        : (filteredKnowledge.scenarioWorkflows || []).slice(0, 5),
      questionPlaybook: this.questionPlaybookForIntent((knowledge as any).questionPlaybook || [], route.intent).slice(0, 3),
      tokenManagement: route.intent === 'token' && this.hasAnyPermission(auth, ['openai-configs'])
        ? knowledge.tokenManagement
        : undefined,
      guardrails: knowledge.guardrails,
    };
  }

  private questionPlaybookForIntent(playbook: any[], intent: AiOperatorIntent) {
    const direct = asArray(playbook).filter((group: any) => asArray(group.defaultIntents).includes(intent));
    if (direct.length) return direct;
    const familyMatches: Record<string, string[]> = {
      finance: ['cashflow_cfo', 'debt'],
      ads: ['ads_marketing'],
      orders: ['orders_operations'],
      sales: ['sales_lead', 'customer'],
      operations: ['daily_overview', 'people_performance'],
      receivables: ['debt'],
      token: ['system_integration'],
      overview: ['daily_overview'],
      loose: ['daily_overview'],
      root_cause_analysis: ['root_cause_analysis'],
      anomaly_detection_daily: ['anomaly_detection_daily'],
      priority_ranking: ['priority_ranking'],
      resource_allocation_decision: ['resource_allocation_decision'],
      owner_accountability_review: ['owner_accountability'],
      channel_profitability_review: ['channel_profitability'],
      product_decision_review: ['product_decision'],
      customer_value_analysis: ['customer_value'],
      advanced_cashflow_scenario: ['advanced_cashflow'],
      target_gap_analysis: ['target_gap'],
      period_comparison: ['period_comparison'],
      scenario_analysis: ['scenario_analysis'],
      ai_recommendation_review: ['ai_recommendation_review'],
      concise_role_briefing: ['concise_role_briefing'],
    };
    const groups = familyMatches[intent] || [];
    return asArray(playbook).filter((group: any) => groups.includes(group.groupId));
  }

  private getTokenPolicyForIntent(intent: AiOperatorIntent): AiOperatorTokenPolicy {
    return {
      ...DEFAULT_AI_OPERATOR_TOKEN_POLICY,
      ...(AI_OPERATOR_TOKEN_POLICIES[intent] || {}),
    };
  }

  private buildContextRoute(intent: AiOperatorIntent, scenario: ScenarioWorkflow | null, reason: string): AiOperatorContextRoute {
    return {
      intent,
      scenarioId: scenario?.scenarioId || null,
      scenarioTitle: scenario?.title || null,
      apiSufficiency: scenario?.apiSufficiency || null,
      executionMode: scenario?.executionMode || null,
      approvalRequired: scenario?.approvalRequired || false,
      tokenPolicy: this.getTokenPolicyForIntent(intent),
      reason,
    };
  }

  private findScenarioWorkflow(scenarioId: string): ScenarioWorkflow | null {
    const normalized = String(scenarioId || '').trim().toUpperCase();
    return SCENARIO_WORKFLOWS.find((item) => item.scenarioId.toUpperCase() === normalized) || null;
  }

  private findBestScenario(message: string, role?: string, intent?: AiOperatorIntent): ScenarioWorkflow | null {
    const normalized = removeVietnameseTone(message || '').toLowerCase();
    if (!normalized.trim()) return null;

    const candidates = SCENARIO_WORKFLOWS.filter((scenario) => {
      if (role && !scenario.roles.some((candidate) => this.roleAliasMatches(role, candidate))) return false;
      return !intent || this.intentFromScenario(scenario, role) === intent || intent === 'loose';
    });

    let best: ScenarioWorkflow | null = null;
    let bestScore = 0;
    const words = normalized.split(/[^a-z0-9]+/).filter((word) => word.length >= 4);
    for (const scenario of candidates.length ? candidates : SCENARIO_WORKFLOWS) {
      const haystack = removeVietnameseTone([
        scenario.scenarioId,
        scenario.title,
        scenario.trigger,
        scenario.goal,
        scenario.readApis.join(' '),
        scenario.writeApis.join(' '),
      ].join(' ')).toLowerCase();
      let score = normalized.includes(scenario.scenarioId.toLowerCase()) ? 100 : 0;
      for (const word of words) {
        if (haystack.includes(word)) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = scenario;
      }
    }

    return bestScore >= 3 ? best : null;
  }

  private intentFromScenario(scenario: ScenarioWorkflow, role?: string): AiOperatorIntent {
    const text = removeVietnameseTone(`${scenario.scenarioId} ${scenario.title} ${scenario.goal}`).toLowerCase();
    if (scenario.scenarioId === 'CFO-002' || text.includes('cashflow gate')) return 'ads_budget_cashflow_gate';
    if (scenario.scenarioId === 'MKT-004' || text.includes('funnel health')) return 'marketing_funnel_health';
    if (scenario.scenarioId === 'MKT-005' || text.includes('creative fatigue')) return 'creative_fatigue_review';
    if (scenario.scenarioId === 'MKT-006' || text.includes('offer performance')) return 'offer_performance_review';
    if (scenario.scenarioId === 'OPS-003' || text.includes('sales sla task')) return 'sales_sla_task_creation';
    if (text.includes('token')) return 'token';
    if (scenario.scenarioId.startsWith('ADS') || text.includes('ads') || text.includes('roi') || text.includes('scale') || text.includes('budget')) return 'ads';
    if (scenario.scenarioId.startsWith('SALES')) return 'sales';
    if (scenario.scenarioId.startsWith('SUP')) return 'supplier';
    if (text.includes('thanh toan') || text.includes('cong no') || text.includes('statement') || text.includes('hoa hong') || text.includes('ncc')) return 'receivables';
    if (text.includes('don') || text.includes('tracking') || text.includes('giao hang')) return 'orders';
    if (scenario.scenarioId.startsWith('MGR')) return 'operations';
    if (
      text.includes('dong tien') ||
      text.includes('cash') ||
      text.includes('von') ||
      text.includes('owner') ||
      text.includes('chi phi') ||
      text.includes('khoan vay') ||
      text.includes('loi nhuan')
    ) {
      return 'finance';
    }
    return intentFromTextOrRole('', role);
  }

  private filterApiCatalogForIntent(intent: AiOperatorIntent) {
    const matches: Partial<Record<AiOperatorIntent, string[]>> = {
      overview: ['Finance', 'Ads', 'Order', 'Supplier'],
      director_daily_overview: ['Finance', 'Ads', 'Order', 'Supplier'],
      director_weekly_priority: ['Finance', 'Ads', 'Order', 'Supplier'],
      business_risk_ranking: ['Finance', 'Ads', 'Order', 'Supplier', 'AI'],
      decision_waiting_approval: ['Finance', 'Ads', 'Supplier Payable', 'AI'],
      company_kpi_scorecard: ['Finance', 'Ads', 'Order', 'Supplier'],
      root_cause_analysis: ['Finance', 'Ads', 'Order', 'Product', 'AI'],
      anomaly_detection_daily: ['Finance', 'Ads', 'Order', 'Product', 'AI'],
      priority_ranking: ['Finance', 'Ads', 'Order', 'Supplier', 'AI'],
      resource_allocation_decision: ['Finance', 'Ads', 'Order', 'Product'],
      owner_accountability_review: ['Ads', 'AI', 'Order'],
      target_gap_analysis: ['Finance', 'Ads', 'Order', 'Product'],
      period_comparison: ['Finance', 'Ads', 'Order', 'Product'],
      scenario_analysis: ['Finance', 'Ads', 'Order', 'Product'],
      advanced_cashflow_scenario: ['Finance', 'Supplier Payable', 'Ads'],
      finance: ['Finance', 'Supplier Payable'],
      free_cash_summary: ['Finance', 'Supplier Payable'],
      cashflow_forecast: ['Finance', 'Supplier Payable'],
      ads_budget_cashflow_gate: ['Finance', 'Ads'],
      owner_withdrawal_readiness: ['Finance'],
      supplier_payment_priority: ['Finance', 'Supplier Payable'],
      receivables_collection_priority: ['Finance', 'Supplier Payable'],
      double_payment_risk: ['Finance', 'Supplier Payable'],
      tax_cash_reserve_check: ['Finance'],
      unit_economics: ['Finance', 'Ads', 'Order'],
      ads: ['Ads', 'Finance'],
      ad_group_profit_classification: ['Ads', 'Finance'],
      ads_diagnostic_checklist: ['Ads', 'AI', 'Order', 'Finance'],
      marketing_funnel_health: ['Ads', 'Order', 'Product'],
      creative_fatigue_review: ['Ads', 'Product'],
      offer_performance_review: ['Ads', 'Product', 'Order'],
      channel_mix_review: ['Ads', 'Finance'],
      channel_profitability_review: ['Ads', 'Finance', 'Order'],
      ads_scale_readiness: ['Ads', 'Finance'],
      ads_kill_or_pause_recommendation: ['Ads', 'Finance'],
      lead_quality_by_campaign: ['Ads', 'Order'],
      attribution_quality_check: ['Ads', 'AI'],
      product_count: ['Product'],
      product_list: ['Product'],
      product_profit_leaderboard: ['Product', 'Order'],
      product_decision_review: ['Product', 'Order', 'Ads'],
      fanpage_performance_lookup: ['AI', 'Ads', 'Order'],
      chatbot_fanpage_performance_lookup: ['AI', 'Ads', 'Order'],
      agent_revenue_leaderboard: ['Order', 'Product'],
      agent_profit_leaderboard: ['Order', 'Product'],
      ads_product_profit_leaderboard: ['Ads', 'Product', 'Order'],
      product_ads_revenue_ratio: ['Ads', 'Product', 'Order'],
      orders: ['Order', 'Product'],
      late_order_diagnostic: ['Order', 'Supplier Payable'],
      fulfillment_bottleneck: ['Order'],
      tracking_issue_check: ['Order'],
      cancel_refund_risk: ['Order', 'Supplier Payable'],
      supplier_delay_risk: ['Order', 'Supplier Payable'],
      receivables: ['Supplier Payable', 'Finance'],
      operations: ['Ads', 'AI', 'Order'],
      token: ['AI'],
      token_health_check: ['AI'],
      fanpage_permission_check: ['AI', 'Ads'],
      platform_sync_health: ['AI', 'Ads'],
      openai_config_health: ['AI'],
      webhook_failure_diagnostic: ['AI', 'Order'],
      api: [],
      sales: ['Product', 'Order', 'Supplier Payable'],
      customer_value_analysis: ['Product', 'Order', 'AI'],
      lead_followup_health: ['Product', 'Order', 'AI'],
      sales_conversion_by_user: ['Product', 'Order'],
      lead_quality_by_source: ['Ads', 'Order'],
      lost_reason_summary: ['Order'],
      sales_sla_violation: ['Order', 'AI'],
      sales_sla_task_creation: ['Order', 'AI'],
      quote_readiness: ['Product', 'Order'],
      supplier: ['Order', 'Supplier Payable'],
      ai_recommendation_review: ['AI', 'Ads', 'Finance', 'Order'],
      concise_role_briefing: ['Finance', 'Ads', 'Order', 'Supplier', 'AI'],
      loose: ['Finance', 'Ads', 'Order'],
    };
    const needles = matches[intent] || [];
    if (!needles.length) return ERP_API_CATALOG;
    return ERP_API_CATALOG.filter((item) => needles.some((needle) => item.domain.includes(needle)));
  }

  private compactWorkflow(workflow: ScenarioWorkflow) {
    return {
      scenarioId: workflow.scenarioId,
      roles: workflow.roles,
      title: workflow.title,
      goal: workflow.goal,
      readApis: workflow.readApis.slice(0, 6),
      writeApis: workflow.writeApis.slice(0, 6),
      apiSufficiency: workflow.apiSufficiency,
      executionMode: workflow.executionMode,
      approvalRequired: workflow.approvalRequired,
      guardrails: workflow.guardrails.slice(0, 4),
      missingDataOrApi: workflow.missingDataOrApi.slice(0, 4),
    };
  }

  private normalizeRouteText(route: AiOperatorContextRoute): string {
    return removeVietnameseTone(`${route.scenarioId || ''} ${route.scenarioTitle || ''} ${route.intent}`).toLowerCase();
  }

  private roleAliasMatches(requestedRole: string, candidate: string) {
    const requested = removeVietnameseTone(String(requestedRole || '')).toLowerCase();
    if (requested === candidate) return true;
    if (requested === 'sale' && candidate === 'sales') return true;
    if (requested === 'sales' && candidate === 'agent') return true;
    if (requested === 'agent' && candidate === 'sales') return true;
    if (requested === 'cfo' && candidate === 'accountant') return true;
    if (requested === 'accounting' && candidate === 'accountant') return true;
    return false;
  }

  private async tryAskOpenAI(
    message: string,
    scenarioContext: AiOperatorScenarioContext,
    recommendations: AiOperatorRecommendation[],
    knowledge: any,
    role?: string,
    tokenPolicy: AiOperatorTokenPolicy = this.getTokenPolicyForIntent(scenarioContext.route.intent),
  ): Promise<{ answer: string; model: string; tokenUsage: any } | null> {
    try {
      if (tokenPolicy.mode === 'no_ai') {
        return null;
      }

      const config = await this.openAIConfigService.pickConfig({ purpose: 'admin-assistant' });
      if (!config?.apiKey || config.apiKey === 'placeholder-key') {
        return null;
      }

      const model = config.model || 'gpt-4o-mini';
      const modelInput = buildAiModelInput(message, scenarioContext, recommendations, knowledge, role, tokenPolicy);
      const estimatedInputTokens = estimateTokenCount(JSON.stringify(modelInput));
      const systemPrompt = [
        config.systemPrompt || '',
        'Bạn là AI điều hành ERP cho doanh nghiệp Việt Nam.',
        buildAiAssistantQualityDirectives('operator'),
        role ? `Góc nhìn người dùng hiện tại: ${role}.` : '',
        'Chỉ phân tích dựa trên dữ liệu snapshot được cung cấp.',
        'Không nói rằng đã thực hiện hành động. Giai đoạn hiện tại là read-only.',
        'Bắt buộc trả lời bằng tiếng Việt có dấu đầy đủ. Không dùng tiếng Việt không dấu, không trả lời tiếng Anh trừ tên API, mã lỗi, tên module hoặc thuật ngữ kỹ thuật bắt buộc.',
        'Trả lời ngắn gọn, nhưng bắt buộc đủ 6 phần trong response contract nếu câu hỏi là điều hành/tài chính/ads/kế toán.',
        'Khi hỏi về ERP API, hãy giải thích ý nghĩa nghiệp vụ, endpoint liên quan và guardrail.',
        'Khi hỏi về tình huống vận hành, hãy trả lời theo role playbook được cung cấp.',
        'Khi hỏi về AI API token, phân biệt OpenAI Config với Api Token ads/social.',
        'Nếu route.intent là ad_group_profit_classification, không dùng template 6 phần. Bắt buộc trả lời bằng tổng số nhóm, số nhóm lãi/lỗ/hòa vốn/chưa đủ dữ liệu và bảng gồm nhóm, nền tảng, spend, lead, đơn, doanh thu, lợi nhuận sau ads, trạng thái, lý do. Không nhắc approval dài nếu user chỉ hỏi phân tích.',
        'Nếu route.intent là ads_diagnostic_checklist, bắt buộc trả lời đúng 10 mục checklist quảng cáo: tài khoản quảng cáo, fanpage, sync, campaign/adset/ad, spend 7 ngày, lead/inbox/form, attribution ERP, doanh thu/lợi nhuận theo nhóm, nhóm lỗ/lãi, và điều kiện tăng/giảm ngân sách. Không chuyển sang liệt kê bản đồ API.',
        'Phải đọc apiCoverage: chỉ kết luận dựa trên coveredReadApis/loadedSources; với notLoadedReadApis hoặc MISSING endpoint, nói rõ là chưa có trong context hoặc thiếu ERP API.',
        'Phải đọc assistantQuality: nếu score thấp/medium, giảm độ chắc chắn và nêu rõ bước cần bổ sung dữ liệu.',
        'Phai doc dataQuality V2: neu status=bad thi khong ket luan chac chan, uu tien sua sync/attribution/missing data truoc.',
        'Phai doc decisionSupport V2: voi ads scale, owner withdrawal, creative fatigue va sales SLA, hay dua ket luan theo rule pass/blocked/needs_review.',
        'Nếu dữ liệu thiếu, nói rõ module nào đang thiếu thay vì đoán.',
      ].filter(Boolean).join('\n');
      const configuredMaxOutput = config.maxTokens && config.maxTokens > 0 ? config.maxTokens : tokenPolicy.maxOutputTokens;
      const maxOutputTokens = Math.min(configuredMaxOutput, tokenPolicy.maxOutputTokens);

      const payload = {
        model,
        instructions: systemPrompt,
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: JSON.stringify(modelInput),
              },
            ],
          },
        ],
        max_output_tokens: maxOutputTokens,
        text: {
          verbosity: 'low',
        },
      };

      if (supportsReasoningEffort(model)) {
        (payload as any).reasoning = {
          effort: normalizeReasoningEffort(config.reasoningEffort),
        };
      }

      const response = await axios.post('https://api.openai.com/v1/responses', payload, {
        timeout: 20000,
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      const answer = this.extractResponseText(response.data);
      if (!answer) {
        return null;
      }

      const tokenUsage = buildOpenAiTokenUsage(scenarioContext, tokenPolicy, model, response.data?.usage, estimatedInputTokens);
      this.logger.log(`AI_OPERATOR_TOKEN_USAGE ${JSON.stringify(tokenUsage)}`);

      return { answer: enforceOperatorResponseContract(answer, scenarioContext), model, tokenUsage };
    } catch (error: any) {
      const message = error?.response?.data?.error?.message || error?.message || 'unknown OpenAI error';
      this.logger.warn(`OpenAI summary fallback used: ${message}`);
      return null;
    }
  }

  private compactSnapshot(snapshot: AiOperatorSnapshot) {
    const performance = asArray(snapshot.ads.performance.data);
    const suggestions = asArray(snapshot.ads.optimalSpendSuggestions.data);

    return {
      generatedAt: snapshot.generatedAt,
      windowDays: snapshot.windowDays,
      finance: {
        dashboard: snapshot.finance.dashboard.data,
        forecastLowPoint: snapshot.finance.forecast.data
          ? {
              lowPoint: snapshot.finance.forecast.data.lowPoint,
              lowPointDay: snapshot.finance.forecast.data.lowPointDay,
              isCashCrunch: snapshot.finance.forecast.data.isCashCrunch,
              isSurvivalRisk: snapshot.finance.forecast.data.isSurvivalRisk,
            }
          : null,
        actions: snapshot.finance.actions.data?.actions?.slice?.(0, 10) || [],
      },
      ads: {
        diagnostic: snapshot.ads.diagnostic?.data || null,
        profitClassification: snapshot.ads.profitClassification?.data || null,
        alertsSummary: snapshot.ads.alerts.data?.summary || null,
        syncHealth: snapshot.ads.syncHealth?.data || null,
        costByAdGroup: snapshot.ads.costByAdGroup?.data || null,
        costPerOrder: snapshot.ads.costPerOrder?.data || null,
        worstAdGroups: performance
          .filter((item: any) => (item.totalAdsSpent || 0) > 0)
          .sort((a: any, b: any) => (a.totalNetProfit || 0) - (b.totalNetProfit || 0))
          .slice(0, 10),
        optimalSpendSuggestions: suggestions.slice(0, 10),
      },
      orders: snapshot.orders.data,
      returns: snapshot.returns?.data,
      receivables: snapshot.receivables.data,
      operations: snapshot.operations.data,
      manager: {
        employeeKpi: snapshot.manager?.employeeKpi?.data || null,
        tokenHealth: snapshot.manager?.tokenHealth?.data || null,
        budgetPreview: snapshot.manager?.budgetPreview?.data || null,
        marketing: snapshot.manager?.marketing?.data || null,
        conversations: snapshot.manager?.conversations?.data || null,
        pendingOrders: snapshot.manager?.pendingOrders?.data || null,
        media: snapshot.manager?.media?.data || null,
        adEntities: snapshot.manager?.adEntities?.data || null,
      },
      strategic: {
        fundsOverview: snapshot.strategic.fundsOverview.data,
        availableFunds: snapshot.strategic.availableFunds.data,
        budgetPreview: snapshot.strategic.budgetPreview.data,
        loanDashboard: snapshot.strategic.loanDashboard.data,
        ownerFund: snapshot.strategic.ownerFund.data,
        laborCashflow: snapshot.strategic.laborCashflow.data,
        otherCostCashflow: snapshot.strategic.otherCostCashflow.data,
        adsCostCashflow: snapshot.strategic.adsCostCashflow.data,
        aiMarketingOverview: snapshot.strategic.aiMarketingOverview.data,
        aiMarketingPlans: snapshot.strategic.aiMarketingPlans.data,
        aiMarketingEvaluations: snapshot.strategic.aiMarketingEvaluations.data,
        quoteReadiness: snapshot.strategic.quoteReadiness.data,
        accessAudit: snapshot.strategic.accessAudit.data,
      },
      dataGaps: snapshot.dataGaps,
    };
  }

  private async safeSource<T>(source: string, loader: () => Promise<T>): Promise<AiSourceResult<T>> {
    try {
      return { ok: true, data: await loader() };
    } catch (error: any) {
      const message = error?.message || String(error);
      this.logger.warn(`AI source failed: ${source}: ${message}`);
      return { ok: false, error: message };
    }
  }

  private async safeSourceForAuth<T>(
    source: string,
    auth: AiOperatorAuthContext | null,
    loader: () => Promise<T>,
  ): Promise<AiSourceResult<T>> {
    if (auth) {
      const requiredPermissions = this.requiredPermissionsForSource(source);
      if (!this.hasAnyPermission(auth, requiredPermissions)) {
        return {
          ok: false,
          error: `permission_denied: ${requiredPermissions.join('|')}`,
        };
      }
    }
    return this.safeSource(source, loader);
  }

  private extractResponseText(data: any): string | null {
    if (typeof data?.output_text === 'string' && data.output_text.trim()) {
      return data.output_text.trim();
    }

    const chunks: string[] = [];
    for (const item of data?.output || []) {
      for (const content of item?.content || []) {
        if (typeof content?.text === 'string') {
          chunks.push(content.text);
        }
      }
    }

    const text = chunks.join('\n').trim();
    return text || null;
  }

  private normalizeWindowDays(windowDays: number): number {
    const numeric = Number(windowDays) || 7;
    return Math.min(90, Math.max(1, Math.round(numeric)));
  }
}