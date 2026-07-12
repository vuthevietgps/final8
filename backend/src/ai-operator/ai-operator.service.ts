import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import { Model, Types } from 'mongoose';
import { AdsAlertsService } from '../ads-alerts/ads-alerts.service';
import { AdGroupProfitReportService } from '../ad-group-profit-report/ad-group-profit-report.service';
import { AdReportService } from '../ad-report/ad-report.service';
import { AiMarketingService } from '../ai-marketing/ai-marketing.service';
import { ApiTokenService } from '../api-token/api-token.service';
import { AdvertisingCostService } from '../advertising-cost/advertising-cost.service';
import { AdvertisingCostFacebookSyncService } from '../advertising-cost/advertising-cost.facebook-sync.service';
import { AdvertisingCostGoogleSyncService } from '../advertising-cost/advertising-cost.google-sync.service';
import { AdvertisingCostTiktokSyncService } from '../advertising-cost/advertising-cost.tiktok-sync.service';
import { BudgetAllocationService } from '../finance/budget-allocation.service';
import { FinancialControlService } from '../finance/financial-control.service';
import { FundsService as FinanceFundsService } from '../finance/funds.service';
import { LoanManagementService } from '../finance/loan-management.service';
import { OpenAIConfigService } from '../openai-config/openai-config.service';
import { OpsActionService } from '../ops-action/ops-action.service';
import { getPermissionsForRole } from '../auth/role-permissions';
import { EmployeeAdsKpiService } from '../employee-ads-kpi/employee-ads-kpi.service';
import {
  buildAiAssistantQualityDirectives,
  gradeAssistantConfidence,
} from '../common/ai-assistant-quality';
import { AdAccount, AdAccountDocument } from '../ad-account/schemas/ad-account.schema';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import { AgentStatement, AgentStatementDocument } from '../agent-receivable/schemas/agent-statement.schema';
import { Conversation, ConversationDocument } from '../chat-message/schemas/conversation.schema';
import { Customer, CustomerDocument } from '../customer/schemas/customer.schema';
import { Fanpage, FanpageDocument } from '../fanpage/schemas/fanpage.schema';
import { Media, MediaDocument } from '../media/schemas/media.schema';
import { PendingOrder, PendingOrderDocument } from '../pending-order/schemas/pending-order.schema';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import { SupplierPayable, SupplierPayableDocument } from '../supplier-payable/schemas/supplier-payable.schema';
import { COMPLETED_ORDER_STATUSES } from '../test-order2/constants/test-order2.constants';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';
import { AiOperatorMessage, AiOperatorMessageDocument } from './schemas/ai-operator-message.schema';
import { AiOperatorSession, AiOperatorSessionDocument } from './schemas/ai-operator-session.schema';
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
  ROLE_PLAYBOOKS,
  SCENARIO_WORKFLOWS,
  ScenarioWorkflow,
} from './ai-operator.knowledge';
import {
  buildDecisionSupport,
  evaluateDecision,
  listAiOperatorV2Registries,
  responseContractForV2Intent,
} from './ai-operator.v2-registry';

const DAY_MS = 24 * 60 * 60 * 1000;

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

const BUSINESS_FACT_INTENTS: AiOperatorIntent[] = [
  'product_count',
  'product_list',
  'product_profit_leaderboard',
  'fanpage_performance_lookup',
  'chatbot_fanpage_performance_lookup',
  'agent_revenue_leaderboard',
  'agent_profit_leaderboard',
  'ads_product_profit_leaderboard',
  'product_ads_revenue_ratio',
];

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

const AI_OPERATOR_TOKEN_POLICIES: Partial<Record<AiOperatorIntent, AiOperatorTokenPolicy>> = {
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
    private readonly financialControlService: FinancialControlService,
    private readonly profitReportService: AdGroupProfitReportService,
    private readonly adsAlertsService: AdsAlertsService,
    private readonly opsActionService: OpsActionService,
    private readonly openAIConfigService: OpenAIConfigService,
    @InjectModel(TestOrder2.name)
    private readonly orderModel: Model<TestOrder2Document>,
    @InjectModel(SupplierPayable.name)
    private readonly supplierPayableModel: Model<SupplierPayableDocument>,
    @InjectModel(AgentStatement.name)
    private readonly agentStatementModel: Model<AgentStatementDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(PendingOrder.name)
    private readonly pendingOrderModel: Model<PendingOrderDocument>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Media.name)
    private readonly mediaModel: Model<MediaDocument>,
    @InjectModel(AdGroup.name)
    private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(AdAccount.name)
    private readonly adAccountModel: Model<AdAccountDocument>,
    @InjectModel(Fanpage.name)
    private readonly fanpageModel: Model<FanpageDocument>,
    @InjectModel(AiOperatorSession.name)
    private readonly aiSessionModel: Model<AiOperatorSessionDocument>,
    @InjectModel(AiOperatorMessage.name)
    private readonly aiMessageModel: Model<AiOperatorMessageDocument>,
    private readonly financeFundsService?: FinanceFundsService,
    private readonly budgetAllocationService?: BudgetAllocationService,
    private readonly loanManagementService?: LoanManagementService,
    private readonly aiMarketingService?: AiMarketingService,
    private readonly employeeAdsKpiService?: EmployeeAdsKpiService,
    private readonly apiTokenService?: ApiTokenService,
    private readonly advertisingCostService?: AdvertisingCostService,
    private readonly facebookSyncService?: AdvertisingCostFacebookSyncService,
    private readonly googleSyncService?: AdvertisingCostGoogleSyncService,
    private readonly tiktokSyncService?: AdvertisingCostTiktokSyncService,
    private readonly adReportService?: AdReportService,
  ) {}

  getKnowledge(role?: string, currentUser?: any) {
    const auth = this.buildAuthContext(currentUser, role);
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
    const auth = this.buildAuthContext(currentUser, dto?.role);
    const userId = this.requireUserObjectId(auth);
    const title = this.normalizeSessionTitle(dto?.title || 'Phiên AI Operator mới');
    const session = await new this.aiSessionModel({
      userId,
      userRole: auth.role,
      userName: auth.fullName,
      title,
      status: 'active',
      messageCount: 0,
      windowDays: 7,
      lastMessageAt: new Date(),
    }).save();

    return {
      success: true,
      session: this.toPublicSession(session),
    };
  }

  async listSessions(currentUser: any, query?: { limit?: any; status?: string; all?: any }) {
    const auth = this.buildAuthContext(currentUser);
    const userId = this.requireUserObjectId(auth);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 30));
    const canListAll = this.truthy(query?.all) && auth.permissions.includes('users');
    const filter: any = canListAll ? {} : { userId };
    if (query?.status && ['active', 'archived'].includes(query.status)) {
      filter.status = query.status;
    }

    const sessions = await this.aiSessionModel
      .find(filter)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .limit(limit)
      .lean();

    return {
      success: true,
      scope: canListAll ? 'all' : 'own',
      sessions: sessions.map((session) => this.toPublicSession(session)),
    };
  }

  async getSessionDetail(currentUser: any, sessionId: string, query?: { limit?: any }) {
    const auth = this.buildAuthContext(currentUser);
    const session = await this.findReadableSession(sessionId, auth);
    const limit = Math.min(200, Math.max(1, Number(query?.limit) || 80));
    const messages = await this.aiMessageModel
      .find({ sessionId: session._id })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    return {
      success: true,
      session: this.toPublicSession(session),
      messages: messages.map((message) => this.toPublicMessage(message)),
    };
  }

  async updateSession(currentUser: any, sessionId: string, dto: { title?: string; status?: string }) {
    const auth = this.buildAuthContext(currentUser);
    const session = await this.findWritableSession(sessionId, auth);
    const patch: any = {};
    if (dto.title) patch.title = this.normalizeSessionTitle(dto.title);
    if (dto.status && ['active', 'archived'].includes(dto.status)) patch.status = dto.status;
    if (!Object.keys(patch).length) {
      return { success: true, session: this.toPublicSession(session) };
    }
    const updated = await this.aiSessionModel.findByIdAndUpdate(session._id, { $set: patch }, { new: true }).lean();
    return {
      success: true,
      session: this.toPublicSession(updated),
    };
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
    const auth = this.buildAuthContext(currentUser);
    const reviewerId = this.requireUserObjectId(auth);
    const objectId = this.toObjectId(messageId, 'messageId');
    const message = await this.aiMessageModel.findById(objectId).lean();
    if (!message) {
      throw new NotFoundException('AI Operator message khong ton tai');
    }
    if (message.role !== 'assistant') {
      throw new BadRequestException('Chi danh gia cau tra loi cua AI Operator');
    }

    const session = await this.findReadableSession(String(message.sessionId), auth);
    const now = new Date();
    const tags = this.normalizeTags(dto.tags);
    const feedback = {
      rating: dto.rating,
      reason: this.trimText(dto.reason, 1000),
      correction: this.trimText(dto.correction, 4000),
      expectedIntent: this.normalizeIntent(dto.expectedIntent) || dto.expectedIntent || null,
      expectedScenarioId: dto.expectedScenarioId ? String(dto.expectedScenarioId).trim().toUpperCase() : null,
      tags,
      reviewedBy: reviewerId,
      reviewedAt: now,
    };
    const updated = await this.aiMessageModel.findByIdAndUpdate(objectId, { $set: { feedback } }, { new: true }).lean();

    const flags = this.buildFeedbackFlags(dto);
    const quality = {
      ...(session.quality || {}),
      lastFeedbackAt: now,
      lastFeedbackRating: dto.rating,
      needsReview: dto.rating === 'down' || flags.includes('wrong_intent') || flags.includes('missing_data'),
    };
    const sessionUpdate: any = { $set: { quality } };
    const addToSet: any = {};
    if (flags.length) addToSet.analysisFlags = { $each: flags };
    if (tags.length) addToSet.tags = { $each: tags };
    if (Object.keys(addToSet).length) sessionUpdate.$addToSet = addToSet;
    await this.aiSessionModel.findByIdAndUpdate(session._id, sessionUpdate);

    return {
      success: true,
      message: this.toPublicMessage(updated),
      sessionId: String(session._id),
    };
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
    const auth = this.buildAuthContext(currentUser);
    const reviewerId = this.requireUserObjectId(auth);
    const session = await this.findReadableSession(sessionId, auth);
    const now = new Date();
    const tags = this.normalizeTags(dto.tags);
    const outcome = dto.outcome || 'resolved';
    const quality = {
      ...(session.quality || {}),
      reviewed: true,
      outcome,
      score: typeof dto.score === 'number' ? dto.score : (session.quality?.score ?? null),
      improvementPriority: dto.improvementPriority || session.quality?.improvementPriority || 'none',
      notes: this.trimText(dto.notes, 3000),
      reviewedBy: reviewerId,
      reviewedAt: now,
    };
    const flags = this.buildSessionReviewFlags(outcome, dto.improvementPriority, tags);
    const update: any = { $set: { quality } };
    const addToSet: any = {};
    if (flags.length) addToSet.analysisFlags = { $each: flags };
    if (tags.length) addToSet.tags = { $each: tags };
    if (Object.keys(addToSet).length) update.$addToSet = addToSet;

    const updated = await this.aiSessionModel.findByIdAndUpdate(session._id, update, { new: true }).lean();
    return {
      success: true,
      session: this.toPublicSession(updated),
    };
  }

  async getConversationAnalytics(currentUser: any, query?: { from?: string; to?: string; limit?: any; all?: any }) {
    const auth = this.buildAuthContext(currentUser);
    const userId = this.requireUserObjectId(auth);
    const canReadAll = this.truthy(query?.all) && auth.permissions.includes('users');
    const limit = Math.min(50, Math.max(1, Number(query?.limit) || 10));
    const dateRange = this.parseAnalyticsDateRange(query?.from, query?.to);
    const messageMatch: any = canReadAll ? {} : { userId };
    const sessionMatch: any = canReadAll ? {} : { userId };
    if (dateRange) {
      messageMatch.createdAt = dateRange;
      sessionMatch.lastMessageAt = dateRange;
    }
    const assistantMatch = { ...messageMatch, role: 'assistant' };

    const [
      totalSessions,
      totalMessages,
      assistantMessages,
      blockedMessages,
      byIntent,
      byScenario,
      feedback,
      reviewOutcomes,
      modelUsage,
      deniedSources,
      dataGaps,
      improvementBacklog,
    ] = await Promise.all([
      this.aiSessionModel.countDocuments(sessionMatch),
      this.aiMessageModel.countDocuments(messageMatch),
      this.aiMessageModel.countDocuments(assistantMatch),
      this.aiMessageModel.countDocuments({ ...assistantMatch, 'qualitySignals.blocked': true }),
      this.aiMessageModel.aggregate([
        { $match: assistantMatch },
        {
          $group: {
            _id: { $ifNull: ['$intent', 'unknown'] },
            count: { $sum: 1 },
            down: { $sum: { $cond: [{ $eq: ['$feedback.rating', 'down'] }, 1, 0] } },
            blocked: { $sum: { $cond: ['$qualitySignals.blocked', 1, 0] } },
          },
        },
        { $sort: { count: -1 } },
      ]),
      this.aiMessageModel.aggregate([
        { $match: assistantMatch },
        {
          $group: {
            _id: { $ifNull: ['$scenarioId', 'none'] },
            count: { $sum: 1 },
            down: { $sum: { $cond: [{ $eq: ['$feedback.rating', 'down'] }, 1, 0] } },
            missingData: { $sum: { $cond: [{ $gt: ['$qualitySignals.dataGapCount', 0] }, 1, 0] } },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 30 },
      ]),
      this.aiMessageModel.aggregate([
        { $match: { ...assistantMatch, 'feedback.rating': { $exists: true } } },
        { $group: { _id: '$feedback.rating', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.aiSessionModel.aggregate([
        { $match: { ...sessionMatch, 'quality.outcome': { $exists: true } } },
        { $group: { _id: '$quality.outcome', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.aiMessageModel.aggregate([
        { $match: assistantMatch },
        { $group: { _id: { $ifNull: ['$modelUsed', 'rule_based'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.aiMessageModel.aggregate([
        { $match: assistantMatch },
        { $unwind: '$qualitySignals.deniedSources' },
        { $group: { _id: '$qualitySignals.deniedSources', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 30 },
      ]),
      this.aiMessageModel.aggregate([
        { $match: assistantMatch },
        { $unwind: '$contextSummary.dataGaps' },
        { $group: { _id: '$contextSummary.dataGaps', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 30 },
      ]),
      this.aiMessageModel
        .find(
          {
            ...assistantMatch,
            $or: [
              { 'feedback.rating': 'down' },
              { 'qualitySignals.blocked': true },
              { 'qualitySignals.dataGapCount': { $gt: 0 } },
            ],
          },
          {
            content: 1,
            sessionId: 1,
            intent: 1,
            scenarioId: 1,
            modelUsed: 1,
            feedback: 1,
            qualitySignals: 1,
            createdAt: 1,
          },
        )
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(limit)
        .lean(),
    ]);

    return {
      success: true,
      scope: canReadAll ? 'all' : 'own',
      generatedAt: new Date().toISOString(),
      from: dateRange?.$gte || null,
      to: dateRange?.$lte || null,
      totals: {
        sessions: totalSessions,
        messages: totalMessages,
        assistantMessages,
        blockedMessages,
      },
      byIntent: this.normalizeAggregateRows(byIntent),
      byScenario: this.normalizeAggregateRows(byScenario),
      feedback: this.normalizeAggregateRows(feedback),
      reviewOutcomes: this.normalizeAggregateRows(reviewOutcomes),
      modelUsage: this.normalizeAggregateRows(modelUsage),
      riskSignals: {
        deniedSources: this.normalizeAggregateRows(deniedSources),
        dataGaps: this.normalizeAggregateRows(dataGaps),
      },
      improvementBacklog: improvementBacklog.map((message: any) => ({
        _id: String(message._id),
        sessionId: String(message.sessionId || ''),
        intent: message.intent || null,
        scenarioId: message.scenarioId || null,
        modelUsed: message.modelUsed || null,
        feedback: message.feedback || null,
        qualitySignals: message.qualitySignals || null,
        contentPreview: this.trimText(message.content, 500),
        createdAt: message.createdAt,
      })),
    };
  }

  getWorkflowQuality(currentUser: any, role?: string) {
    const auth = this.buildAuthContext(currentUser, role);
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

  private async persistChatTurn(currentUser: any, sessionId: string | undefined, userMessage: string, response: any) {
    const auth = this.buildAuthContext(currentUser, response.role || undefined);
    if (!auth.userId) return null;

    const userId = this.requireUserObjectId(auth);
    const session = sessionId
      ? await this.findWritableSession(sessionId, auth)
      : await new this.aiSessionModel({
          userId,
          userRole: auth.role,
          userName: auth.fullName,
          title: this.normalizeSessionTitle(userMessage),
          status: 'active',
          messageCount: 0,
          lastIntent: response.route?.intent,
          lastScenarioId: response.route?.scenarioId,
          lastMessageAt: new Date(),
          windowDays: response.context?.windowDays || 7,
          tags: this.buildSessionTags(response.route),
        }).save();

    const now = new Date();
    const contextSummary = this.buildStoredContextSummary(response);
    const qualitySignals = this.buildQualitySignals(response);
    const agentTrace = response.agentTrace || null;
    const insertedMessages = await this.aiMessageModel.insertMany([
      {
        sessionId: session._id,
        userId,
        role: 'user',
        content: userMessage,
        intent: response.route?.intent,
        scenarioId: response.route?.scenarioId,
        route: response.route,
        authSnapshot: response.auth,
        contextSummary,
        recommendations: this.compactStoredRecommendations(response.recommendations),
        qualitySignals,
        agentTrace,
      },
      {
        sessionId: session._id,
        userId,
        role: 'assistant',
        content: response.answer,
        modelUsed: response.modelUsed || undefined,
        intent: response.route?.intent,
        scenarioId: response.route?.scenarioId,
        route: response.route,
        authSnapshot: response.auth,
        contextSummary,
        recommendations: this.compactStoredRecommendations(response.recommendations),
        qualitySignals,
        agentTrace,
      },
    ]);

    const updated = await this.aiSessionModel.findByIdAndUpdate(
      session._id,
      {
        $inc: { messageCount: 2 },
        $set: {
          userRole: auth.role,
          userName: auth.fullName,
          lastIntent: response.route?.intent,
          lastScenarioId: response.route?.scenarioId,
          lastMessageAt: now,
          windowDays: response.context?.windowDays || session.windowDays || 7,
          tags: this.buildSessionTags(response.route),
        },
      },
      { new: true },
    );

    const assistantMessage = insertedMessages.find((message: any) => message.role === 'assistant');
    const userStoredMessage = insertedMessages.find((message: any) => message.role === 'user');

    return {
      session: updated || session,
      assistantMessageId: assistantMessage?._id ? String(assistantMessage._id) : null,
      userMessageId: userStoredMessage?._id ? String(userStoredMessage._id) : null,
    };
  }

  private async findReadableSession(sessionId: string, auth: AiOperatorAuthContext): Promise<any> {
    const objectId = this.toObjectId(sessionId);
    const session = await this.aiSessionModel.findById(objectId).lean();
    if (!session) {
      throw new NotFoundException('AI Operator session khong ton tai');
    }
    const ownerId = String(session.userId || '');
    if (ownerId !== auth.userId && !auth.permissions.includes('users')) {
      throw new ForbiddenException('Ban khong co quyen xem phien AI nay');
    }
    return session;
  }

  private async findWritableSession(sessionId: string, auth: AiOperatorAuthContext): Promise<any> {
    const objectId = this.toObjectId(sessionId);
    const session = await this.aiSessionModel.findById(objectId);
    if (!session) {
      throw new NotFoundException('AI Operator session khong ton tai');
    }
    const ownerId = String((session as any).userId || '');
    if (ownerId !== auth.userId) {
      throw new ForbiddenException('Chi chu so huu phien moi duoc tiep tuc hoi trong phien nay');
    }
    if ((session as any).status === 'archived') {
      throw new BadRequestException('Phien AI da archive, khong the tiep tuc chat');
    }
    return session;
  }

  private requireUserObjectId(auth: AiOperatorAuthContext): Types.ObjectId {
    if (!auth.userId || !Types.ObjectId.isValid(auth.userId)) {
      throw new BadRequestException('Khong xac dinh duoc user hien tai de luu phien AI');
    }
    return new Types.ObjectId(auth.userId);
  }

  private toObjectId(value: string, label = 'sessionId'): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`${label} khong hop le`);
    }
    return new Types.ObjectId(value);
  }

  private toPublicSession(session: any) {
    if (!session) return null;
    return {
      _id: String(session._id),
      userId: String(session.userId || ''),
      userRole: session.userRole,
      userName: session.userName,
      title: session.title,
      status: session.status,
      messageCount: session.messageCount || 0,
      lastIntent: session.lastIntent || null,
      lastScenarioId: session.lastScenarioId || null,
      lastMessageAt: session.lastMessageAt || null,
      windowDays: session.windowDays || 7,
      tags: session.tags || [],
      quality: session.quality || null,
      analysisFlags: session.analysisFlags || [],
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  private toPublicMessage(message: any) {
    return {
      _id: String(message._id),
      sessionId: String(message.sessionId || ''),
      role: message.role,
      content: message.content,
      modelUsed: message.modelUsed || null,
      intent: message.intent || null,
      scenarioId: message.scenarioId || null,
      route: message.route || null,
      authSnapshot: message.authSnapshot || null,
      contextSummary: message.contextSummary || null,
      recommendations: message.recommendations || [],
      qualitySignals: message.qualitySignals || null,
      agentTrace: message.agentTrace || null,
      feedback: message.feedback || null,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }

  private normalizeSessionTitle(value: string): string {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return 'Phien AI Operator';
    return normalized.length > 90 ? `${normalized.slice(0, 87)}...` : normalized;
  }

  private buildSessionTags(route?: AiOperatorContextRoute): string[] {
    return [route?.intent, route?.scenarioId].filter(Boolean) as string[];
  }

  private buildStoredContextSummary(response: any) {
    const context = response.context || {};
    return {
      route: response.route || null,
      authorization: context.authorization || null,
      selectedWorkflow: context.selectedWorkflow || null,
      apiCoverage: context.apiCoverage || null,
      assistantQuality: context.assistantQuality || response.assistantQuality || null,
      dataGaps: context.dataGaps || [],
      sourceStatus: this.buildSourceStatus(context),
    };
  }

  private buildQualitySignals(response: any) {
    const context = response.context || {};
    const route = response.route || {};
    const deniedSources = route.deniedSources || context.authorization?.deniedSources || [];
    const dataGaps = context.dataGaps || [];
    const apiCoverage = context.apiCoverage || {};
    const recommendations = this.compactStoredRecommendations(response.recommendations);
    return {
      blocked: !!route.blocked || !!context.authorization?.blocked,
      blockedReason: route.blockedReason || context.authorization?.blockedReason || null,
      deniedSourceCount: deniedSources.length,
      deniedSources,
      dataGapCount: dataGaps.length,
      hasRecommendations: recommendations.length > 0,
      recommendationCount: recommendations.length,
      routeReason: route.reason || null,
      apiSufficiency: route.apiSufficiency || null,
      executionMode: route.executionMode || null,
      approvalRequired: !!route.approvalRequired,
      modelUsed: response.modelUsed || null,
      loadedSourceCount: apiCoverage.loadedSources?.length || 0,
      notLoadedReadApiCount: apiCoverage.notLoadedReadApis?.length || 0,
      missingApiCount: apiCoverage.missingApis?.length || 0,
      assistantQualityScore: context.assistantQuality?.score ?? response.assistantQuality?.score ?? null,
      assistantConfidence: context.assistantQuality?.confidence ?? response.assistantQuality?.confidence ?? null,
      sourceStatus: this.buildSourceStatus(context),
    };
  }

  private buildSourceStatus(context: any) {
    return {
      blocked: !!context?.authorization?.blocked,
      deniedSources: context?.authorization?.deniedSources || [],
      hasFinance: !!context?.finance && Object.values(context.finance).some(Boolean),
      hasAds: !!context?.ads && Object.values(context.ads).some(Boolean),
      hasOrders: !!context?.orders,
      hasReceivables: !!context?.receivables,
      hasOperations: !!context?.operations,
      hasTokenManagement: !!context?.tokenManagement,
      hasSalesProducts: !!context?.sales?.products,
      hasSalesCustomers: !!context?.sales?.customers,
      hasPendingOrders: !!context?.sales?.pendingOrders,
      hasChatConversations: !!context?.sales?.conversations,
      hasMediaAssets: !!context?.media,
      hasAdGroups: !!context?.adsEntities?.adGroups,
      hasAdAccounts: !!context?.adsEntities?.adAccounts,
      hasFanpages: !!context?.adsEntities?.fanpages,
      hasStrategicFinance: !!context?.strategic && Object.values(context.strategic).some(Boolean),
      hasAiMarketing: !!context?.aiMarketing && Object.values(context.aiMarketing).some(Boolean),
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

  private compactStoredRecommendations(recommendations: AiOperatorRecommendation[] = []) {
    return recommendations.slice(0, 10).map((item) => ({
      id: item.id,
      type: item.type,
      priority: item.priority,
      title: this.ensureVietnameseUiResponse(item.title),
      requiresApproval: item.requiresApproval,
      riskLevel: item.riskLevel,
      source: item.source,
    }));
  }

  private ensureVietnameseRecommendations(recommendations: AiOperatorRecommendation[] = []): AiOperatorRecommendation[] {
    return recommendations.map((item) => ({
      ...item,
      title: this.ensureVietnameseUiResponse(item.title),
      reason: this.ensureVietnameseUiResponse(item.reason),
      proposedAction: this.ensureVietnameseUiResponse(item.proposedAction),
    }));
  }

  private buildFeedbackFlags(dto: {
    rating?: 'up' | 'down' | 'neutral';
    expectedIntent?: string;
    expectedScenarioId?: string;
    tags?: string[];
  }): string[] {
    const flags: string[] = [];
    if (dto.rating === 'down') flags.push('needs_review', 'bad_answer');
    if (dto.expectedIntent) flags.push('wrong_intent');
    if (dto.expectedScenarioId) flags.push('wrong_scenario');
    for (const tag of this.normalizeTags(dto.tags)) {
      if (['missing_data', 'wrong_intent', 'bad_answer', 'permission_blocked'].includes(tag)) {
        flags.push(tag);
      }
    }
    return Array.from(new Set(flags));
  }

  private buildSessionReviewFlags(outcome: string, priority?: string, tags: string[] = []): string[] {
    const flags = tags.filter(Boolean);
    if (['needs_followup', 'wrong_intent', 'missing_data', 'bad_answer'].includes(outcome)) {
      flags.push(outcome);
    }
    if (priority && priority !== 'none') {
      flags.push(`improvement_${priority}`);
    }
    return Array.from(new Set(flags));
  }

  private normalizeTags(tags?: string[]): string[] {
    return (tags || [])
      .map((tag) => this.removeVietnameseTone(String(tag || '').trim()).toLowerCase().replace(/[^a-z0-9_-]+/g, '_'))
      .filter(Boolean)
      .slice(0, 20);
  }

  private trimText(value: any, maxLength: number): string | null {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return null;
    return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 3))}...` : text;
  }

  private maskPhone(value: any): string | null {
    const digits = String(value || '').replace(/\D+/g, '');
    if (!digits) return null;
    if (digits.length <= 4) return '***';
    return `${digits.slice(0, Math.min(3, digits.length - 4))}***${digits.slice(-4)}`;
  }

  private parseAnalyticsDateRange(from?: string, to?: string) {
    const range: any = {};
    if (from) {
      const parsedFrom = new Date(from);
      if (!Number.isNaN(parsedFrom.getTime())) range.$gte = parsedFrom;
    }
    if (to) {
      const parsedTo = new Date(to);
      if (!Number.isNaN(parsedTo.getTime())) range.$lte = parsedTo;
    }
    return Object.keys(range).length ? range : null;
  }

  private normalizeAggregateRows(rows: any[] = []) {
    return rows.map((row) => ({
      key: row._id ?? 'unknown',
      count: row.count || 0,
      down: row.down || 0,
      blocked: row.blocked || 0,
      missingData: row.missingData || 0,
    }));
  }

  private truthy(value: any): boolean {
    return value === true || value === 'true' || value === '1' || value === 1;
  }

  async getSnapshot(windowDays = 7, currentUser?: any): Promise<AiOperatorSnapshot> {
    const normalizedWindow = this.normalizeWindowDays(windowDays);
    const now = new Date();
    const startDate = new Date(now.getTime() - normalizedWindow * DAY_MS);
    const auth = currentUser ? this.buildAuthContext(currentUser) : null;
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
        load('orders', () => this.buildOrderSnapshot(startDate, now)),
        load('returns', () => this.buildReturnSnapshot(startDate, now)),
        load('receivables', () => this.buildReceivablesSnapshot(now)),
        load('ops-actions', () => this.opsActionService.getActionSuggestions()),
        load('employee-ads-kpi', () => this.buildEmployeeAdsKpiSnapshot(startDate, now)),
        load('api-tokens', () => this.buildApiTokenSnapshot()),
        load('advertising-cost.sync-health', () => this.buildAdsSyncHealthSnapshot()),
        load('advertising-cost.by-adgroup', () => this.buildAdvertisingCostByAdGroupSnapshot(startDate, now)),
        load('ad-report.cost-per-order', () => this.buildCostPerOrderSnapshot(startDate, now)),
        load('ai-marketing.decision', () => this.buildMarketingDecisionSnapshot(normalizedWindow)),
        load('chat-conversations', () => this.buildConversationSnapshot()),
        load('sales-pending-orders', () => this.buildPendingOrderSnapshot()),
        load('media-assets', () => this.buildMediaSnapshot()),
        load('ad-groups', () => this.buildAdGroupSnapshot()),
        load('fanpages', () => this.buildFanpageSnapshot()),
        load('finance.funds-overview', () => this.getFinanceFundsOverview()),
        load('finance.available-fund-current', () => this.buildAvailableFundSnapshot()),
        load('budget-allocation.preview', () => this.getBudgetAllocationPreview()),
        load('loan-management.dashboard', () => this.getLoanDashboard()),
        load('owner-fund.summary', () => this.buildOwnerFundSnapshot()),
        load('cost.labor-summary', () => this.buildLaborCashflowSnapshot(now, normalizedWindow)),
        load('cost.other-summary', () => this.buildOtherCostCashflowSnapshot(now, normalizedWindow)),
        load('ads.cost-summary', () => this.buildAdsCostCashflowSnapshot(startDate, now)),
        load('ai-marketing.overview', () => this.getAiMarketingOverview(normalizedWindow)),
        load('ai-marketing.plans', () => this.getAiMarketingPlans()),
        load('ai-marketing.evaluations', () => this.getAiMarketingEvaluations()),
        load('quotes.readiness', () => this.buildQuoteReadinessSnapshot(now)),
        load('access.audit', () => this.buildAccessAuditSnapshot()),
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
    const auth = this.buildAuthContext(params.currentUser, params.role);
    const effectiveRole = params.role || auth.role || undefined;
    const route = this.resolveContextRoute(params.message || '', effectiveRole, params.scenarioId, params.intent);
    const sources = await this.loadScenarioSources(route, startDate, now, normalizedWindow, auth);
    const authorizedRoute = this.applyRouteAuthorization(route, sources, auth);
    const dataGaps = this.buildContextDataGaps(route);
    const recommendations = authorizedRoute.blocked
      ? []
      : this.ensureVietnameseRecommendations(this.buildRecommendations(this.contextToSnapshot(now, normalizedWindow, sources, dataGaps)));
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
      ? this.buildPermissionDeniedAnswer(scenarioContext)
      : aiResult?.answer || this.buildRuleBasedAnswer(message, fallbackSnapshot, recommendations, compactKnowledge as any, scenarioContext.role || undefined, scenarioContext.route);

    const response = {
      success: true,
      mode: 'read_only',
      generatedAt: scenarioContext.generatedAt,
      role: scenarioContext.role,
      auth: scenarioContext.auth,
      modelUsed: aiResult?.model || null,
      tokenPolicy,
      tokenUsage: aiResult?.tokenUsage || this.buildNoAiTokenUsage(scenarioContext, tokenPolicy),
      answer: this.ensureVietnameseUiResponse(rawAnswer),
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

    const persistedTurn = await this.persistChatTurn(currentUser, sessionId, message, response);

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
      recommendations: this.ensureVietnameseRecommendations(this.buildRecommendations(snapshot)),
      note: 'Các đề xuất này chưa được đóng gói thành kế hoạch và chưa thực thi.',
    };
  }

  private async buildOrderSnapshot(startDate: Date, endDate: Date) {
    const dateMatch = this.dateRangeMatch(startDate, endDate);

    const [totalInWindow, byStatus, recentOrders, pendingPayments] = await Promise.all([
      this.orderModel.countDocuments({ isActive: { $ne: false }, ...dateMatch }),
      this.orderModel.aggregate([
        { $match: { isActive: { $ne: false }, ...dateMatch } },
        {
          $group: {
            _id: { $ifNull: ['$orderStatus', 'Unknown'] },
            count: { $sum: 1 },
            revenue: { $sum: '$codCollectedBySupplier' },
            netProfit: { $sum: '$netProfit' },
          },
        },
        { $sort: { count: -1 } },
      ]),
      this.orderModel
        .find(
          { isActive: { $ne: false }, ...dateMatch },
          {
            customerName: 1,
            orderStatus: 1,
            productionStatus: 1,
            adGroupId: 1,
            netProfit: 1,
            orderDate: 1,
            createdAt: 1,
          },
        )
        .sort({ orderDate: -1, createdAt: -1 })
        .limit(10)
        .lean(),
      this.orderModel.aggregate([
        {
          $match: {
            isActive: { $ne: false },
            $or: [{ supplierPaymentStatus: 'pending' }, { agentPaymentStatus: 'pending' }],
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            supplierPending: {
              $sum: { $cond: [{ $eq: ['$supplierPaymentStatus', 'pending'] }, 1, 0] },
            },
            agentPending: {
              $sum: { $cond: [{ $eq: ['$agentPaymentStatus', 'pending'] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    return {
      totalInWindow,
      byStatus,
      recentOrders,
      pendingPayments: pendingPayments[0] || {
        count: 0,
        supplierPending: 0,
        agentPending: 0,
      },
    };
  }

  private async buildReturnSnapshot(startDate: Date, endDate: Date) {
    const dateMatch = this.dateRangeMatch(startDate, endDate);
    const returnMatch = {
      isActive: { $ne: false },
      ...dateMatch,
      orderStatus: { $regex: 'hoan|return', $options: 'i' },
    };
    const [summary, byAdGroup, byProduct, requestsByStatus, recentRequests] = await Promise.all([
      this.orderModel.aggregate([
        { $match: returnMatch },
        {
          $group: {
            _id: null,
            returnOrders: { $sum: 1 },
            returnQty: { $sum: { $ifNull: ['$quantity', 0] } },
            returnRevenue: { $sum: { $ifNull: ['$paidToCompanyAmount', 0] } },
            returnCost: { $sum: { $ifNull: ['$productCostTotal', 0] } },
            returnCod: { $sum: { $ifNull: ['$codAmount', 0] } },
          },
        },
      ]),
      this.orderModel.aggregate([
        { $match: returnMatch },
        {
          $group: {
            _id: { $ifNull: ['$adGroupId', 'unknown'] },
            returnOrders: { $sum: 1 },
            returnQty: { $sum: { $ifNull: ['$quantity', 0] } },
            returnRevenue: { $sum: { $ifNull: ['$paidToCompanyAmount', 0] } },
          },
        },
        { $sort: { returnOrders: -1 } },
        { $limit: 10 },
      ]),
      this.orderModel.aggregate([
        { $match: returnMatch },
        {
          $group: {
            _id: '$productId',
            returnOrders: { $sum: 1 },
            returnQty: { $sum: { $ifNull: ['$quantity', 0] } },
            returnRevenue: { $sum: { $ifNull: ['$paidToCompanyAmount', 0] } },
          },
        },
        { $sort: { returnOrders: -1 } },
        { $limit: 10 },
      ]),
      this.orderModel.db.collection('returnrequests').aggregate([
        { $group: { _id: { $ifNull: ['$status', 'unknown'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).toArray(),
      this.orderModel.db
        .collection('returnrequests')
        .find({}, { projection: { orderId: 1, supplierId: 1, status: 1, reason: 1, createdAt: 1, resolvedAt: 1 } })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray(),
    ]);

    return {
      from: startDate,
      to: endDate,
      summary: summary[0] || { returnOrders: 0, returnQty: 0, returnRevenue: 0, returnCost: 0, returnCod: 0 },
      byAdGroup,
      byProduct: byProduct.map((item: any) => ({
        ...item,
        _id: item._id ? String(item._id) : 'unknown',
      })),
      requestsByStatus,
      recentRequests: recentRequests.map((item: any) => ({
        _id: String(item._id),
        orderId: item.orderId ? String(item.orderId) : null,
        supplierId: item.supplierId ? String(item.supplierId) : null,
        status: item.status || null,
        reason: this.trimText(item.reason, 180),
        createdAt: item.createdAt,
        resolvedAt: item.resolvedAt || null,
      })),
    };
  }

  private async buildReceivablesSnapshot(now: Date) {
    const [supplierOpen, supplierOverdue, agentOpen, agentOverdue] = await Promise.all([
      this.supplierPayableModel.aggregate([
        { $match: { status: { $in: ['unpaid', 'partial'] } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            balance: { $sum: '$balance' },
            totalAmount: { $sum: '$totalAmount' },
            amountPaid: { $sum: '$amountPaid' },
          },
        },
      ]),
      this.supplierPayableModel
        .find(
          { status: { $in: ['unpaid', 'partial'] }, dueDate: { $lt: now }, balance: { $gt: 0 } },
          { supplierNameSnap: 1, status: 1, balance: 1, dueDate: 1, totalAmount: 1 },
        )
        .sort({ dueDate: 1 })
        .limit(10)
        .lean(),
      this.agentStatementModel.aggregate([
        { $match: { status: 'open', closingBalance: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            closingBalance: { $sum: '$closingBalance' },
            periodReceivables: { $sum: '$periodReceivables' },
            paid: { $sum: '$statementPaymentTotal' },
          },
        },
      ]),
      this.agentStatementModel
        .find(
          { status: 'open', periodTo: { $lt: now }, closingBalance: { $gt: 0 } },
          { agentId: 1, periodFrom: 1, periodTo: 1, closingBalance: 1, periodReceivables: 1 },
        )
        .sort({ periodTo: 1 })
        .limit(10)
        .lean(),
    ]);

    return {
      supplier: {
        open: supplierOpen[0] || { count: 0, balance: 0, totalAmount: 0, amountPaid: 0 },
        overdue: supplierOverdue,
      },
      agent: {
        open: agentOpen[0] || { count: 0, closingBalance: 0, periodReceivables: 0, paid: 0 },
        overdue: agentOverdue,
      },
    };
  }

  private async buildProductSalesSnapshot() {
    const [totalProducts, missingMedia, missingSupplierPrice, recentProducts] = await Promise.all([
      this.productModel.countDocuments({}),
      this.productModel.countDocuments({ $or: [{ images: { $exists: false } }, { images: { $size: 0 } }] }),
      this.productModel.countDocuments({
        $or: [
          { suppliers: { $exists: false } },
          { suppliers: { $size: 0 } },
          { 'suppliers.appliedPrice': { $lte: 0 } },
        ],
      }),
      this.productModel
        .find(
          {},
          {
            name: 1,
            sku: 1,
            status: 1,
            totalCost: 1,
            importPrice: 1,
            shippingCost: 1,
            packagingCost: 1,
            images: 1,
            suppliers: 1,
            fanpageVariations: 1,
            updatedAt: 1,
          },
        )
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(12)
        .lean(),
    ]);

    return {
      totalProducts,
      missingMedia,
      missingSupplierPrice,
      recentProducts: recentProducts.map((product: any) => ({
        _id: String(product._id),
        name: product.name,
        sku: product.sku,
        status: product.status,
        totalCost: product.totalCost,
        imageCount: Array.isArray(product.images) ? product.images.length : 0,
        supplierCount: Array.isArray(product.suppliers) ? product.suppliers.length : 0,
        fanpageVariationCount: Array.isArray(product.fanpageVariations) ? product.fanpageVariations.length : 0,
        updatedAt: product.updatedAt,
      })),
    };
  }

  private buildBusinessFactPeriod(days: number, now: Date) {
    const safeDays = Math.max(1, Math.round(Number(days) || 1));
    const to = new Date(now);
    to.setHours(23, 59, 59, 999);
    const from = new Date(to.getTime() - (safeDays - 1) * DAY_MS);
    from.setHours(0, 0, 0, 0);
    return {
      from,
      to,
      days: safeDays,
      fromDate: this.dateOnly(from),
      toDate: this.dateOnly(to),
    };
  }

  private buildBusinessFactMonthToDatePeriod(now: Date) {
    const to = new Date(now);
    to.setHours(23, 59, 59, 999);
    const from = new Date(to);
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
    return {
      from,
      to,
      days: Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1),
      fromDate: this.dateOnly(from),
      toDate: this.dateOnly(to),
    };
  }

  private async buildBusinessFactsSnapshot(windowDays: number, now: Date) {
    const currentPeriod = this.buildBusinessFactPeriod(windowDays, now);
    const todayPeriod = this.buildBusinessFactPeriod(1, now);
    const yesterdayPeriod = this.buildBusinessFactPeriod(1, new Date(now.getTime() - DAY_MS));
    const weekPeriod = this.buildBusinessFactPeriod(7, now);
    const monthPeriod = this.buildBusinessFactPeriod(30, now);
    const monthToDatePeriod = this.buildBusinessFactMonthToDatePeriod(now);

    const [
      products,
      currentProductProfit,
      todayProductProfit,
      yesterdayProductProfit,
      weekProductProfit,
      monthProductProfit,
      monthToDateProductProfit,
      fanpages,
      currentAgents,
      currentAdsProducts,
    ] = await Promise.all([
      this.buildProductCatalogFacts(),
      this.buildProductProfitRows(currentPeriod.from, currentPeriod.to),
      this.buildProductProfitRows(todayPeriod.from, todayPeriod.to),
      this.buildProductProfitRows(yesterdayPeriod.from, yesterdayPeriod.to),
      this.buildProductProfitRows(weekPeriod.from, weekPeriod.to),
      this.buildProductProfitRows(monthPeriod.from, monthPeriod.to),
      this.buildProductProfitRows(monthToDatePeriod.from, monthToDatePeriod.to),
      this.buildFanpagePerformanceRows(currentPeriod.from, currentPeriod.to),
      this.buildAgentPerformanceRows(currentPeriod.from, currentPeriod.to),
      this.buildAdsProductPerformanceRows(currentPeriod.from, currentPeriod.to),
    ]);

    return {
      generatedAt: now.toISOString(),
      windowDays,
      currentPeriod,
      todayPeriod,
      yesterdayPeriod,
      weekPeriod,
      monthPeriod,
      monthToDatePeriod,
      products,
      productProfit: {
        current: currentProductProfit,
        today: todayProductProfit,
        yesterday: yesterdayProductProfit,
        week: weekProductProfit,
        month: monthProductProfit,
        monthToDate: monthToDateProductProfit,
      },
      fanpages,
      agents: {
        current: currentAgents,
      },
      adsProducts: {
        current: currentAdsProducts,
      },
    };
  }

  private async buildProductCatalogFacts() {
    const [total, byStatusRows, missingMedia, missingSupplierPrice, products] = await Promise.all([
      this.productModel.countDocuments({}),
      this.productModel.aggregate([
        { $group: { _id: { $ifNull: ['$status', 'unknown'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.productModel.countDocuments({ $or: [{ images: { $exists: false } }, { images: { $size: 0 } }] }),
      this.productModel.countDocuments({
        $or: [
          { suppliers: { $exists: false } },
          { suppliers: { $size: 0 } },
          { 'suppliers.appliedPrice': { $lte: 0 } },
        ],
      }),
      this.productModel
        .find(
          {},
          {
            name: 1,
            sku: 1,
            status: 1,
            totalCost: 1,
            images: 1,
            suppliers: 1,
            updatedAt: 1,
          },
        )
        .sort({ name: 1, sku: 1 })
        .limit(200)
        .lean(),
    ]);
    const byStatus = this.asArray(byStatusRows).map((item: any) => ({
      status: item._id || 'unknown',
      count: item.count || 0,
    }));
    const active = byStatus
      .filter((item) => this.removeVietnameseTone(item.status).toLowerCase() === 'active')
      .reduce((sum, item) => sum + item.count, 0);

    return {
      total,
      active,
      byStatus,
      missingMedia,
      missingSupplierPrice,
      listLimit: 200,
      truncated: total > 200,
      list: products.map((product: any) => ({
        productId: String(product._id),
        name: product.name || product.sku || String(product._id),
        sku: product.sku || null,
        status: product.status || null,
        totalCost: product.totalCost || 0,
        imageCount: Array.isArray(product.images) ? product.images.length : 0,
        supplierCount: Array.isArray(product.suppliers) ? product.suppliers.length : 0,
        updatedAt: product.updatedAt || null,
      })),
    };
  }

  private completedOrderMatch(startDate: Date, endDate: Date, extra: any = {}) {
    return {
      isActive: { $ne: false },
      orderStatus: { $in: Array.from(COMPLETED_ORDER_STATUSES) },
      ...this.dateRangeMatch(startDate, endDate),
      ...extra,
    };
  }

  private revenueExpression() {
    return {
      $add: [
        { $ifNull: ['$codAmount', 0] },
        { $ifNull: ['$depositAmount', 0] },
        { $ifNull: ['$manualPayment', 0] },
      ],
    };
  }

  private quantityExpression() {
    return { $ifNull: ['$quantity', 1] };
  }

  private agentCommissionExpression() {
    return {
      $ifNull: [
        '$agentCommissionFinal',
        {
          $ifNull: [
            '$agentCommissionAmount',
            { $multiply: [{ $ifNull: ['$agentQuote', 0] }, this.quantityExpression()] },
          ],
        },
      ],
    };
  }

  private async buildProductProfitRows(startDate: Date, endDate: Date, adAttributedOnly = false) {
    const match: any = this.completedOrderMatch(startDate, endDate);
    if (adAttributedOnly) {
      match.adGroupId = { $exists: true, $nin: [null, ''] };
    }

    const rows = await this.orderModel.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $addFields: { productInfo: { $first: '$product' } } },
      {
        $group: {
          _id: '$productId',
          productName: { $first: { $ifNull: ['$productInfo.name', 'Khong xac dinh'] } },
          productSku: { $first: { $ifNull: ['$productInfo.sku', null] } },
          totalOrders: { $sum: 1 },
          totalQuantity: { $sum: this.quantityExpression() },
          totalRevenue: { $sum: this.revenueExpression() },
          totalProductCost: {
            $sum: {
              $multiply: [
                { $ifNull: ['$supplierAppliedPrice', 0] },
                this.quantityExpression(),
              ],
            },
          },
          totalAdvertisingCost: { $sum: { $ifNull: ['$advertisingCost', 0] } },
          totalLaborCost: { $sum: { $ifNull: ['$laborCostAllocation', 0] } },
          totalOtherCost: { $sum: { $ifNull: ['$otherCostAllocation', 0] } },
          totalAgentCommission: { $sum: this.agentCommissionExpression() },
          grossProfit: { $sum: { $ifNull: ['$grossProfit', 0] } },
          netProfit: { $sum: { $ifNull: ['$netProfit', 0] } },
        },
      },
    ]);

    const products = this.asArray(rows)
      .map((row: any) => {
        const totalOrders = Number(row.totalOrders || 0);
        const totalRevenue = Number(row.totalRevenue || 0);
        const netProfit = Number(row.netProfit || 0);
        return {
          productId: row._id ? String(row._id) : 'unknown',
          productName: row.productName || 'Khong xac dinh',
          productSku: row.productSku || null,
          totalOrders,
          totalQuantity: Number(row.totalQuantity || 0),
          totalRevenue,
          totalProductCost: Number(row.totalProductCost || 0),
          totalAdvertisingCost: Number(row.totalAdvertisingCost || 0),
          totalLaborCost: Number(row.totalLaborCost || 0),
          totalOtherCost: Number(row.totalOtherCost || 0),
          totalAgentCommission: Number(row.totalAgentCommission || 0),
          grossProfit: Number(row.grossProfit || 0),
          netProfit,
          averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
          averageProfitPerOrder: totalOrders > 0 ? netProfit / totalOrders : 0,
          profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
        };
      })
      .sort((a: any, b: any) => (b.netProfit || 0) - (a.netProfit || 0));

    return {
      dateRange: {
        from: this.dateOnly(startDate),
        to: this.dateOnly(endDate),
      },
      totals: {
        totalProducts: products.length,
        totalOrders: products.reduce((sum: number, item: any) => sum + item.totalOrders, 0),
        totalQuantity: products.reduce((sum: number, item: any) => sum + item.totalQuantity, 0),
        totalRevenue: products.reduce((sum: number, item: any) => sum + item.totalRevenue, 0),
        totalProductCost: products.reduce((sum: number, item: any) => sum + item.totalProductCost, 0),
        totalAdvertisingCost: products.reduce((sum: number, item: any) => sum + item.totalAdvertisingCost, 0),
        totalLaborCost: products.reduce((sum: number, item: any) => sum + item.totalLaborCost, 0),
        totalOtherCost: products.reduce((sum: number, item: any) => sum + item.totalOtherCost, 0),
        totalAgentCommission: products.reduce((sum: number, item: any) => sum + item.totalAgentCommission, 0),
        grossProfit: products.reduce((sum: number, item: any) => sum + item.grossProfit, 0),
        netProfit: products.reduce((sum: number, item: any) => sum + item.netProfit, 0),
      },
      products,
    };
  }

  private async buildAgentPerformanceRows(startDate: Date, endDate: Date) {
    const rows = await this.orderModel.aggregate([
      { $match: this.completedOrderMatch(startDate, endDate) },
      {
        $group: {
          _id: '$agentId',
          totalOrders: { $sum: 1 },
          totalQuantity: { $sum: this.quantityExpression() },
          totalRevenue: { $sum: this.revenueExpression() },
          grossProfit: { $sum: { $ifNull: ['$grossProfit', 0] } },
          netProfit: { $sum: { $ifNull: ['$netProfit', 0] } },
          totalAgentCommission: { $sum: this.agentCommissionExpression() },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'agent',
        },
      },
      { $addFields: { agentInfo: { $first: '$agent' } } },
      { $sort: { totalRevenue: -1 } },
      { $limit: 50 },
    ]);

    const agents = this.asArray(rows).map((row: any) => {
      const agent = row.agentInfo || {};
      const totalRevenue = Number(row.totalRevenue || 0);
      const netProfit = Number(row.netProfit || 0);
      const totalOrders = Number(row.totalOrders || 0);
      return {
        agentId: row._id ? String(row._id) : null,
        agentName: agent.fullName || agent.name || agent.username || agent.email || (row._id ? String(row._id) : 'Khong co dai ly'),
        totalOrders,
        totalQuantity: Number(row.totalQuantity || 0),
        totalRevenue,
        grossProfit: Number(row.grossProfit || 0),
        netProfit,
        totalAgentCommission: Number(row.totalAgentCommission || 0),
        averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
      };
    });

    return {
      dateRange: {
        from: this.dateOnly(startDate),
        to: this.dateOnly(endDate),
      },
      totals: {
        totalAgents: agents.length,
        totalOrders: agents.reduce((sum: number, item: any) => sum + item.totalOrders, 0),
        totalRevenue: agents.reduce((sum: number, item: any) => sum + item.totalRevenue, 0),
        netProfit: agents.reduce((sum: number, item: any) => sum + item.netProfit, 0),
      },
      agents,
    };
  }

  private async buildFanpagePerformanceRows(startDate: Date, endDate: Date) {
    const dateMatch = {
      $or: [
        { lastMessageAt: { $gte: startDate, $lte: endDate } },
        { lastMessageAt: { $exists: false }, createdAt: { $gte: startDate, $lte: endDate } },
        { lastMessageAt: null, createdAt: { $gte: startDate, $lte: endDate } },
      ],
    };
    const pendingDateMatch = {
      $or: [
        { capturedAt: { $gte: startDate, $lte: endDate } },
        { capturedAt: { $exists: false }, createdAt: { $gte: startDate, $lte: endDate } },
        { capturedAt: null, createdAt: { $gte: startDate, $lte: endDate } },
      ],
    };

    const [fanpages, conversations, pendingOrders, adGroups, orderRows, spendRows] = await Promise.all([
      this.fanpageModel
        .find(
          {},
          {
            pageId: 1,
            name: 1,
            status: 1,
            aiEnabled: 1,
            subscribedWebhook: 1,
            sentThisMonth: 1,
            messageQuota: 1,
            lastRefreshAt: 1,
          },
        )
        .lean(),
      this.conversationModel.aggregate([
        { $match: { archived: { $ne: true }, ...dateMatch } },
        {
          $group: {
            _id: '$fanpageId',
            conversations: { $sum: 1 },
            totalMessages: { $sum: { $ifNull: ['$totalMessages', 0] } },
            inboundCount: { $sum: { $ifNull: ['$inboundCount', 0] } },
            outboundCount: { $sum: { $ifNull: ['$outboundCount', 0] } },
            awaitingCount: { $sum: { $ifNull: ['$awaitingCount', 0] } },
            needsHuman: { $sum: { $cond: ['$needsHuman', 1, 0] } },
            autoAiConversations: { $sum: { $cond: [{ $ne: ['$autoAiEnabled', false] }, 1, 0] } },
          },
        },
      ]),
      this.pendingOrderModel.aggregate([
        { $match: pendingDateMatch },
        {
          $group: {
            _id: '$fanpageId',
            pendingOrders: { $sum: 1 },
            awaitingOrders: { $sum: { $cond: [{ $in: ['$status', ['draft', 'awaiting']] }, 1, 0] } },
          },
        },
      ]),
      this.adGroupModel.aggregate([
        {
          $group: {
            _id: '$fanpageId',
            adGroups: { $sum: 1 },
            activeAdGroups: { $sum: { $cond: ['$isActive', 1, 0] } },
          },
        },
      ]),
      this.orderModel.aggregate([
        { $match: this.completedOrderMatch(startDate, endDate, { adGroupId: { $exists: true, $nin: [null, ''] } }) },
        {
          $lookup: {
            from: 'adgroups',
            localField: 'adGroupId',
            foreignField: 'adGroupId',
            as: 'adGroup',
          },
        },
        { $unwind: { path: '$adGroup', preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: '$adGroup.fanpageId',
            orders: { $sum: 1 },
            revenue: { $sum: this.revenueExpression() },
            netProfit: { $sum: { $ifNull: ['$netProfit', 0] } },
          },
        },
      ]),
      this.orderModel.db.collection('advertisingcosts').aggregate([
        { $match: { date: { $gte: startDate, $lte: endDate } } },
        {
          $lookup: {
            from: 'adgroups',
            localField: 'adGroupId',
            foreignField: 'adGroupId',
            as: 'adGroup',
          },
        },
        { $unwind: { path: '$adGroup', preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: '$adGroup.fanpageId',
            adsSpend: { $sum: { $ifNull: ['$spentAmount', 0] } },
            impressions: { $sum: { $ifNull: ['$impressions', 0] } },
            clicks: { $sum: { $ifNull: ['$clicks', 0] } },
            messages: { $sum: { $ifNull: ['$messagingConversationStarted7d', 0] } },
          },
        },
      ]).toArray(),
    ]);

    const toMap = (items: any[]) => new Map(this.asArray(items).map((item: any) => [item._id ? String(item._id) : 'unknown', item]));
    const conversationMap = toMap(conversations);
    const pendingMap = toMap(pendingOrders);
    const adGroupMap = toMap(adGroups);
    const orderMap = toMap(orderRows);
    const spendMap = toMap(spendRows);

    const rows = this.asArray(fanpages).map((fanpage: any) => {
      const id = fanpage._id ? String(fanpage._id) : 'unknown';
      const c = conversationMap.get(id) || {};
      const p = pendingMap.get(id) || {};
      const g = adGroupMap.get(id) || {};
      const o = orderMap.get(id) || {};
      const s = spendMap.get(id) || {};
      const revenue = Number(o.revenue || 0);
      const netProfit = Number(o.netProfit || 0);
      const conversationsCount = Number(c.conversations || 0);
      const activeAdGroups = Number(g.activeAdGroups || 0);
      const needsHuman = Number(c.needsHuman || 0);
      const awaitingOrders = Number(p.awaitingOrders || 0);
      const aiEnabled = fanpage.aiEnabled === true;
      const subscribedWebhook = fanpage.subscribedWebhook === true;
      const active = String(fanpage.status || '').toLowerCase() === 'active';
      const performanceScore =
        revenue / 100000 +
        netProfit / 100000 +
        conversationsCount * 2 +
        Number(o.orders || 0) * 5 +
        activeAdGroups * 3 +
        (active ? 10 : 0) +
        (aiEnabled ? 4 : 0) +
        (subscribedWebhook ? 4 : 0) -
        needsHuman * 4 -
        awaitingOrders;
      const chatbotScore =
        (aiEnabled ? 20 : 0) +
        (subscribedWebhook ? 10 : 0) +
        Number(c.autoAiConversations || 0) * 4 +
        conversationsCount * 2 +
        Number(c.outboundCount || 0) * 0.3 +
        Number(c.inboundCount || 0) * 0.2 -
        needsHuman * 5 -
        awaitingOrders;

      return {
        fanpageId: id,
        pageId: fanpage.pageId || null,
        name: fanpage.name || fanpage.pageId || id,
        status: fanpage.status || null,
        active,
        aiEnabled,
        subscribedWebhook,
        sentThisMonth: Number(fanpage.sentThisMonth || 0),
        messageQuota: Number(fanpage.messageQuota || 0),
        conversations: conversationsCount,
        totalMessages: Number(c.totalMessages || 0),
        inboundCount: Number(c.inboundCount || 0),
        outboundCount: Number(c.outboundCount || 0),
        awaitingCount: Number(c.awaitingCount || 0),
        needsHuman,
        autoAiConversations: Number(c.autoAiConversations || 0),
        pendingOrders: Number(p.pendingOrders || 0),
        awaitingOrders,
        adGroups: Number(g.adGroups || 0),
        activeAdGroups,
        orders: Number(o.orders || 0),
        revenue,
        netProfit,
        adsSpend: Number(s.adsSpend || 0),
        impressions: Number(s.impressions || 0),
        clicks: Number(s.clicks || 0),
        messages: Number(s.messages || 0),
        performanceScore,
        chatbotScore,
      };
    });

    return {
      dateRange: {
        from: this.dateOnly(startDate),
        to: this.dateOnly(endDate),
      },
      total: rows.length,
      active: rows.filter((row: any) => row.active).length,
      aiEnabled: rows.filter((row: any) => row.aiEnabled).length,
      webhookSubscribed: rows.filter((row: any) => row.subscribedWebhook).length,
      topFanpages: [...rows].sort((a: any, b: any) => b.performanceScore - a.performanceScore).slice(0, 20),
      topChatbotFanpages: [...rows].sort((a: any, b: any) => b.chatbotScore - a.chatbotScore).slice(0, 20),
    };
  }

  private async buildAdsProductPerformanceRows(startDate: Date, endDate: Date) {
    const [allProfit, adAttributedProfit, spendRows, products] = await Promise.all([
      this.buildProductProfitRows(startDate, endDate),
      this.buildProductProfitRows(startDate, endDate, true),
      this.orderModel.db.collection('advertisingcosts').aggregate([
        { $match: { date: { $gte: startDate, $lte: endDate } } },
        {
          $lookup: {
            from: 'adgroups',
            localField: 'adGroupId',
            foreignField: 'adGroupId',
            as: 'adGroup',
          },
        },
        { $unwind: { path: '$adGroup', preserveNullAndEmptyArrays: false } },
        { $addFields: { productId: { $first: '$adGroup.selectedProducts' } } },
        {
          $group: {
            _id: '$productId',
            adsSpend: { $sum: { $ifNull: ['$spentAmount', 0] } },
            impressions: { $sum: { $ifNull: ['$impressions', 0] } },
            clicks: { $sum: { $ifNull: ['$clicks', 0] } },
            messages: { $sum: { $ifNull: ['$messagingConversationStarted7d', 0] } },
            adGroupIds: { $addToSet: '$adGroup.adGroupId' },
          },
        },
      ]).toArray(),
      this.productModel.find({}, { name: 1, sku: 1 }).lean(),
    ]);

    const productNameMap = new Map(this.asArray(products).map((product: any) => [
      product._id ? String(product._id) : 'unknown',
      {
        name: product.name || product.sku || String(product._id),
        sku: product.sku || null,
      },
    ]));
    const allProfitMap = new Map(this.asArray(allProfit.products).map((row: any) => [row.productId, row]));
    const adProfitMap = new Map(this.asArray(adAttributedProfit.products).map((row: any) => [row.productId, row]));
    const spendMap = new Map(this.asArray(spendRows).map((row: any) => [row._id ? String(row._id) : 'unknown', row]));
    const productIds = Array.from(new Set([
      ...Array.from(allProfitMap.keys()),
      ...Array.from(adProfitMap.keys()),
      ...Array.from(spendMap.keys()),
    ]));

    const rows = productIds.map((productId) => {
      const product: any = productNameMap.get(productId) || {};
      const all = allProfitMap.get(productId) || {};
      const adProfit = adProfitMap.get(productId) || {};
      const spend = spendMap.get(productId) || {};
      const adsSpend = Number(spend.adsSpend || 0);
      const totalRevenue = Number(all.totalRevenue || 0);
      const adAttributedRevenue = Number(adProfit.totalRevenue || 0);
      const totalNetProfit = Number(all.netProfit || 0);
      const adAttributedNetProfit = Number(adProfit.netProfit || 0);
      const netProfitAfterAds = adAttributedNetProfit - adsSpend;
      return {
        productId,
        productName: adProfit.productName || all.productName || product.name || productId,
        productSku: adProfit.productSku || all.productSku || product.sku || null,
        totalOrders: Number(all.totalOrders || 0),
        adAttributedOrders: Number(adProfit.totalOrders || 0),
        totalRevenue,
        adAttributedRevenue,
        totalNetProfit,
        adAttributedNetProfit,
        adsSpend,
        netProfitAfterAds,
        adsRevenueRatio: totalRevenue > 0 ? (adsSpend / totalRevenue) * 100 : null,
        adAttributedAdsRevenueRatio: adAttributedRevenue > 0 ? (adsSpend / adAttributedRevenue) * 100 : null,
        impressions: Number(spend.impressions || 0),
        clicks: Number(spend.clicks || 0),
        messages: Number(spend.messages || 0),
        adGroupCount: this.asArray(spend.adGroupIds).length,
        profitMarginAfterAds: adAttributedRevenue > 0 ? (netProfitAfterAds / adAttributedRevenue) * 100 : null,
      };
    });

    return {
      dateRange: {
        from: this.dateOnly(startDate),
        to: this.dateOnly(endDate),
      },
      totals: {
        products: rows.length,
        adsSpend: rows.reduce((sum: number, item: any) => sum + item.adsSpend, 0),
        totalRevenue: rows.reduce((sum: number, item: any) => sum + item.totalRevenue, 0),
        adAttributedRevenue: rows.reduce((sum: number, item: any) => sum + item.adAttributedRevenue, 0),
        netProfitAfterAds: rows.reduce((sum: number, item: any) => sum + item.netProfitAfterAds, 0),
      },
      products: rows.sort((a: any, b: any) => b.netProfitAfterAds - a.netProfitAfterAds),
    };
  }

  private async buildCustomerSnapshot() {
    const [totalCustomers, activeCustomers, expiringSoon, recentCustomers] = await Promise.all([
      this.customerModel.countDocuments({}),
      this.customerModel.countDocuments({ isDisabled: { $ne: true } }),
      this.customerModel.countDocuments({ isDisabled: { $ne: true }, remainingDays: { $gte: 0, $lte: 10 } }),
      this.customerModel
        .find(
          {},
          {
            customerName: 1,
            phoneNumber: 1,
            productId: 1,
            latestPurchaseDate: 1,
            remainingDays: 1,
            isDisabled: 1,
          },
        )
        .sort({ latestPurchaseDate: -1, updatedAt: -1 })
        .limit(12)
        .lean(),
    ]);

    return {
      totalCustomers,
      activeCustomers,
      expiringSoon,
      recentCustomers: recentCustomers.map((customer: any) => ({
        _id: String(customer._id),
        customerName: customer.customerName,
        phoneMasked: this.maskPhone(customer.phoneNumber),
        productId: customer.productId ? String(customer.productId) : null,
        latestPurchaseDate: customer.latestPurchaseDate,
        remainingDays: customer.remainingDays,
        isDisabled: !!customer.isDisabled,
      })),
    };
  }

  private async buildPendingOrderSnapshot() {
    const [byStatus, recentPending] = await Promise.all([
      this.pendingOrderModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.pendingOrderModel
        .find(
          { status: { $in: ['draft', 'awaiting'] } },
          {
            fanpageId: 1,
            productId: 1,
            agentId: 1,
            supplierId: 1,
            adGroupId: 1,
            customerName: 1,
            phone: 1,
            quantity: 1,
            status: 1,
            capturedAt: 1,
            createdAt: 1,
          },
        )
        .sort({ capturedAt: -1, createdAt: -1 })
        .limit(12)
        .lean(),
    ]);

    return {
      byStatus,
      recentPending: recentPending.map((order: any) => ({
        _id: String(order._id),
        status: order.status,
        customerName: order.customerName,
        phoneMasked: this.maskPhone(order.phone),
        productId: order.productId ? String(order.productId) : null,
        agentId: order.agentId ? String(order.agentId) : null,
        supplierId: order.supplierId ? String(order.supplierId) : null,
        adGroupId: order.adGroupId || null,
        quantity: order.quantity || 1,
        capturedAt: order.capturedAt || order.createdAt,
      })),
    };
  }

  private async buildConversationSnapshot() {
    const [needsHuman, awaitingOrder, recentConversations] = await Promise.all([
      this.conversationModel.countDocuments({ needsHuman: true, archived: { $ne: true } }),
      this.conversationModel.countDocuments({ orderDraftStatus: { $in: ['draft', 'awaiting'] }, archived: { $ne: true } }),
      this.conversationModel
        .find(
          { archived: { $ne: true } },
          {
            fanpageId: 1,
            totalMessages: 1,
            inboundCount: 1,
            outboundCount: 1,
            awaitingCount: 1,
            lastMessageSnippet: 1,
            lastDirection: 1,
            lastMessageAt: 1,
            lastAdGroupId: 1,
            needsHuman: 1,
            autoAiEnabled: 1,
            orderDraftStatus: 1,
            orderCustomerName: 1,
            orderPhone: 1,
          },
        )
        .sort({ needsHuman: -1, lastMessageAt: -1 })
        .limit(12)
        .lean(),
    ]);

    return {
      needsHuman,
      awaitingOrder,
      recentConversations: recentConversations.map((conversation: any) => ({
        _id: String(conversation._id),
        fanpageId: conversation.fanpageId ? String(conversation.fanpageId) : null,
        totalMessages: conversation.totalMessages || 0,
        awaitingCount: conversation.awaitingCount || 0,
        lastMessageSnippet: this.trimText(conversation.lastMessageSnippet, 180),
        lastDirection: conversation.lastDirection || null,
        lastMessageAt: conversation.lastMessageAt,
        lastAdGroupId: conversation.lastAdGroupId || null,
        needsHuman: !!conversation.needsHuman,
        autoAiEnabled: conversation.autoAiEnabled !== false,
        orderDraftStatus: conversation.orderDraftStatus || 'none',
        orderCustomerName: conversation.orderCustomerName || null,
        orderPhoneMasked: this.maskPhone(conversation.orderPhone),
      })),
    };
  }

  private async buildMediaSnapshot() {
    const [totalMedia, bySourceType, unlinkedMedia, recentMedia] = await Promise.all([
      this.mediaModel.countDocuments({}),
      this.mediaModel.aggregate([
        { $group: { _id: { $ifNull: ['$sourceType', 'gallery'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.mediaModel.countDocuments({ productId: { $exists: false }, fanpageId: { $exists: false } }),
      this.mediaModel
        .find(
          {},
          {
            url: 1,
            productId: 1,
            fanpageId: 1,
            tags: 1,
            isMainImage: 1,
            sourceType: 1,
            aspectRatio: 1,
            width: 1,
            height: 1,
            createdAt: 1,
          },
        )
        .sort({ createdAt: -1 })
        .limit(12)
        .lean(),
    ]);

    return {
      totalMedia,
      bySourceType,
      unlinkedMedia,
      recentMedia: recentMedia.map((media: any) => ({
        _id: String(media._id),
        productId: media.productId ? String(media.productId) : null,
        fanpageId: media.fanpageId ? String(media.fanpageId) : null,
        tags: media.tags || [],
        isMainImage: !!media.isMainImage,
        sourceType: media.sourceType || 'gallery',
        aspectRatio: media.aspectRatio || null,
        width: media.width || null,
        height: media.height || null,
        createdAt: media.createdAt,
      })),
    };
  }

  private async buildAdGroupSnapshot() {
    const [totalAdGroups, activeAdGroups, missingProductMap, syncErrors, recentAdGroups] = await Promise.all([
      this.adGroupModel.countDocuments({}),
      this.adGroupModel.countDocuments({ isActive: true }),
      this.adGroupModel.countDocuments({ $or: [{ selectedProducts: { $exists: false } }, { selectedProducts: { $size: 0 } }] }),
      this.adGroupModel.countDocuments({ lastSyncStatus: 'error' }),
      this.adGroupModel
        .find(
          {},
          {
            name: 1,
            adGroupId: 1,
            platform: 1,
            isActive: 1,
            selectedProducts: 1,
            fanpageId: 1,
            adAccountId: 1,
            assignedEmployeeId: 1,
            remoteStatus: 1,
            effectiveStatus: 1,
            dailyBudget: 1,
            lastSyncStatus: 1,
            lastSyncError: 1,
            updatedAt: 1,
          },
        )
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(12)
        .lean(),
    ]);

    return {
      totalAdGroups,
      activeAdGroups,
      missingProductMap,
      syncErrors,
      recentAdGroups: recentAdGroups.map((group: any) => ({
        _id: String(group._id),
        name: group.name,
        adGroupId: group.adGroupId,
        platform: group.platform,
        isActive: !!group.isActive,
        productCount: Array.isArray(group.selectedProducts) ? group.selectedProducts.length : 0,
        fanpageId: group.fanpageId ? String(group.fanpageId) : null,
        adAccountId: group.adAccountId ? String(group.adAccountId) : null,
        assignedEmployeeId: group.assignedEmployeeId ? String(group.assignedEmployeeId) : null,
        remoteStatus: group.remoteStatus || null,
        effectiveStatus: group.effectiveStatus || null,
        dailyBudget: group.dailyBudget || null,
        lastSyncStatus: group.lastSyncStatus || null,
        lastSyncError: this.trimText(group.lastSyncError, 180),
      })),
    };
  }

  private async buildAdAccountSnapshot() {
    const [totalAccounts, activeAccounts, syncErrors, byPlatform] = await Promise.all([
      this.adAccountModel.countDocuments({}),
      this.adAccountModel.countDocuments({ isActive: true }),
      this.adAccountModel.countDocuments({ lastSyncStatus: 'error' }),
      this.adAccountModel.aggregate([
        { $group: { _id: '$accountType', count: { $sum: 1 }, active: { $sum: { $cond: ['$isActive', 1, 0] } } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    return {
      totalAccounts,
      activeAccounts,
      syncErrors,
      byPlatform,
    };
  }

  private async buildFanpageSnapshot() {
    const [totalFanpages, activeFanpages, aiEnabledFanpages, webhookSubscribed, recentFanpages] = await Promise.all([
      this.fanpageModel.countDocuments({}),
      this.fanpageModel.countDocuments({ status: 'active' }),
      this.fanpageModel.countDocuments({ aiEnabled: true }),
      this.fanpageModel.countDocuments({ subscribedWebhook: true }),
      this.fanpageModel
        .find(
          {},
          {
            pageId: 1,
            name: 1,
            status: 1,
            aiEnabled: 1,
            subscribedWebhook: 1,
            sentThisMonth: 1,
            messageQuota: 1,
            lastRefreshAt: 1,
            updatedAt: 1,
          },
        )
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(12)
        .lean(),
    ]);

    return {
      totalFanpages,
      activeFanpages,
      aiEnabledFanpages,
      webhookSubscribed,
      recentFanpages: recentFanpages.map((fanpage: any) => ({
        _id: String(fanpage._id),
        pageId: fanpage.pageId,
        name: fanpage.name,
        status: fanpage.status,
        aiEnabled: !!fanpage.aiEnabled,
        subscribedWebhook: !!fanpage.subscribedWebhook,
        sentThisMonth: fanpage.sentThisMonth || 0,
        messageQuota: fanpage.messageQuota || 0,
        lastRefreshAt: fanpage.lastRefreshAt || null,
      })),
    };
  }

  private async buildEmployeeAdsKpiSnapshot(startDate: Date, endDate: Date) {
    if (!this.employeeAdsKpiService) throw new Error('employee ads KPI service is not available');
    const [employees, assignableEmployees] = await Promise.all([
      this.employeeAdsKpiService.getAllEmployeesKpi(startDate, endDate),
      this.employeeAdsKpiService.getAssignableEmployees(),
    ]);
    const rows = this.asArray(employees);
    const alerts = rows.flatMap((employee: any) =>
      this.asArray(employee.alerts).map((alert: any) => ({
        employeeId: employee.employeeId || null,
        employeeName: employee.employeeName || employee.fullName || employee.email || 'unknown',
        type: alert.type || alert.level || 'WARNING',
        message: this.trimText(alert.message || alert.reason || '', 220),
      })),
    );
    const underperformers = rows
      .filter((employee: any) => employee.kpiProfitableRateMet === false || (employee.profitableRate || 0) < (employee.kpiProfitableRateTarget || 0))
      .sort((a: any, b: any) => (a.profitableRate || 0) - (b.profitableRate || 0))
      .slice(0, 8)
      .map((employee: any) => ({
        employeeId: employee.employeeId || null,
        employeeName: employee.employeeName || employee.fullName || employee.email || 'unknown',
        profitableRate: employee.profitableRate || 0,
        target: employee.kpiProfitableRateTarget || null,
        totalSpend: employee.totalSpend || 0,
        totalProfit: employee.totalProfit || 0,
        avgROI: employee.avgROI || 0,
        activeAdGroups: employee.totalAdGroups || employee.activeAdGroups || 0,
      }));
    const topWorkload = [...rows]
      .sort((a: any, b: any) => (b.totalAdGroups || b.activeAdGroups || 0) - (a.totalAdGroups || a.activeAdGroups || 0))
      .slice(0, 8)
      .map((employee: any) => ({
        employeeId: employee.employeeId || null,
        employeeName: employee.employeeName || employee.fullName || employee.email || 'unknown',
        activeAdGroups: employee.totalAdGroups || employee.activeAdGroups || 0,
        profitableRate: employee.profitableRate || 0,
        totalSpend: employee.totalSpend || 0,
        totalProfit: employee.totalProfit || 0,
      }));

    return {
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
      summary: {
        employeeCount: rows.length,
        assignableEmployeeCount: this.asArray(assignableEmployees).length,
        criticalAlerts: alerts.filter((alert: any) => String(alert.type).toUpperCase() === 'CRITICAL').length,
        warningAlerts: alerts.filter((alert: any) => String(alert.type).toUpperCase() !== 'CRITICAL').length,
        underperformerCount: underperformers.length,
        avgProfitableRate: rows.length
          ? rows.reduce((sum: number, employee: any) => sum + (Number(employee.profitableRate) || 0), 0) / rows.length
          : 0,
      },
      alerts: alerts.slice(0, 20),
      underperformers,
      topWorkload,
      assignableEmployees: this.asArray(assignableEmployees).slice(0, 12),
    };
  }

  private async buildApiTokenSnapshot() {
    if (!this.apiTokenService) throw new Error('API token service is not available');
    const [tokens, settings] = await Promise.all([
      this.apiTokenService.findAll({}),
      this.apiTokenService.getAdsSettings(),
    ]);
    const now = Date.now();
    const expiringSoon = this.asArray(tokens).filter((token: any) => {
      if (!token.expireAt) return false;
      const hours = Math.round((new Date(token.expireAt).getTime() - now) / (1000 * 60 * 60));
      return hours >= 0 && hours <= 72;
    });
    const expired = this.asArray(tokens).filter((token: any) => token.expireAt && new Date(token.expireAt).getTime() <= now);
    const failing = this.asArray(tokens).filter((token: any) =>
      token.degraded || ['invalid', 'error', 'failed'].includes(String(token.lastCheckStatus || '').toLowerCase()),
    );
    const byProvider = this.asArray(tokens).reduce((acc: Record<string, number>, token: any) => {
      const provider = token.provider || 'unknown';
      acc[provider] = (acc[provider] || 0) + 1;
      return acc;
    }, {});

    return {
      summary: {
        totalTokens: this.asArray(tokens).length,
        activeTokens: this.asArray(tokens).filter((token: any) => token.status === 'active').length,
        primaryTokens: this.asArray(tokens).filter((token: any) => token.isPrimary).length,
        expiringSoon: expiringSoon.length,
        expired: expired.length,
        failing: failing.length,
        byProvider,
      },
      settings,
      issues: [...failing, ...expired, ...expiringSoon].slice(0, 15).map((token: any) => ({
        _id: String(token._id || token.id || ''),
        name: token.name,
        provider: token.provider,
        status: token.status,
        lastCheckStatus: token.lastCheckStatus || null,
        lastCheckMessage: this.trimText(token.lastCheckMessage, 220),
        expireAt: token.expireAt || null,
        degraded: !!token.degraded,
      })),
      recentTokens: this.asArray(tokens).slice(0, 12).map((token: any) => ({
        _id: String(token._id || token.id || ''),
        name: token.name,
        provider: token.provider,
        status: token.status,
        isPrimary: !!token.isPrimary,
        lastCheckStatus: token.lastCheckStatus || null,
        lastCheckedAt: token.lastCheckedAt || null,
        expireAt: token.expireAt || null,
      })),
    };
  }

  private async buildAdsSyncHealthSnapshot() {
    const sources: Array<[string, any]> = [
      ['facebook', this.facebookSyncService],
      ['google', this.googleSyncService],
      ['tiktok', this.tiktokSyncService],
    ];
    const results = await Promise.all(sources.map(async ([platform, service]) => {
      if (!service) {
        return { platform, ok: false, error: `${platform} sync service is not available` };
      }
      try {
        return { platform, ok: true, data: await service.getSyncHealth() };
      } catch (error: any) {
        return { platform, ok: false, error: error?.message || String(error) };
      }
    }));
    const stale = results
      .filter((item: any) => item.ok && typeof item.data?.sync?.freshnessHours === 'number' && item.data.sync.freshnessHours > 24)
      .map((item: any) => ({
        platform: item.platform,
        freshnessHours: item.data.sync.freshnessHours,
        lastSyncAt: item.data.sync.lastSyncAt || null,
      }));
    const tokenIssues = results
      .filter((item: any) => item.ok && item.data?.token)
      .filter((item: any) => item.data.token.configured === false || item.data.token.isExpired === true || ['invalid', 'error', 'failed'].includes(String(item.data.token.lastCheckStatus || '').toLowerCase()))
      .map((item: any) => ({
        platform: item.platform,
        source: item.data.token.source || null,
        lastCheckStatus: item.data.token.lastCheckStatus || null,
        lastCheckMessage: this.trimText(item.data.token.lastCheckMessage, 220),
        expireAt: item.data.token.expireAt || null,
      }));

    return {
      summary: {
        platforms: results.length,
        okPlatforms: results.filter((item: any) => item.ok).length,
        failedPlatforms: results.filter((item: any) => !item.ok).length,
        stalePlatforms: stale.length,
        tokenIssues: tokenIssues.length,
      },
      platforms: results,
      stale,
      tokenIssues,
    };
  }

  private async buildAdvertisingCostByAdGroupSnapshot(startDate: Date, endDate: Date) {
    const from = this.dateOnly(startDate);
    const to = this.dateOnly(endDate);
    const [dailySummary, topAdGroups] = await Promise.all([
      this.advertisingCostService
        ? this.advertisingCostService.getDailySummary(from, to)
        : Promise.reject(new Error('advertising cost service is not available')),
      this.orderModel.db.collection('advertisingcosts').aggregate([
        { $match: { date: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: '$adGroupId',
            spent: { $sum: '$spentAmount' },
            impressions: { $sum: '$impressions' },
            clicks: { $sum: '$clicks' },
            messages: { $sum: '$messagingConversationStarted7d' },
            records: { $sum: 1 },
            latestDate: { $max: '$date' },
          },
        },
        { $sort: { spent: -1 } },
        { $limit: 12 },
      ]).toArray(),
    ]);

    return {
      from,
      to,
      dailySummary,
      topAdGroups: topAdGroups.map((item: any) => ({
        adGroupId: item._id || null,
        spent: item.spent || 0,
        impressions: item.impressions || 0,
        clicks: item.clicks || 0,
        messages: item.messages || 0,
        records: item.records || 0,
        latestDate: item.latestDate || null,
      })),
    };
  }

  private async buildCostPerOrderSnapshot(startDate: Date, endDate: Date) {
    if (!this.adReportService) throw new Error('ad report service is not available');
    const rows = await this.adReportService.costPerOrderByAdGroup({
      from: this.dateOnly(startDate),
      to: this.dateOnly(endDate),
    });
    const list = this.asArray(rows);
    const withOrders = list.filter((item: any) => (item.ordersCount || 0) > 0 && item.costPerOrder != null);
    const noOrdersWithSpend = list.filter((item: any) => (item.totalSpent || 0) > 0 && !(item.ordersCount || 0));
    const totalSpent = list.reduce((sum: number, item: any) => sum + (Number(item.totalSpent) || 0), 0);
    const totalOrders = list.reduce((sum: number, item: any) => sum + (Number(item.ordersCount) || 0), 0);

    return {
      from: this.dateOnly(startDate),
      to: this.dateOnly(endDate),
      summary: {
        rows: list.length,
        totalSpent,
        totalOrders,
        blendedCostPerOrder: totalOrders > 0 ? totalSpent / totalOrders : null,
        noOrdersWithSpend: noOrdersWithSpend.length,
      },
      worstCostPerOrder: [...withOrders]
        .sort((a: any, b: any) => (b.costPerOrder || 0) - (a.costPerOrder || 0))
        .slice(0, 12),
      noOrdersWithSpend: noOrdersWithSpend
        .sort((a: any, b: any) => (b.totalSpent || 0) - (a.totalSpent || 0))
        .slice(0, 12),
    };
  }

  private async buildMarketingDecisionSnapshot(windowDays: number) {
    if (!this.aiMarketingService) throw new Error('ai marketing service is not available');
    const [overview, funnel, creatives, creativePerformance, plans, evaluations] = await Promise.all([
      this.getAiMarketingOverview(windowDays),
      this.aiMarketingService.getLeadFunnel({ lookbackDays: windowDays } as any),
      this.aiMarketingService.listCreatives({ lookbackDays: windowDays, limit: 20 } as any),
      this.aiMarketingService.getCreativePerformance({ lookbackDays: windowDays, limit: 20 } as any),
      this.getAiMarketingPlans(),
      this.getAiMarketingEvaluations(),
    ]);
    const creativePerformanceAny = creativePerformance as any;
    const creativesAny = creatives as any;

    return {
      overview,
      funnel,
      creativeSummary: creativePerformanceAny?.summary || creativePerformanceAny?.creativeSummary || null,
      creativePerformance: this.asArray(creativePerformanceAny?.items || creativePerformanceAny?.creatives || creativePerformanceAny?.rows).slice(0, 12),
      creatives: this.asArray(creativesAny?.creatives || creativesAny?.items || creativesAny).slice(0, 12),
      plans,
      evaluations,
    };
  }

  private async getFinanceFundsOverview() {
    if (!this.financeFundsService) throw new Error('finance funds service is not available');
    const overview = await this.financeFundsService.computeFundsOverview();
    return {
      calculatedAt: overview.calculatedAt,
      cashFlow: overview.cashFlow,
      formulas: overview.formulas,
      validation: overview.validation,
      committedCash: {
        stock: overview.committedCash?.stock,
        threshold: overview.committedCash?.threshold,
        breakdown: overview.committedCash?.breakdown,
      },
      adsFund: {
        stock: overview.adsFund?.stock,
        threshold: overview.adsFund?.threshold,
        dailyBudget: overview.adsFund?.dailyBudget,
        breakdown: overview.adsFund?.breakdown,
      },
      survivalBuffer: {
        stock: overview.survivalBuffer?.stock,
        threshold: overview.survivalBuffer?.threshold,
        health: overview.survivalBuffer?.health,
        target: overview.survivalBuffer?.target,
      },
      ownerFund: {
        stock: overview.ownerFund?.stock,
        threshold: overview.ownerFund?.threshold,
        withdrawalStats: overview.ownerFund?.withdrawalStats,
        breakdown: overview.ownerFund?.breakdown,
      },
      netProfit: overview.netProfit,
      revenue: overview.revenue,
      seedCapital: overview.seedCapital,
    };
  }

  private async getBudgetAllocationPreview() {
    if (!this.budgetAllocationService) throw new Error('budget allocation service is not available');
    const result = await this.budgetAllocationService.autoAllocateBudget({ dryRun: true });
    return {
      totalAvailable: result.totalAvailable,
      totalAllocated: result.totalAllocated,
      globalStatus: result.globalStatus || null,
      recommendation: result.recommendation || null,
      globalAdjustmentRatio: result.globalAdjustmentRatio || null,
      systemLocked: !!result.systemLocked,
      summary: result.summary,
      horizontalScaling: result.horizontalScaling || null,
      allocations: this.asArray(result.allocations).slice(0, 10).map((item: any) => ({
        adGroupId: item.adGroupId,
        adGroupName: item.adGroupName,
        currentBudget: item.currentBudget,
        action: item.action,
        suggestedBudget: item.suggestedBudget,
        allocatedBudget: item.allocatedBudget,
        roi: item.roi,
        profit: item.profit,
        reason: item.reason || null,
        scaleCapped: !!item.scaleCapped,
        scalePercentage: item.scalePercentage || 0,
      })),
    };
  }

  private async getLoanDashboard() {
    if (!this.loanManagementService) throw new Error('loan management service is not available');
    const dashboard = await this.loanManagementService.getDashboard();
    return {
      availableToDisburse: dashboard.availableToDisburse,
      outstandingWithInterest: dashboard.outstandingWithInterest,
      totalOutstanding: dashboard.totalOutstanding,
      monthlyInterestCost: dashboard.monthlyInterestCost,
      due7Days: dashboard.due7Days,
      due14Days: dashboard.due14Days,
      due30Days: dashboard.due30Days,
      overdueAmount: dashboard.overdueAmount,
      alerts: this.asArray(dashboard.alerts).slice(0, 10),
      optimization: dashboard.optimization || null,
      metadata: dashboard.metadata || null,
      byLoan: this.asArray(dashboard.byLoan).slice(0, 10),
    };
  }

  private async getAiMarketingOverview(windowDays: number) {
    if (!this.aiMarketingService) throw new Error('ai marketing service is not available');
    const overview = await this.aiMarketingService.getOverview({ lookbackDays: windowDays } as any);
    return {
      window: overview.window,
      summary: overview.summary,
      creativeSummary: overview.creativeSummary,
      funnel: overview.funnel,
      planStats: overview.planStats,
      evaluationStats: overview.evaluationStats,
      assistantQuality: overview.assistantQuality,
      readiness: overview.readiness,
    };
  }

  private async getAiMarketingPlans() {
    if (!this.aiMarketingService) throw new Error('ai marketing service is not available');
    const result = await this.aiMarketingService.listPlans({ limit: 10 } as any);
    return {
      total: result.total,
      plans: this.asArray(result.plans).slice(0, 10).map((plan: any) => ({
        _id: String(plan._id),
        title: plan.title,
        status: plan.status,
        generatedAt: plan.generatedAt || plan.createdAt,
        itemCount: Array.isArray(plan.items) ? plan.items.length : 0,
        approvedCount: this.asArray(plan.items).filter((item: any) => item.approvalStatus === 'approved').length,
      })),
    };
  }

  private async getAiMarketingEvaluations() {
    if (!this.aiMarketingService) throw new Error('ai marketing service is not available');
    const result = await this.aiMarketingService.listEvaluations({ limit: 10 } as any);
    return {
      summary: result.summary,
      evaluations: this.asArray(result.evaluations).slice(0, 10).map((item: any) => ({
        _id: String(item._id),
        adGroupId: item.adGroupId,
        status: item.status,
        verdict: item.verdict || null,
        actionType: item.actionType || null,
        evaluatedAt: item.evaluatedAt || item.updatedAt,
      })),
    };
  }

  private async buildAvailableFundSnapshot() {
    const latest = await this.orderModel.db
      .collection('available_fund_snapshots')
      .findOne({}, { sort: { capturedAt: -1, createdAt: -1 } });

    if (!latest) {
      return { hasSnapshot: false, latest: null };
    }

    return {
      hasSnapshot: true,
      latest: {
        capturedAt: latest.capturedAt || latest.createdAt,
        available: latest.available || 0,
        collectedRevenue: latest.collectedRevenue || 0,
        loanAvailable: latest.loanAvailable || 0,
        actualSpent: latest.actualSpent || 0,
        reservedPayroll: latest.reservedPayroll || 0,
        reservedInterest: latest.reservedInterest || 0,
        reservedPayables: latest.reservedPayables || 0,
        reservedSuppliers: latest.reservedSuppliers || 0,
        reservedAgents: latest.reservedAgents || 0,
        reservedOther: latest.reservedOther || 0,
        note: this.trimText(latest.note, 300),
      },
    };
  }

  private async buildOwnerFundSnapshot() {
    const [accounts, withdrawalSummary, recentWithdrawals] = await Promise.all([
      this.orderModel.db
        .collection('owner_fund_accounts')
        .find({ isActive: { $ne: false } }, { projection: { name: 1, balance: 1, totalDeposited: 1, totalWithdrawn: 1, totalReturnedToCompany: 1, updatedAt: 1 } })
        .sort({ updatedAt: -1 })
        .limit(10)
        .toArray(),
      this.orderModel.db.collection('withdrawals').aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            amount: { $sum: '$amount' },
          },
        },
      ]).toArray(),
      this.orderModel.db
        .collection('withdrawals')
        .find(
          {},
          { projection: { ownerId: 1, amount: 1, type: 1, status: 1, requestDate: 1, approvedDate: 1, completedDate: 1, isUrgent: 1, reason: 1 } },
        )
        .sort({ requestDate: -1, createdAt: -1 })
        .limit(10)
        .toArray(),
    ]);
    const totalBalance = accounts.reduce((sum: number, item: any) => sum + (Number(item.balance) || 0), 0);

    return {
      totalBalance,
      accountCount: accounts.length,
      accounts: accounts.map((item: any) => ({
        _id: String(item._id),
        name: item.name,
        balance: item.balance || 0,
        totalDeposited: item.totalDeposited || 0,
        totalWithdrawn: item.totalWithdrawn || 0,
        totalReturnedToCompany: item.totalReturnedToCompany || 0,
        updatedAt: item.updatedAt,
      })),
      withdrawalsByStatus: withdrawalSummary,
      recentWithdrawals: recentWithdrawals.map((item: any) => ({
        _id: String(item._id),
        ownerId: item.ownerId ? String(item.ownerId) : null,
        amount: item.amount || 0,
        type: item.type || null,
        status: item.status || null,
        requestDate: item.requestDate || item.createdAt,
        isUrgent: !!item.isUrgent,
        reason: this.trimText(item.reason, 180),
      })),
    };
  }

  private async buildLaborCashflowSnapshot(now: Date, windowDays: number) {
    const dueTo = new Date(now.getTime() + windowDays * DAY_MS);
    const [summary, overdue, dueSoon] = await Promise.all([
      this.orderModel.db.collection('laborstatements').aggregate([
        { $match: { status: { $in: ['draft', 'open'] }, closingBalance: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            outstanding: { $sum: '$closingBalance' },
            periodCost: { $sum: '$periodCost' },
            paid: { $sum: '$statementPaymentTotal' },
          },
        },
      ]).toArray(),
      this.orderModel.db
        .collection('laborstatements')
        .find(
          { status: { $in: ['draft', 'open'] }, closingBalance: { $gt: 0 }, dueDate: { $lt: now } },
          { projection: { employeeId: 1, status: 1, dueDate: 1, closingBalance: 1, periodFrom: 1, periodTo: 1 } },
        )
        .sort({ dueDate: 1 })
        .limit(10)
        .toArray(),
      this.orderModel.db
        .collection('laborstatements')
        .find(
          { status: { $in: ['draft', 'open'] }, closingBalance: { $gt: 0 }, dueDate: { $gte: now, $lte: dueTo } },
          { projection: { employeeId: 1, status: 1, dueDate: 1, closingBalance: 1, periodFrom: 1, periodTo: 1 } },
        )
        .sort({ dueDate: 1 })
        .limit(10)
        .toArray(),
    ]);

    return {
      windowDays,
      summary: summary[0] || { count: 0, outstanding: 0, periodCost: 0, paid: 0 },
      overdueCount: overdue.length,
      dueSoonCount: dueSoon.length,
      overdue,
      dueSoon,
    };
  }

  private async buildOtherCostCashflowSnapshot(now: Date, windowDays: number) {
    const dueTo = new Date(now.getTime() + windowDays * DAY_MS);
    const [summary, byCategory, overdue, dueSoon] = await Promise.all([
      this.orderModel.db.collection('othercosts').aggregate([
        { $match: { isConfirmed: { $ne: true } } },
        { $group: { _id: null, count: { $sum: 1 }, outstanding: { $sum: '$amount' } } },
      ]).toArray(),
      this.orderModel.db.collection('othercosts').aggregate([
        { $match: { isConfirmed: { $ne: true } } },
        { $group: { _id: { $ifNull: ['$category', 'other'] }, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
        { $sort: { amount: -1 } },
        { $limit: 10 },
      ]).toArray(),
      this.orderModel.db
        .collection('othercosts')
        .find({ isConfirmed: { $ne: true }, dueDate: { $lt: now } }, { projection: { amount: 1, dueDate: 1, category: 1, notes: 1 } })
        .sort({ dueDate: 1 })
        .limit(10)
        .toArray(),
      this.orderModel.db
        .collection('othercosts')
        .find({ isConfirmed: { $ne: true }, dueDate: { $gte: now, $lte: dueTo } }, { projection: { amount: 1, dueDate: 1, category: 1, notes: 1 } })
        .sort({ dueDate: 1 })
        .limit(10)
        .toArray(),
    ]);

    return {
      windowDays,
      summary: summary[0] || { count: 0, outstanding: 0 },
      byCategory,
      overdueCount: overdue.length,
      dueSoonCount: dueSoon.length,
      overdue: overdue.map((item: any) => ({ ...item, notes: this.trimText(item.notes, 180) })),
      dueSoon: dueSoon.map((item: any) => ({ ...item, notes: this.trimText(item.notes, 180) })),
    };
  }

  private async buildAdsCostCashflowSnapshot(startDate: Date, endDate: Date) {
    const [summary, byChannel, topAdGroups] = await Promise.all([
      this.orderModel.db.collection('advertisingcosts').aggregate([
        { $match: { date: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: null,
            records: { $sum: 1 },
            spent: { $sum: '$spentAmount' },
            impressions: { $sum: '$impressions' },
            clicks: { $sum: '$clicks' },
            conversations: { $sum: '$messagingConversationStarted7d' },
          },
        },
      ]).toArray(),
      this.orderModel.db.collection('advertisingcosts').aggregate([
        { $match: { date: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: { $ifNull: ['$channel', 'unknown'] }, spent: { $sum: '$spentAmount' }, records: { $sum: 1 } } },
        { $sort: { spent: -1 } },
      ]).toArray(),
      this.orderModel.db.collection('advertisingcosts').aggregate([
        { $match: { date: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$adGroupId', spent: { $sum: '$spentAmount' }, records: { $sum: 1 } } },
        { $sort: { spent: -1 } },
        { $limit: 10 },
      ]).toArray(),
    ]);

    return {
      from: startDate,
      to: endDate,
      summary: summary[0] || { records: 0, spent: 0, impressions: 0, clicks: 0, conversations: 0 },
      byChannel,
      topAdGroups,
    };
  }

  private async buildAdsDiagnosticOverview(startDate: Date, endDate: Date, windowDays: number) {
    const messageDateMatch = {
      $or: [
        { receivedAt: { $gte: startDate, $lte: endDate } },
        { receivedAt: { $exists: false }, createdAt: { $gte: startDate, $lte: endDate } },
      ],
    };
    const conversationDateMatch = {
      $or: [
        { lastMessageAt: { $gte: startDate, $lte: endDate } },
        { lastMessageAt: { $exists: false }, createdAt: { $gte: startDate, $lte: endDate } },
      ],
    };

    const [
      adAccounts,
      adGroups,
      fanpages,
      tokenHealth,
      syncHealth,
      spendSummaryRows,
      spendByAdGroupRows,
      spendByAccountRows,
      inboundSummaryRows,
      inboundByAdGroupRows,
      conversationSummaryRows,
      conversationAttributionRows,
      pendingOrderSummaryRows,
      pendingOrderByAdGroupRows,
      performanceRows,
      optimalSpendSuggestions,
    ] = await Promise.all([
      this.adAccountModel
        .find(
          {},
          {
            name: 1,
            accountId: 1,
            accountType: 1,
            isActive: 1,
            accountStatus: 1,
            lastSyncAt: 1,
            lastSyncStatus: 1,
            lastSyncError: 1,
            tokenSource: 1,
            updatedAt: 1,
          },
        )
        .lean(),
      this.adGroupModel
        .find(
          {},
          {
            name: 1,
            adGroupId: 1,
            platform: 1,
            isActive: 1,
            adAccountId: 1,
            fanpageId: 1,
            campaignId: 1,
            remoteStatus: 1,
            effectiveStatus: 1,
            dailyBudget: 1,
            lastSyncAt: 1,
            lastSyncStatus: 1,
            lastSyncError: 1,
            selectedProducts: 1,
            updatedAt: 1,
          },
        )
        .lean(),
      this.fanpageModel
        .find(
          {},
          {
            pageId: 1,
            name: 1,
            status: 1,
            aiEnabled: 1,
            subscribedWebhook: 1,
            hasAccessToken: 1,
            lastRefreshAt: 1,
            updatedAt: 1,
          },
        )
        .lean(),
      this.buildApiTokenSnapshot().catch((error: any) => ({ error: error?.message || String(error) })),
      this.buildAdsSyncHealthSnapshot().catch((error: any) => ({ error: error?.message || String(error) })),
      this.orderModel.db.collection('advertisingcosts').aggregate([
        { $match: { date: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: null,
            records: { $sum: 1 },
            spent: { $sum: '$spentAmount' },
            impressions: { $sum: '$impressions' },
            clicks: { $sum: '$clicks' },
            conversations: { $sum: '$messagingConversationStarted7d' },
            firstDate: { $min: '$date' },
            latestDate: { $max: '$date' },
          },
        },
      ]).toArray(),
      this.orderModel.db.collection('advertisingcosts').aggregate([
        { $match: { date: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: '$adGroupId',
            spent: { $sum: '$spentAmount' },
            impressions: { $sum: '$impressions' },
            clicks: { $sum: '$clicks' },
            conversations: { $sum: '$messagingConversationStarted7d' },
            records: { $sum: 1 },
            latestDate: { $max: '$date' },
          },
        },
        { $sort: { spent: -1 } },
        { $limit: 25 },
      ]).toArray(),
      this.orderModel.db.collection('advertisingcosts').aggregate([
        { $match: { date: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: {
              accountId: { $ifNull: ['$customerId', 'unknown'] },
              channel: { $ifNull: ['$channel', 'unknown'] },
            },
            spent: { $sum: '$spentAmount' },
            records: { $sum: 1 },
            conversations: { $sum: '$messagingConversationStarted7d' },
            latestDate: { $max: '$date' },
          },
        },
        { $sort: { spent: -1 } },
        { $limit: 25 },
      ]).toArray(),
      this.orderModel.db.collection('chatmessages').aggregate([
        { $match: { direction: 'in', ...messageDateMatch } },
        {
          $group: {
            _id: null,
            inbox: { $sum: 1 },
            awaitingHuman: { $sum: { $cond: ['$awaitingHuman', 1, 0] } },
            uniqueSenders: { $addToSet: '$senderPsid' },
            latestAt: { $max: { $ifNull: ['$receivedAt', '$createdAt'] } },
          },
        },
      ]).toArray(),
      this.orderModel.db.collection('chatmessages').aggregate([
        { $match: { direction: 'in', ...messageDateMatch } },
        {
          $group: {
            _id: { $ifNull: ['$adGroupId', 'unknown'] },
            inbox: { $sum: 1 },
            awaitingHuman: { $sum: { $cond: ['$awaitingHuman', 1, 0] } },
            uniqueSenders: { $addToSet: '$senderPsid' },
            latestAt: { $max: { $ifNull: ['$receivedAt', '$createdAt'] } },
          },
        },
        { $sort: { inbox: -1 } },
        { $limit: 25 },
      ]).toArray(),
      this.conversationModel.aggregate([
        { $match: { archived: { $ne: true }, ...conversationDateMatch } },
        {
          $group: {
            _id: null,
            conversations: { $sum: 1 },
            needsHuman: { $sum: { $cond: ['$needsHuman', 1, 0] } },
            awaitingCount: { $sum: '$awaitingCount' },
            withAdGroup: { $sum: { $cond: [{ $ifNull: ['$lastAdGroupId', false] }, 1, 0] } },
            latestAt: { $max: '$lastMessageAt' },
          },
        },
      ]),
      this.conversationModel.aggregate([
        { $match: { archived: { $ne: true }, ...conversationDateMatch } },
        {
          $group: {
            _id: null,
            linkedToErp: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $ifNull: ['$orderId', false] },
                      { $ifNull: ['$pendingOrderId', false] },
                      { $in: ['$orderDraftStatus', ['draft', 'awaiting', 'approved']] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            unattributed: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ifNull: ['$lastAdGroupId', false] },
                      { $not: [{ $ifNull: ['$orderId', false] }] },
                      { $not: [{ $ifNull: ['$pendingOrderId', false] }] },
                      { $not: [{ $in: ['$orderDraftStatus', ['draft', 'awaiting', 'approved']] }] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      this.pendingOrderModel.aggregate([
        {
          $match: {
            $or: [
              { capturedAt: { $gte: startDate, $lte: endDate } },
              { capturedAt: { $exists: false }, createdAt: { $gte: startDate, $lte: endDate } },
            ],
          },
        },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.pendingOrderModel.aggregate([
        {
          $match: {
            $or: [
              { capturedAt: { $gte: startDate, $lte: endDate } },
              { capturedAt: { $exists: false }, createdAt: { $gte: startDate, $lte: endDate } },
            ],
          },
        },
        {
          $group: {
            _id: { $ifNull: ['$adGroupId', 'unknown'] },
            pendingOrders: { $sum: 1 },
            draftOrAwaiting: { $sum: { $cond: [{ $in: ['$status', ['draft', 'awaiting']] }, 1, 0] } },
            approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
            latestAt: { $max: { $ifNull: ['$capturedAt', '$createdAt'] } },
          },
        },
        { $sort: { pendingOrders: -1 } },
        { $limit: 25 },
      ]),
      this.profitReportService.getAdGroupPerformanceReport({
        startDate,
        endDate,
        minOrders: 1,
        onlyFinalized: true,
      }).catch(() => []),
      this.profitReportService.getOptimalSpendSuggestions({ lookbackDays: windowDays }).catch(() => []),
    ]);

    const accountByObjectId = new Map(this.asArray(adAccounts).map((item: any) => [String(item._id), item]));
    const accountByProviderId = new Map(this.asArray(adAccounts).map((item: any) => [String(item.accountId || ''), item]));
    const adGroupById = new Map(this.asArray(adGroups).map((item: any) => [String(item.adGroupId || ''), item]));
    const fanpagesList = this.asArray(fanpages);
    const activeAdGroup = (group: any) => {
      const statusText = this.removeVietnameseTone(`${group?.remoteStatus || ''} ${group?.effectiveStatus || ''}`).toLowerCase();
      const badStatus = ['paused', 'error', 'disabled', 'disable', 'inactive', 'archived', 'deleted', 'disapproved', 'rejected'].some((needle) => statusText.includes(needle));
      return group?.isActive === true && !badStatus && group?.lastSyncStatus !== 'error';
    };
    const pausedOrErrorAdGroups = this.asArray(adGroups).filter((group: any) => !activeAdGroup(group));
    const campaignIds = Array.from(new Set(this.asArray(adGroups).map((group: any) => group.campaignId).filter(Boolean)));
    const activeCampaignIds = Array.from(new Set(this.asArray(adGroups).filter(activeAdGroup).map((group: any) => group.campaignId).filter(Boolean)));
    const tokenSummary = (tokenHealth as any)?.summary || null;
    const syncSummary = (syncHealth as any)?.summary || null;
    const providerErrors = [
      ...this.asArray(adAccounts)
        .filter((item: any) => item.lastSyncStatus === 'error')
        .map((item: any) => ({
          provider: item.accountType || 'unknown',
          source: item.name || item.accountId,
          message: this.trimText(item.lastSyncError, 180),
          lastSyncAt: item.lastSyncAt || null,
        })),
      ...pausedOrErrorAdGroups
        .filter((item: any) => item.lastSyncStatus === 'error')
        .map((item: any) => ({
          provider: item.platform || 'unknown',
          source: item.name || item.adGroupId,
          message: this.trimText(item.lastSyncError, 180),
          lastSyncAt: item.lastSyncAt || null,
        })),
      ...this.asArray((syncHealth as any)?.tokenIssues).map((item: any) => ({
        provider: item.platform || item.provider || 'unknown',
        source: item.source || 'sync-token',
        message: this.trimText(item.lastCheckMessage || item.lastCheckStatus, 180),
        lastSyncAt: item.expireAt || null,
      })),
      ...this.asArray((syncHealth as any)?.platforms)
        .filter((item: any) => item.ok === false)
        .map((item: any) => ({
          provider: item.platform || 'unknown',
          source: 'sync-health',
          message: this.trimText(item.error, 180),
          lastSyncAt: null,
        })),
    ];
    const missingPermissionFanpages = fanpagesList.filter((page: any) => !page.hasAccessToken || page.subscribedWebhook !== true);
    const spendSummary = spendSummaryRows[0] || { records: 0, spent: 0, impressions: 0, clicks: 0, conversations: 0, latestDate: null };
    const inboundSummary = inboundSummaryRows[0] || { inbox: 0, awaitingHuman: 0, uniqueSenders: [], latestAt: null };
    const conversationSummary = conversationSummaryRows[0] || { conversations: 0, needsHuman: 0, awaitingCount: 0, withAdGroup: 0, latestAt: null };
    const conversationAttribution = conversationAttributionRows[0] || { linkedToErp: 0, unattributed: 0 };
    const pendingByStatus = this.asArray(pendingOrderSummaryRows).reduce((acc: Record<string, number>, row: any) => {
      acc[row._id || 'unknown'] = row.count || 0;
      return acc;
    }, {});
    const totalPendingOrders = Object.values(pendingByStatus).reduce((sum: number, value: any) => sum + (Number(value) || 0), 0);
    const pendingDraftAwaiting = (pendingByStatus.draft || 0) + (pendingByStatus.awaiting || 0);
    const spendByAdGroup = this.asArray(spendByAdGroupRows).map((row: any) => {
      const group = adGroupById.get(String(row._id || ''));
      return {
        adGroupId: row._id || null,
        adGroupName: group?.name || row._id || 'unknown',
        platform: group?.platform || null,
        spent: row.spent || 0,
        impressions: row.impressions || 0,
        clicks: row.clicks || 0,
        conversations: row.conversations || 0,
        records: row.records || 0,
        latestDate: row.latestDate || null,
      };
    });
    const spendByAccount = this.asArray(spendByAccountRows).map((row: any) => {
      const accountId = row._id?.accountId || 'unknown';
      const account = accountByProviderId.get(String(accountId));
      return {
        accountId,
        accountName: account?.name || accountId,
        provider: account?.accountType || row._id?.channel || 'unknown',
        spent: row.spent || 0,
        records: row.records || 0,
        conversations: row.conversations || 0,
        latestDate: row.latestDate || null,
      };
    });
    const inboundByAdGroup = this.asArray(inboundByAdGroupRows).map((row: any) => {
      const group = adGroupById.get(String(row._id || ''));
      return {
        adGroupId: row._id || null,
        adGroupName: group?.name || row._id || 'unknown',
        inbox: row.inbox || 0,
        awaitingHuman: row.awaitingHuman || 0,
        uniqueLeads: this.asArray(row.uniqueSenders).length,
        latestAt: row.latestAt || null,
      };
    });
    const pendingByAdGroup = this.asArray(pendingOrderByAdGroupRows).map((row: any) => {
      const group = adGroupById.get(String(row._id || ''));
      return {
        adGroupId: row._id || null,
        adGroupName: group?.name || row._id || 'unknown',
        pendingOrders: row.pendingOrders || 0,
        draftOrAwaiting: row.draftOrAwaiting || 0,
        approved: row.approved || 0,
        latestAt: row.latestAt || null,
      };
    });
    const performance = this.asArray(performanceRows);
    const suggestions = this.asArray(optimalSpendSuggestions);
    const performanceByAdGroup = new Map(performance.map((item: any) => [String(item.adGroupId || ''), item]));
    const suggestionByAdGroup = new Map(suggestions.map((item: any) => [String(item.adGroupId || ''), item]));
    const leadByAdGroup = new Map<string, number>();
    for (const row of inboundByAdGroup) {
      if (row.adGroupId) leadByAdGroup.set(String(row.adGroupId), (leadByAdGroup.get(String(row.adGroupId)) || 0) + row.uniqueLeads);
    }
    for (const row of pendingByAdGroup) {
      if (row.adGroupId) leadByAdGroup.set(String(row.adGroupId), (leadByAdGroup.get(String(row.adGroupId)) || 0) + row.pendingOrders);
    }
    const spendByAdGroupMap = new Map(spendByAdGroup.map((item: any) => [String(item.adGroupId || ''), item]));
    const adGroupIdsForReadiness = Array.from(new Set([
      ...this.asArray(adGroups).map((item: any) => item.adGroupId).filter(Boolean),
      ...spendByAdGroup.map((item: any) => item.adGroupId).filter(Boolean),
      ...performance.map((item: any) => item.adGroupId).filter(Boolean),
    ])).slice(0, 60);
    const readinessItems = adGroupIdsForReadiness.map((adGroupId: any) => {
      const id = String(adGroupId);
      const group = adGroupById.get(id);
      const spend = Number(spendByAdGroupMap.get(id)?.spent || 0);
      const leadCount = Number(leadByAdGroup.get(id) || 0);
      const perf = performanceByAdGroup.get(id);
      const suggestion = suggestionByAdGroup.get(id);
      if (spend <= 0) {
        return { adGroupId: id, adGroupName: group?.name || perf?.adGroupName || id, status: 'not_ready', reason: 'spend = 0', spent: spend, leadCount, hasProfit: !!perf };
      }
      if (leadCount <= 0) {
        return { adGroupId: id, adGroupName: group?.name || perf?.adGroupName || id, status: 'not_ready', reason: 'thiếu lead/inbox', spent: spend, leadCount, hasProfit: !!perf };
      }
      if (!perf) {
        return { adGroupId: id, adGroupName: group?.name || id, status: 'not_ready', reason: 'thiếu profit/order attribution', spent: spend, leadCount, hasProfit: false };
      }
      if (suggestion) {
        return {
          adGroupId: id,
          adGroupName: group?.name || suggestion.adGroupName || perf.adGroupName || id,
          status: 'pending_approval',
          reason: suggestion.reason || 'đủ dữ liệu và có đề xuất optimal spend',
          spent: spend,
          leadCount,
          hasProfit: true,
          action: suggestion.scaleAction || 'maintain',
          suggestedSpend: suggestion.suggestedSpend ?? suggestion.appliedSpend ?? null,
          confidence: suggestion.confidence ?? null,
        };
      }
      return { adGroupId: id, adGroupName: group?.name || perf.adGroupName || id, status: 'ready_review', reason: 'đủ spend, lead và profit; chưa có đề xuất tự động', spent: spend, leadCount, hasProfit: true };
    });

    const missingData = [
      'Chưa có collection Campaign riêng; campaign đang được suy từ campaignId trên AdGroup.',
      'Chưa có collection Ads/Creative riêng nên chưa đếm được ads active thật theo từng mẫu quảng cáo.',
      'Chưa có module Lead/Form riêng; lead hiện được suy từ inbox, conversation và pending-order.',
      'Token fanpage không có trường expireAt riêng; hạn token được kiểm tra qua ApiToken/sync health nếu có.',
    ];

    return {
      generatedAt: endDate.toISOString(),
      windowDays,
      dateRange: {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
      },
      accounts: {
        total: this.asArray(adAccounts).length,
        active: this.asArray(adAccounts).filter((item: any) => item.isActive === true).length,
        checked: true,
        tokenSummary,
        tokenValid: tokenSummary ? (tokenSummary.expired || 0) === 0 && (tokenSummary.failing || 0) === 0 : null,
        providerErrorCount: providerErrors.length,
        providerErrors: providerErrors.slice(0, 10),
        byProvider: this.asArray(adAccounts).reduce((acc: Record<string, any>, item: any) => {
          const provider = item.accountType || 'unknown';
          acc[provider] = acc[provider] || { total: 0, active: 0, syncErrors: 0 };
          acc[provider].total += 1;
          if (item.isActive === true) acc[provider].active += 1;
          if (item.lastSyncStatus === 'error') acc[provider].syncErrors += 1;
          return acc;
        }, {}),
        recent: this.asArray(adAccounts).slice(0, 12).map((item: any) => ({
          _id: String(item._id),
          name: item.name,
          accountId: item.accountId,
          provider: item.accountType,
          isActive: item.isActive === true,
          accountStatus: item.accountStatus ?? null,
          lastSyncAt: item.lastSyncAt || null,
          lastSyncStatus: item.lastSyncStatus || null,
          lastSyncError: this.trimText(item.lastSyncError, 160),
          tokenSource: item.tokenSource || null,
        })),
      },
      fanpages: {
        total: fanpagesList.length,
        active: fanpagesList.filter((page: any) => page.status === 'active').length,
        activePages: fanpagesList
          .filter((page: any) => page.status === 'active')
          .slice(0, 12)
          .map((page: any) => ({ pageId: page.pageId, name: page.name, aiEnabled: !!page.aiEnabled, subscribedWebhook: !!page.subscribedWebhook })),
        missingPermissionCount: missingPermissionFanpages.length,
        missingPermissions: missingPermissionFanpages.slice(0, 12).map((page: any) => ({
          pageId: page.pageId,
          name: page.name,
          missing: [
            !page.hasAccessToken ? 'accessToken' : null,
            page.subscribedWebhook !== true ? 'subscribedWebhook' : null,
          ].filter(Boolean),
          lastRefreshAt: page.lastRefreshAt || null,
        })),
      },
      sync: {
        lastSyncAt: [
          ...this.asArray(adAccounts).map((item: any) => item.lastSyncAt).filter(Boolean),
          ...this.asArray(adGroups).map((item: any) => item.lastSyncAt).filter(Boolean),
          spendSummary.latestDate,
          conversationSummary.latestAt,
        ].sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime())[0] || null,
        summary: syncSummary,
        health: syncHealth,
        hasFacebookError: this.asArray(providerErrors).some((item: any) => item.provider === 'facebook'),
        hasGoogleError: this.asArray(providerErrors).some((item: any) => item.provider === 'google'),
        errorLogs: providerErrors.slice(0, 10),
      },
      entities: {
        campaigns: {
          totalInferred: campaignIds.length,
          activeInferred: activeCampaignIds.length,
          pausedOrErrorInferred: Math.max(0, campaignIds.length - activeCampaignIds.length),
          dataSource: 'adgroups.campaignId',
        },
        adsets: {
          total: this.asArray(adGroups).length,
          active: this.asArray(adGroups).filter(activeAdGroup).length,
          pausedOrError: pausedOrErrorAdGroups.length,
          pausedOrErrorItems: pausedOrErrorAdGroups.slice(0, 12).map((group: any) => ({
            adGroupId: group.adGroupId,
            name: group.name,
            platform: group.platform,
            remoteStatus: group.remoteStatus || null,
            effectiveStatus: group.effectiveStatus || null,
            lastSyncStatus: group.lastSyncStatus || null,
            lastSyncError: this.trimText(group.lastSyncError, 160),
          })),
        },
        ads: {
          active: null,
          dataSource: 'missing_ads_collection',
        },
      },
      spend7d: {
        totalSpent: spendSummary.spent || 0,
        records: spendSummary.records || 0,
        impressions: spendSummary.impressions || 0,
        clicks: spendSummary.clicks || 0,
        conversations: spendSummary.conversations || 0,
        latestDate: spendSummary.latestDate || null,
        byAccount: spendByAccount,
        byAdGroup: spendByAdGroup,
      },
      leads: {
        leadCount: this.asArray(inboundSummary.uniqueSenders).length || inboundSummary.inbox || 0,
        inboxCount: inboundSummary.inbox || 0,
        formCount: null,
        unhandledLeadCount: (conversationSummary.needsHuman || 0) + pendingDraftAwaiting + (inboundSummary.awaitingHuman || 0),
        needsHuman: conversationSummary.needsHuman || 0,
        awaitingMessages: inboundSummary.awaitingHuman || 0,
        pendingOrders: totalPendingOrders,
        pendingByStatus,
        byAdGroup: inboundByAdGroup,
      },
      attribution: {
        linkedToErp: (conversationAttribution.linkedToErp || 0) + (pendingByStatus.approved || 0),
        unattributed: conversationAttribution.unattributed || 0,
        conversationsWithAdGroup: conversationSummary.withAdGroup || 0,
        pendingByAdGroup,
      },
      profit: {
        groupsWithRevenue: performance.filter((item: any) => (item.totalRevenue || 0) > 0).slice(0, 12),
        groupsWithProfit: performance.filter((item: any) => (item.totalNetProfit || 0) > 0).slice(0, 12),
        groupsWithoutData: this.asArray(adGroups)
          .filter((group: any) => !performanceByAdGroup.has(String(group.adGroupId || '')))
          .slice(0, 12)
          .map((group: any) => ({ adGroupId: group.adGroupId, name: group.name, isActive: !!group.isActive, platform: group.platform })),
      },
      pnl: {
        winning: performance.filter((item: any) => (item.totalNetProfit || 0) > 0).slice(0, 12),
        losing: performance.filter((item: any) => (item.totalAdsSpent || 0) > 0 && (item.totalNetProfit || 0) < 0).slice(0, 12),
        insufficientData: this.asArray(adGroups)
          .filter((group: any) => !performanceByAdGroup.has(String(group.adGroupId || '')))
          .slice(0, 12)
          .map((group: any) => ({ adGroupId: group.adGroupId, name: group.name, isActive: !!group.isActive, platform: group.platform })),
      },
      readiness: {
        summary: {
          totalChecked: readinessItems.length,
          notReady: readinessItems.filter((item: any) => item.status === 'not_ready').length,
          pendingApproval: readinessItems.filter((item: any) => item.status === 'pending_approval').length,
          readyReview: readinessItems.filter((item: any) => item.status === 'ready_review').length,
        },
        items: readinessItems.slice(0, 25),
      },
      missingData,
    };
  }

  private async buildQuoteReadinessSnapshot(now: Date) {
    const [agentQuotes, supplierQuotes, expiringAgentQuotes] = await Promise.all([
      this.orderModel.db.collection('quotes').aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            active: { $sum: { $cond: ['$isActive', 1, 0] } },
          },
        },
      ]).toArray(),
      this.orderModel.db.collection('supplierquotes').aggregate([
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            products: { $addToSet: '$productId' },
            suppliers: { $addToSet: '$supplierId' },
          },
        },
      ]).toArray(),
      this.orderModel.db
        .collection('quotes')
        .find(
          { isActive: { $ne: false }, validUntil: { $gte: now, $lte: new Date(now.getTime() + 7 * DAY_MS) } },
          { projection: { productId: 1, product: 1, agentName: 1, unitPrice: 1, status: 1, validUntil: 1 } },
        )
        .sort({ validUntil: 1 })
        .limit(10)
        .toArray(),
    ]);
    const supplierSummary = supplierQuotes[0] || { count: 0, products: [], suppliers: [] };

    return {
      agentQuotes,
      supplierQuotes: {
        count: supplierSummary.count || 0,
        productCount: this.asArray(supplierSummary.products).length,
        supplierCount: this.asArray(supplierSummary.suppliers).length,
      },
      expiringAgentQuotes,
    };
  }

  private async buildAccessAuditSnapshot() {
    const [usersByRole, disabledUsers, recentSessions] = await Promise.all([
      this.orderModel.db.collection('users').aggregate([
        { $group: { _id: { $ifNull: ['$role', 'unknown'] }, count: { $sum: 1 }, disabled: { $sum: { $cond: ['$isDisabled', 1, 0] } } } },
        { $sort: { count: -1 } },
      ]).toArray(),
      this.orderModel.db
        .collection('users')
        .find({ isDisabled: true }, { projection: { email: 1, fullName: 1, role: 1, updatedAt: 1 } })
        .sort({ updatedAt: -1 })
        .limit(10)
        .toArray(),
      this.orderModel.db
        .collection('sessionlogs')
        .find({}, { projection: { userId: 1, role: 1, action: 1, createdAt: 1, ip: 1 } })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray(),
    ]);

    return {
      usersByRole,
      disabledUsers: disabledUsers.map((item: any) => ({
        _id: String(item._id),
        email: item.email,
        fullName: item.fullName,
        role: item.role,
        updatedAt: item.updatedAt,
      })),
      recentSessions: recentSessions.map((item: any) => ({
        _id: String(item._id),
        userId: item.userId ? String(item.userId) : null,
        role: item.role || null,
        action: item.action || null,
        createdAt: item.createdAt,
        ip: item.ip || null,
      })),
    };
  }

  private buildAuthContext(currentUser?: any, requestedRole?: string): AiOperatorAuthContext {
    const role = String(currentUser?.role || '').toLowerCase() || null;
    const userId = currentUser?.id || currentUser?._id || currentUser?.userId || currentUser?.sub || null;
    return {
      userId: userId ? String(userId) : null,
      role,
      requestedRole: requestedRole || null,
      fullName: currentUser?.fullName || null,
      permissions: getPermissionsForRole(role || undefined),
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
    const normalized = this.removeVietnameseTone(domain || '').toLowerCase();
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
    const normalized = this.removeVietnameseTone(endpoint || '').toLowerCase();
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

    const explicitIntent = this.normalizeIntent(intent);
    if (explicitIntent) {
      return this.buildContextRoute(explicitIntent, this.findBestScenario(message, role, explicitIntent), 'explicit_intent');
    }

    const normalizedMessage = this.removeVietnameseTone(message || '').toLowerCase();
    if (this.isConciseRoleBriefingRequest(normalizedMessage)) {
      return this.buildContextRoute('concise_role_briefing', this.findBestScenario(message, role, 'concise_role_briefing'), 'keyword_concise_role_briefing');
    }
    if (this.isAiRecommendationReviewRequest(normalizedMessage)) {
      return this.buildContextRoute('ai_recommendation_review', this.findBestScenario(message, role, 'ai_recommendation_review'), 'keyword_ai_recommendation_review');
    }
    if (this.isRootCauseAnalysisRequest(normalizedMessage)) {
      return this.buildContextRoute('root_cause_analysis', this.findBestScenario(message, role, 'root_cause_analysis'), 'keyword_root_cause_analysis');
    }
    if (this.isAnomalyDetectionRequest(normalizedMessage)) {
      return this.buildContextRoute('anomaly_detection_daily', this.findBestScenario(message, role, 'anomaly_detection_daily'), 'keyword_anomaly_detection_daily');
    }
    if (this.isPriorityRankingRequest(normalizedMessage)) {
      return this.buildContextRoute('priority_ranking', this.findBestScenario(message, role, 'priority_ranking'), 'keyword_priority_ranking');
    }
    if (this.isTargetGapAnalysisRequest(normalizedMessage)) {
      return this.buildContextRoute('target_gap_analysis', this.findBestScenario(message, role, 'target_gap_analysis'), 'keyword_target_gap_analysis');
    }
    if (this.isPeriodComparisonRequest(normalizedMessage)) {
      return this.buildContextRoute('period_comparison', this.findBestScenario(message, role, 'period_comparison'), 'keyword_period_comparison');
    }
    if (this.isProductAdsRevenueRatioQuestion(normalizedMessage)) {
      return this.buildContextRoute('product_ads_revenue_ratio', null, 'keyword_product_ads_revenue_ratio');
    }
    if (this.isAdsProductProfitQuestion(normalizedMessage)) {
      return this.buildContextRoute('ads_product_profit_leaderboard', null, 'keyword_ads_product_profit_leaderboard');
    }
    if (this.isProductDecisionReviewRequest(normalizedMessage)) {
      return this.buildContextRoute('product_decision_review', this.findBestScenario(message, role, 'product_decision_review'), 'keyword_product_decision_review');
    }
    if (this.isProductPerformanceQuestion(normalizedMessage)) {
      return this.buildContextRoute('product_profit_leaderboard', null, 'keyword_product_performance');
    }
    if (this.isProductProfitLeaderboardQuestion(normalizedMessage)) {
      return this.buildContextRoute('product_profit_leaderboard', null, 'keyword_product_profit_leaderboard');
    }
    if (this.isProductCountQuestion(normalizedMessage)) {
      return this.buildContextRoute('product_count', null, 'keyword_product_count');
    }
    if (this.isProductListQuestion(normalizedMessage)) {
      return this.buildContextRoute('product_list', null, 'keyword_product_list');
    }
    if (this.isChatbotFanpagePerformanceQuestion(normalizedMessage)) {
      return this.buildContextRoute('chatbot_fanpage_performance_lookup', null, 'keyword_chatbot_fanpage_performance');
    }
    if (this.isFanpagePerformanceQuestion(normalizedMessage)) {
      return this.buildContextRoute('fanpage_performance_lookup', null, 'keyword_fanpage_performance');
    }
    if (this.isCustomerValueAnalysisRequest(normalizedMessage)) {
      return this.buildContextRoute('customer_value_analysis', this.findBestScenario(message, role, 'customer_value_analysis'), 'keyword_customer_value_analysis');
    }
    if (this.isCustomerValueOrCareRequest(normalizedMessage)) {
      return this.buildContextRoute('sales', this.findBestScenario(message, role, 'sales'), 'keyword_customer_value_or_care');
    }
    if (this.isAgentRevenueLeaderboardQuestion(normalizedMessage)) {
      return this.buildContextRoute('agent_revenue_leaderboard', null, 'keyword_agent_revenue_leaderboard');
    }
    if (this.isAgentProfitLeaderboardQuestion(normalizedMessage)) {
      return this.buildContextRoute('agent_profit_leaderboard', null, 'keyword_agent_profit_leaderboard');
    }
    if (this.isDecisionWaitingApprovalRequest(normalizedMessage)) {
      return this.buildContextRoute('decision_waiting_approval', this.findBestScenario(message, role, 'decision_waiting_approval'), 'keyword_decision_waiting_approval');
    }
    if (this.isBusinessRiskRankingRequest(normalizedMessage)) {
      return this.buildContextRoute('business_risk_ranking', this.findBestScenario(message, role, 'business_risk_ranking'), 'keyword_business_risk_ranking');
    }
    if (this.isCompanyKpiScorecardRequest(normalizedMessage)) {
      return this.buildContextRoute('company_kpi_scorecard', this.findBestScenario(message, role, 'company_kpi_scorecard'), 'keyword_company_kpi_scorecard');
    }
    if (this.isExecutiveDailyOverviewRequest(normalizedMessage)) {
      return this.buildContextRoute('director_daily_overview', this.findBestScenario(message, role, 'director_daily_overview'), 'keyword_director_daily_overview');
    }
    if (this.isOwnerAccountabilityRequest(normalizedMessage)) {
      return this.buildContextRoute('owner_accountability_review', this.findBestScenario(message, role, 'owner_accountability_review'), 'keyword_owner_accountability_review');
    }
    if (this.isPeoplePerformanceRequest(normalizedMessage)) {
      return this.buildContextRoute('operations', this.findBestScenario(message, role, 'operations'), 'keyword_people_performance');
    }
    if (this.isAdGroupProfitClassificationRequest(normalizedMessage)) {
      return this.buildContextRoute('ad_group_profit_classification', null, 'keyword_ad_group_profit_classification');
    }
    if (this.isAdsBudgetCashflowGateRequest(normalizedMessage)) {
      return this.buildContextRoute('ads_budget_cashflow_gate', this.findBestScenario(message, role, 'ads_budget_cashflow_gate'), 'keyword_ads_budget_cashflow_gate');
    }
    if (this.isAdsScaleReadinessRequest(normalizedMessage)) {
      return this.buildContextRoute('ads_scale_readiness', this.findBestScenario(message, role, 'ads_scale_readiness'), 'keyword_ads_scale_readiness');
    }
    if (this.isAdsKillOrPauseRequest(normalizedMessage)) {
      return this.buildContextRoute('ads_kill_or_pause_recommendation', this.findBestScenario(message, role, 'ads_kill_or_pause_recommendation'), 'keyword_ads_kill_or_pause');
    }
    if (this.isChannelProfitabilityRequest(normalizedMessage)) {
      return this.buildContextRoute('channel_profitability_review', this.findBestScenario(message, role, 'channel_profitability_review'), 'keyword_channel_profitability_review');
    }
    if (this.isChannelMixReviewRequest(normalizedMessage)) {
      return this.buildContextRoute('channel_mix_review', this.findBestScenario(message, role, 'channel_mix_review'), 'keyword_channel_mix_review');
    }
    if (this.isResourceAllocationDecisionRequest(normalizedMessage)) {
      return this.buildContextRoute('resource_allocation_decision', this.findBestScenario(message, role, 'resource_allocation_decision'), 'keyword_resource_allocation_decision');
    }
    if (this.isSalesSlaTaskCreationRequest(normalizedMessage)) {
      return this.buildContextRoute('sales_sla_task_creation', this.findBestScenario(message, role, 'sales_sla_task_creation'), 'keyword_sales_sla_task_creation');
    }
    if (this.isSalesSlaViolationRequest(normalizedMessage)) {
      return this.buildContextRoute('sales_sla_violation', this.findBestScenario(message, role, 'sales_sla_violation'), 'keyword_sales_sla_violation');
    }
    if (this.isLeadQualityBySourceRequest(normalizedMessage)) {
      return this.buildContextRoute('lead_quality_by_source', this.findBestScenario(message, role, 'lead_quality_by_source'), 'keyword_lead_quality_by_source');
    }
    if (this.isSalesConversionByUserRequest(normalizedMessage)) {
      return this.buildContextRoute('sales_conversion_by_user', this.findBestScenario(message, role, 'sales_conversion_by_user'), 'keyword_sales_conversion_by_user');
    }
    if (this.isLeadFollowupHealthRequest(normalizedMessage)) {
      return this.buildContextRoute('lead_followup_health', this.findBestScenario(message, role, 'lead_followup_health'), 'keyword_lead_followup_health');
    }
    if (this.isMarketingFunnelHealthRequest(normalizedMessage)) {
      return this.buildContextRoute('marketing_funnel_health', this.findBestScenario(message, role, 'marketing_funnel_health'), 'keyword_marketing_funnel_health');
    }
    if (this.isCreativeFatigueRequest(normalizedMessage)) {
      return this.buildContextRoute('creative_fatigue_review', this.findBestScenario(message, role, 'creative_fatigue_review'), 'keyword_creative_fatigue_review');
    }
    if (this.isOfferPerformanceRequest(normalizedMessage)) {
      return this.buildContextRoute('offer_performance_review', this.findBestScenario(message, role, 'offer_performance_review'), 'keyword_offer_performance_review');
    }
    if (this.isAdsDiagnosticChecklistRequest(normalizedMessage)) {
      return this.buildContextRoute('ads_diagnostic_checklist', null, 'keyword_ads_diagnostic_checklist');
    }
    if (this.isLateOrderDiagnosticRequest(normalizedMessage)) {
      return this.buildContextRoute('late_order_diagnostic', this.findBestScenario(message, role, 'late_order_diagnostic'), 'keyword_late_order_diagnostic');
    }
    if (this.isFulfillmentBottleneckRequest(normalizedMessage)) {
      return this.buildContextRoute('fulfillment_bottleneck', this.findBestScenario(message, role, 'fulfillment_bottleneck'), 'keyword_fulfillment_bottleneck');
    }
    if (this.isTrackingIssueRequest(normalizedMessage)) {
      return this.buildContextRoute('tracking_issue_check', this.findBestScenario(message, role, 'tracking_issue_check'), 'keyword_tracking_issue');
    }
    if (this.isCancelRefundRiskRequest(normalizedMessage)) {
      return this.buildContextRoute('cancel_refund_risk', this.findBestScenario(message, role, 'cancel_refund_risk'), 'keyword_cancel_refund_risk');
    }
    if (this.isCashflowForecastRequest(normalizedMessage)) {
      return this.buildContextRoute('cashflow_forecast', this.findBestScenario(message, role, 'cashflow_forecast'), 'keyword_cashflow_forecast');
    }
    if (this.isAdvancedCashflowScenarioRequest(normalizedMessage)) {
      return this.buildContextRoute('advanced_cashflow_scenario', this.findBestScenario(message, role, 'advanced_cashflow_scenario'), 'keyword_advanced_cashflow_scenario');
    }
    if (this.isScenarioAnalysisRequest(normalizedMessage)) {
      return this.buildContextRoute('scenario_analysis', this.findBestScenario(message, role, 'scenario_analysis'), 'keyword_scenario_analysis');
    }
    if (this.isReceivablesCollectionPriorityRequest(normalizedMessage)) {
      return this.buildContextRoute('receivables_collection_priority', this.findBestScenario(message, role, 'receivables_collection_priority'), 'keyword_receivables_collection_priority');
    }
    if (this.isSupplierPaymentPriorityRequest(normalizedMessage)) {
      return this.buildContextRoute('supplier_payment_priority', this.findBestScenario(message, role, 'supplier_payment_priority'), 'keyword_supplier_payment_priority');
    }
    if (this.isTokenHealthCheckRequest(normalizedMessage)) {
      return this.buildContextRoute('token_health_check', this.findBestScenario(message, role, 'token_health_check'), 'keyword_token_health_check');
    }
    if (this.isFanpagePermissionCheckRequest(normalizedMessage)) {
      return this.buildContextRoute('fanpage_permission_check', this.findBestScenario(message, role, 'fanpage_permission_check'), 'keyword_fanpage_permission_check');
    }
    if (this.isPlatformSyncHealthRequest(normalizedMessage)) {
      return this.buildContextRoute('platform_sync_health', this.findBestScenario(message, role, 'platform_sync_health'), 'keyword_platform_sync_health');
    }
    if (this.isOpenAiConfigHealthRequest(normalizedMessage)) {
      return this.buildContextRoute('openai_config_health', this.findBestScenario(message, role, 'openai_config_health'), 'keyword_openai_config_health');
    }
    if (this.isWebhookFailureRequest(normalizedMessage)) {
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

    const inferredIntent = this.intentFromTextOrRole(message, role);
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
    const addOrders = () => add('orders', () => this.buildOrderSnapshot(startDate, now));
    const addReturns = () => add('returns', () => this.buildReturnSnapshot(startDate, now));
    const addReceivables = () => add('receivables', () => this.buildReceivablesSnapshot(now));
    const addOperations = () => add('ops-actions', () => this.opsActionService.getActionSuggestions());
    const addToken = () => add('token-management', () => this.getTokenManagement());
    const addApiTokens = () => add('api-tokens', () => this.buildApiTokenSnapshot());
    const addEmployeeKpi = () => add('employee-ads-kpi', () => this.buildEmployeeAdsKpiSnapshot(startDate, now));
    const addAdsSyncHealth = () => add('advertising-cost.sync-health', () => this.buildAdsSyncHealthSnapshot());
    const addAdsCostByAdGroup = () => add('advertising-cost.by-adgroup', () => this.buildAdvertisingCostByAdGroupSnapshot(startDate, now));
    const addCostPerOrder = () => add('ad-report.cost-per-order', () => this.buildCostPerOrderSnapshot(startDate, now));
    const addAdGroupProfitClassification = () => add('ads.ad-group-profit-classification', () =>
      this.profitReportService.getAdGroupProfitClassification({ days: windowDays, startDate, endDate: now }),
    );
    const addAdsDiagnostic = () => add('ads.diagnostic-overview', () => this.buildAdsDiagnosticOverview(startDate, now, windowDays));
    const addDirectorFinanceDepth = () => {
      add('finance.funds-overview', () => this.getFinanceFundsOverview());
      add('finance.available-fund-current', () => this.buildAvailableFundSnapshot());
      add('loan-management.dashboard', () => this.getLoanDashboard());
      add('owner-fund.summary', () => this.buildOwnerFundSnapshot());
      add('cost.labor-summary', () => this.buildLaborCashflowSnapshot(now, windowDays));
      add('cost.other-summary', () => this.buildOtherCostCashflowSnapshot(now, windowDays));
      add('ads.cost-summary', () => this.buildAdsCostCashflowSnapshot(startDate, now));
    };
    const addBudgetPreview = () => add('budget-allocation.preview', () => this.getBudgetAllocationPreview());
    const addAiMarketing = () => {
      add('ai-marketing.overview', () => this.getAiMarketingOverview(windowDays));
      add('ai-marketing.decision', () => this.buildMarketingDecisionSnapshot(windowDays));
      add('ai-marketing.plans', () => this.getAiMarketingPlans());
      add('ai-marketing.evaluations', () => this.getAiMarketingEvaluations());
    };
    const addQuoteReadiness = () => add('quotes.readiness', () => this.buildQuoteReadinessSnapshot(now));
    const addAccessAudit = () => add('access.audit', () => this.buildAccessAuditSnapshot());
    const addSalesSupport = () => {
      add('sales-products', () => this.buildProductSalesSnapshot());
      add('sales-customers', () => this.buildCustomerSnapshot());
      add('sales-pending-orders', () => this.buildPendingOrderSnapshot());
    };
    const addBusinessFacts = () => add('business-facts', () => this.buildBusinessFactsSnapshot(windowDays, now));
    const addPendingOrders = () => add('sales-pending-orders', () => this.buildPendingOrderSnapshot());
    const addChatSupport = () => add('chat-conversations', () => this.buildConversationSnapshot());
    const addMediaSupport = () => add('media-assets', () => this.buildMediaSnapshot());
    const addAdsEntities = () => {
      add('ad-groups', () => this.buildAdGroupSnapshot());
      add('ad-accounts', () => this.buildAdAccountSnapshot());
      add('fanpages', () => this.buildFanpageSnapshot());
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
          add('sales-products', () => this.buildProductSalesSnapshot());
          break;
        case 'sales-customers':
          add('sales-customers', () => this.buildCustomerSnapshot());
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
    const performance = this.asArray(sources['ad-group-profit-report.performance']?.data);
    const suggestions = this.asArray(sources['ad-group-profit-report.optimal-spend']?.data);
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
    const normalized = this.removeVietnameseTone(String(endpoint || '').replace(/^MISSING\s+/, '').replace(/\?.*$/, '')).toLowerCase();
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
    const direct = this.asArray(playbook).filter((group: any) => this.asArray(group.defaultIntents).includes(intent));
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
    return this.asArray(playbook).filter((group: any) => groups.includes(group.groupId));
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
    const normalized = this.removeVietnameseTone(message || '').toLowerCase();
    if (!normalized.trim()) return null;

    const candidates = SCENARIO_WORKFLOWS.filter((scenario) => {
      if (role && !scenario.roles.some((candidate) => this.roleAliasMatches(role, candidate))) return false;
      return !intent || this.intentFromScenario(scenario, role) === intent || intent === 'loose';
    });

    let best: ScenarioWorkflow | null = null;
    let bestScore = 0;
    const words = normalized.split(/[^a-z0-9]+/).filter((word) => word.length >= 4);
    for (const scenario of candidates.length ? candidates : SCENARIO_WORKFLOWS) {
      const haystack = this.removeVietnameseTone([
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
    const text = this.removeVietnameseTone(`${scenario.scenarioId} ${scenario.title} ${scenario.goal}`).toLowerCase();
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
    return this.intentFromTextOrRole('', role);
  }

  private isRootCauseAnalysisRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasExplicitWhy = ['vi sao', 'tai sao', 'nguyen nhan'].some((term) => normalized.includes(term));
    const hasDoDau = normalized.includes('do dau');
    const hasBusinessTopic = [
      'doanh thu',
      'loi nhuan',
      'lead',
      'don',
      'ads',
      'quang cao',
      'dong tien',
      'chi phi',
      'google',
      'facebook',
      'sale',
      'san pham',
    ].some((term) => normalized.includes(term));
    const classicLeadFunnelQuestion = normalized.includes('lead') && normalized.includes('don khong tang');
    if (classicLeadFunnelQuestion && !hasExplicitWhy) return false;
    return (hasExplicitWhy || hasDoDau) && hasBusinessTopic;
  }

  private isAnomalyDetectionRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasAnomaly = ['bat thuong', 'dot ngot', 'tu nhien', 'giam manh', 'tang bat thuong', 'xau dot ngot'].some((term) => normalized.includes(term));
    const hasScope = ['hom nay', 'chi so', 'bo phan', 'hieu suat', 'khoan chi', 'san pham', 'nhom quang cao', 'sale', 'khach hang'].some((term) => normalized.includes(term));
    return hasAnomaly && hasScope;
  }

  private isPriorityRankingRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasPriority = ['uu tien', 'xu ly 3 viec', '3 viec', 'viec nao anh huong tien', 'thiet hai lon nhat', 'can thiep truoc', 'tap trung vao'].some((term) => normalized.includes(term));
    const hasDecisionScope = ['hom nay', 'truoc', 'viec', 'bo phan', 'ads', 'sale', 'don hang', 'cong no', 'toi phai tu quyet'].some((term) => normalized.includes(term));
    return hasPriority && hasDecisionScope;
  }

  private isResourceAllocationDecisionRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasDecision = ['co nen', 'nen'].some((term) => normalized.includes(term));
    const hasResource = [
      'tuyen them sale',
      'tang nguoi',
      'xu ly don',
      'nhap them hang',
      'dung nhap',
      'don tien',
      'mo them kenh',
      'giam ngan sach',
      'tang nguon luc',
      'giam nguon luc',
    ].some((term) => normalized.includes(term));
    return hasDecision && hasResource;
  }

  private isOwnerAccountabilityRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasWho = ['ai dang', 'ai can', 'ai xu ly', 'ai de', 'nguoi phu trach', 'bo phan nao'].some((term) => normalized.includes(term));
    const hasAccountability = ['cham', 'ton nhieu task', 'ton viec', 'kem nhat', 'tot nhat', 'thuong', 'dao tao', 'thieu trach nhiem', 'khong ro', 'keo lui', 'ket qua'].some((term) => normalized.includes(term));
    return hasWho && hasAccountability;
  }

  private isChannelProfitabilityRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasChannel = ['kenh', 'facebook', 'google', 'tiktok', 'zalo', 'channel', 'platform'].some((term) => normalized.includes(term));
    const hasProfitability = ['loi nhuan', 'hieu qua nhat', 'chat luong thap', 'khach mua tot', 'tang dau tu', 'nen giam', 'chi phi tang bat thuong'].some((term) => normalized.includes(term));
    return hasChannel && hasProfitability;
  }

  private isProductDecisionReviewRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasProduct = normalized.includes('san pham') || normalized.includes('product');
    const hasDecision = [
      'nen day manh',
      'nen day',
      'nen dung',
      'dung nhap',
      'ban nhieu nhung lai thap',
      'it ban nhung lai cao',
      'lam moi',
      'kiem tien chinh',
      'nen chay remarketing',
      'nen tang gia',
      'nen giam gia',
      'hut khach',
    ].some((term) => normalized.includes(term));
    return hasProduct && hasDecision;
  }

  private isCustomerValueAnalysisRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasCustomer = ['khach hang', 'khach nao', 'nhom khach', 'tep khach', 'customer'].some((term) => normalized.includes(term));
    const hasValue = ['gia tri cao', 'mua lai', 'ltv', 'roi bo', 'no tien', 'mua nhieu nhung loi nhuan thap', 'remarketing', 'upsell', 'hoan/huy', 'cham soc lai'].some((term) => normalized.includes(term));
    return hasCustomer && hasValue;
  }

  private isAdvancedCashflowScenarioRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasCash = ['dong tien', 'tien', 'cash', 'free cash'].some((term) => normalized.includes(term));
    const hasAdvanced = ['ket o dau', 'nam o', 'ton kho', 'cong no', 'don chua thu', 'giu tien hay scale', 'doanh thu giam 20', 'khach cham tra', 'hoan chi', 'bat buoc phai tra'].some((term) => normalized.includes(term));
    return hasCash && hasAdvanced;
  }

  private isTargetGapAnalysisRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasTarget = ['muc tieu', 'kpi', 'dat target', 'dat muc tieu'].some((term) => normalized.includes(term));
    const hasGap = ['thang nay', 'con thieu', 'toc do hien tai', 'can lam gi', 'bao nhieu don/ngay', 'bao nhieu lead', 'keo lui'].some((term) => normalized.includes(term));
    return hasTarget && hasGap;
  }

  private isPeriodComparisonRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasCompare = ['so voi', 'tot len', 'xau di', 'kem di', 'tuan nay', 'thang nay', 'cung ky'].some((term) => normalized.includes(term));
    const hasPeriod = ['hom qua', 'tuan truoc', 'thang truoc', 'nam ngoai', 'doanh thu', 'loi nhuan', 'ads', 'sale'].some((term) => normalized.includes(term));
    return hasCompare && hasPeriod;
  }

  private isScenarioAnalysisRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    if (!normalized.startsWith('neu ') && !normalized.includes(' neu ')) return false;
    const hasScenario = ['giam gia', 'tang gia', 'tuyen them', 'nhap them hang', 'dung san pham', 'anh huong doanh thu', 'hoa von', 'thu hoi von', 'can bao nhieu'].some((term) => normalized.includes(term));
    return hasScenario;
  }

  private isAiRecommendationReviewRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasAi = ['ai de xuat', 'de xuat ai', 'theo de xuat', 'playbook'].some((term) => normalized.includes(term));
    const hasReview = ['hom qua', 'da lam chua', 'ket qua the nao', 'hieu qua', 'sai', 'bai hoc', 'can sua', 'da lam duoc gi'].some((term) => normalized.includes(term));
    const hasAdsAfterAction = normalized.includes('sau khi') && normalized.includes('chinh ads');
    return (hasAi && hasReview) || hasAdsAfterAction;
  }

  private isConciseRoleBriefingRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasBrief = ['tom tat', 'ngan gon', '5 dong', 'chi noi', 'ban danh cho'].some((term) => normalized.includes(term));
    const hasScope = ['hom nay', 'tinh hinh', 'viec', 'van de', 'giam doc', 'quan ly sale', 'ke toan', 'nghiem trong', 'can toi quyet'].some((term) => normalized.includes(term));
    return hasBrief && hasScope;
  }

  private isDecisionWaitingApprovalRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasApproval = ['cho toi duyet', 'cho duyet', 'can toi duyet', 'can duyet', 'phe duyet', 'approve', 'approval'].some((term) => normalized.includes(term));
    const hasDecision = ['quyet', 'xu ly', 'ke hoach', 'khoan chi', 'don', 'hop dong', 'task', 'de xuat', 'viec'].some((term) => normalized.includes(term));
    return hasApproval && hasDecision;
  }

  private isBusinessRiskRankingRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasRisk = ['rui ro', 'van de', 'van de lon', 'van de nhat', 'xau di', 'nguy hiem', 'bo phan nao dang co van de'].some((term) => normalized.includes(term));
    const hasCompanyScope = ['cong ty', 'hom nay', 'bo phan', 'tinh hinh', 'can chu y'].some((term) => normalized.includes(term));
    return hasRisk && hasCompanyScope;
  }

  private isCompanyKpiScorecardRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    if (normalized.includes('company_kpi_scorecard')) return true;
    const hasKpi = ['doanh thu', 'loi nhuan', 'kpi', 'muc tieu', 'phan tram muc tieu', 'dat bao nhieu phan tram', 'tinh hinh tot len', 'tinh hinh xau di'].some((term) => normalized.includes(term));
    const hasPeriod = ['hom nay', 'hom qua', 'thang nay', 'tuan nay', 'so voi', 'dang the nao', 'bao nhieu'].some((term) => normalized.includes(term));
    return hasKpi && hasPeriod;
  }

  private isExecutiveDailyOverviewRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasDaily = ['hom nay', 'dau ngay', 'sang nay', 'trong ngay'].some((term) => normalized.includes(term));
    const hasExecutiveQuestion = [
      'cong ty',
      'viec gi can',
      'can toi xu ly',
      'viec nao dang nong',
      'viec nong',
      'tong quan',
      'tinh hinh',
    ].some((term) => normalized.includes(term));
    return hasDaily && hasExecutiveQuestion;
  }

  private isProductPerformanceQuestion(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasProduct = normalized.includes('san pham') || normalized.includes('product');
    const hasPerformance = [
      'ban chay',
      'ban nhieu',
      'ban cham',
      'lai nhat',
      'dang lo',
      'ton kho',
      'sap het hang',
      'nen day quang cao',
      'nen dung nhap',
      'ty le hoan',
      'ty le huy',
      'hoan/huy cao',
      'refund risk',
      'stock risk',
    ].some((term) => normalized.includes(term));
    return hasProduct && hasPerformance;
  }

  private isCustomerValueOrCareRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasCustomer = ['khach hang', 'khach nao', 'khach', 'customer'].some((term) => normalized.includes(term));
    const hasCareOrValue = [
      'mua nhieu',
      'gia tri cao',
      'lau roi chua mua',
      'khieu nai',
      'cham soc lai',
      'remarketing',
      'tep khach',
      'ltv',
      'nguon khach',
    ].some((term) => normalized.includes(term));
    return hasCustomer && hasCareOrValue;
  }

  private isPeoplePerformanceRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    if (['tao task', 'lap task', 'create task', 'bulk create', 'lead', 'sale', 'sales'].some((term) => normalized.includes(term))) return false;
    const hasPeopleScope = ['nhan vien', 'bo phan', 'ai dang', 'workload', 'task'].some((term) => normalized.includes(term));
    const hasPerformance = [
      'ton viec',
      'xu ly cham',
      'qua han',
      'hoan thanh',
      'tot nhat',
      'chua co nguoi phu trach',
      'can nhac viec',
      'kpi',
    ].some((term) => normalized.includes(term));
    return hasPeopleScope && hasPerformance;
  }

  private isAdsScaleReadinessRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasAds = ['ads', 'quang cao', 'nhom', 'ad group', 'adset'].some((term) => normalized.includes(term));
    const hasScale = ['co nen tang', 'nen tang', 'tang ngan sach', 'scale', 'du dieu kien tang', 'duoc tang'].some((term) => normalized.includes(term));
    return hasAds && hasScale;
  }

  private isAdsKillOrPauseRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasAds = ['ads', 'quang cao', 'camp', 'campaign', 'nhom', 'ad group', 'adset'].some((term) => normalized.includes(term));
    const hasWaste = ['dot tien', 'dang lo', 'nen tat', 'tam dung', 'pause', 'kill', 'spend nhung khong ra don', 'co spend nhung khong ra don'].some((term) => normalized.includes(term));
    return hasAds && hasWaste;
  }

  private isChannelMixReviewRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasChannel = ['facebook', 'google', 'tiktok', 'kenh nao', 'channel', 'platform'].some((term) => normalized.includes(term));
    const hasCompare = ['hieu qua hon', 'tot hon', 'loi nhuan tot nhat', 'mang lai loi nhuan', 'roi tot', 'so sanh'].some((term) => normalized.includes(term));
    return hasChannel && hasCompare;
  }

  private isLeadFollowupHealthRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasLead = ['lead', 'khach nong', 'khach nao nong', 'hoi thoai', 'inbox'].some((term) => normalized.includes(term));
    const hasFollowup = ['chua xu ly', 'bo quen', 'can goi', 'goi ngay', 'chua goi', 'cham soc', 'follow up', 'followup'].some((term) => normalized.includes(term));
    return hasLead && hasFollowup;
  }

  private isSalesSlaViolationRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasSales = ['sale', 'nhan vien sale', 'tu van'].some((term) => normalized.includes(term));
    const hasSlow = ['phan hoi cham', 'xu ly cham', 'chua goi', 'qua han', 'sla', 'bo quen'].some((term) => normalized.includes(term));
    return hasSales && hasSlow;
  }

  private isSalesConversionByUserRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasSales = ['sale', 'nhan vien sale'].some((term) => normalized.includes(term));
    const hasConversion = ['chot tot', 'chot tot nhat', 'ty le chot', 'conversion', 'dang yeu'].some((term) => normalized.includes(term));
    return hasSales && hasConversion;
  }

  private isLeadQualityBySourceRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasLeadSource = ['nguon lead', 'nguon khach', 'lead source', 'source'].some((term) => normalized.includes(term));
    const hasQuality = ['chat luong', 'tot nhat', 'nhieu nhung khong ra don', 'khong ra don', 'loi nhuan tot'].some((term) => normalized.includes(term));
    return hasLeadSource && hasQuality;
  }

  private isAdGroupProfitClassificationRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    if (normalized.includes('ad_group_profit_classification') || normalized.includes('profit classification')) return true;
    const adGroupTerms = [
      'nhom quang cao',
      'ad group',
      'adgroup',
      'ad set',
      'adset',
      'campaign',
    ];
    const classificationTerms = [
      'bao nhieu',
      'dem',
      'phan loai',
      'lai',
      'lo',
      'hoa von',
      'chua du du lieu',
      'du lieu',
      'doanh thu',
      'loi nhuan',
      'net profit',
      'profit after ads',
      'net profit after ads',
      'spend nhung khong co don',
    ];
    const hasAdGroup = adGroupTerms.some((term) => normalized.includes(term));
    const score = classificationTerms.filter((term) => normalized.includes(term)).length;
    return hasAdGroup && score >= 1;
  }

  private isAdsBudgetCashflowGateRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    if (normalized.includes('ads_budget_cashflow_gate') || normalized.includes('cashflow gate')) return true;
    const hasAdsBudget = ['ads', 'quang cao', 'ngan sach', 'budget', 'scale'].some((term) => normalized.includes(term));
    const hasCashQuestion = ['du tien', 'co tien', 'dong tien', 'free cash', 'tien tu do', 'cashflow', 'tang them'].some((term) => normalized.includes(term));
    const hasDecision = ['co nen', 'duoc tang', 'tang ads', 'scale', 'proposedincrease', 'tang them'].some((term) => normalized.includes(term));
    return hasAdsBudget && hasCashQuestion && hasDecision;
  }

  private isMarketingFunnelHealthRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    if (normalized.includes('marketing_funnel_health') || normalized.includes('funnel')) return true;
    const hasLead = ['lead', 'inbox', 'form', 'khach tiem nang'].some((term) => normalized.includes(term));
    const hasOrderIssue = ['don khong tang', 'khong ra don', 'ty le chot', 'chot don', 'conversion'].some((term) => normalized.includes(term));
    return hasLead && hasOrderIssue;
  }

  private isCreativeFatigueRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    if (normalized.includes('creative_fatigue_review') || normalized.includes('creative fatigue')) return true;
    const hasCreative = ['creative', 'mau quang cao', 'content', 'noi dung', 'asset'].some((term) => normalized.includes(term));
    const hasFatigue = ['met', 'giam hieu qua', 'yeu', 'frequency', 'ctr', 'cpc', 'cpl', 'can thay'].some((term) => normalized.includes(term));
    return hasCreative && hasFatigue;
  }

  private isOfferPerformanceRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    if (normalized.includes('offer_performance_review')) return true;
    const hasOffer = ['offer', 'khuyen mai', 'uu dai', 'san pham'].some((term) => normalized.includes(term));
    const hasQuestion = ['yeu', 'hieu qua', 'lead nhung khong chot', 'khong chot', 'tot nhat'].some((term) => normalized.includes(term));
    return hasOffer && hasQuestion;
  }

  private isSalesSlaTaskCreationRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    if (normalized.includes('sales_sla_task_creation')) return true;
    const hasTask = ['tao task', 'lap task', 'giao viec', 'create task'].some((term) => normalized.includes(term));
    const hasLeadSla = ['lead', 'qua han', 'chua goi', 'sla', 'sale'].some((term) => normalized.includes(term));
    return hasTask && hasLeadSla;
  }

  private isLateOrderDiagnosticRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasOrder = ['don', 'order'].some((term) => normalized.includes(term));
    const hasLate = ['tre', 'qua han', 'cham', 'late', 'delay'].some((term) => normalized.includes(term));
    return hasOrder && hasLate;
  }

  private isFulfillmentBottleneckRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasBottleneck = ['nghen', 'bottleneck', 'khau nao', 'xu ly cham', 'bo phan nao'].some((term) => normalized.includes(term));
    const hasOps = ['sale', 'kho', 'giao hang', 'nha cung cap', 'supplier', 'van hanh', 'don'].some((term) => normalized.includes(term));
    return hasBottleneck && hasOps;
  }

  private isTrackingIssueRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    return normalized.includes('tracking') && ['thieu', 'loi', 'chua co', 'sai'].some((term) => normalized.includes(term));
  }

  private isCancelRefundRiskRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasOrder = ['don', 'order', 'khach'].some((term) => normalized.includes(term));
    const hasRisk = ['nguy co bi huy', 'huy', 'hoan', 'refund', 'khieu nai', 'phan nan'].some((term) => normalized.includes(term));
    return hasOrder && hasRisk;
  }

  private isCashflowForecastRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasCash = ['tien', 'dong tien', 'cash', 'free cash'].some((term) => normalized.includes(term));
    const hasForecast = ['7 ngay', 'bay ngay', 'tuan toi', 'ngay toi', 'du tien chi', 'du tien tra', 'forecast', 'du bao'].some((term) => normalized.includes(term));
    return hasCash && hasForecast;
  }

  private isReceivablesCollectionPriorityRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasDebt = ['cong no', 'phai thu', 'khoan no', 'khach no'].some((term) => normalized.includes(term));
    const hasCollect = ['can thu ngay', 'thu ngay', 'qua han', 'lau nhat', 'tuoi no', 'mat kha nang thu'].some((term) => normalized.includes(term));
    return hasDebt && hasCollect;
  }

  private isSupplierPaymentPriorityRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasSupplier = ['nha cung cap', 'ncc', 'supplier', 'phai tra'].some((term) => normalized.includes(term));
    const hasPayment = ['can tra truoc', 'phai tra', 'den han', 'uu tien tra', 'tra truoc'].some((term) => normalized.includes(term));
    return hasSupplier && hasPayment;
  }

  private isTokenHealthCheckRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasToken = normalized.includes('token');
    const hasHealth = ['loi', 'het han', 'invalid', 'error', 'health', 'co loi khong', 'con han'].some((term) => normalized.includes(term));
    return hasToken && hasHealth;
  }

  private isFanpagePermissionCheckRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasFanpage = normalized.includes('fanpage') || normalized.includes('page');
    const hasPermission = ['mat ket noi', 'thieu quyen', 'permission', 'quyen', 'khong co quyen', 'access'].some((term) => normalized.includes(term));
    return hasFanpage && hasPermission;
  }

  private isPlatformSyncHealthRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasSync = ['sync', 'dong bo', 'du lieu chua dong bo'].some((term) => normalized.includes(term));
    const hasPlatform = ['facebook', 'google', 'tiktok', 'ads', 'quang cao', 'platform'].some((term) => normalized.includes(term));
    return hasSync && hasPlatform;
  }

  private isOpenAiConfigHealthRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    const hasOpenAi = normalized.includes('openai') || normalized.includes('ai api') || normalized.includes('api key');
    const hasHealth = ['hoat dong', 'binh thuong', 'loi', 'config', 'cau hinh', 'key'].some((term) => normalized.includes(term));
    return hasOpenAi && hasHealth;
  }

  private isWebhookFailureRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    return normalized.includes('webhook') && ['loi', 'fail', 'failure', 'error', 'khong nhan'].some((term) => normalized.includes(term));
  }

  private isAdsDiagnosticChecklistRequest(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.trim()) return false;
    if (normalized.includes('ads_diagnostic_checklist') || normalized.includes('diagnostic ads') || normalized.includes('chan doan quang cao')) {
      return true;
    }
    const adsTerms = [
      'quang cao',
      'ads',
      'ad account',
      'tai khoan quang cao',
      'fanpage',
      'campaign',
      'adset',
      'ad set',
      'spend',
      'lead',
      'inbox',
      'form',
      'attribution',
      'doanh thu',
      'loi nhuan',
      'lo lai',
      'ngan sach',
      'provider',
    ];
    const diagnosticTerms = [
      'kiem tra',
      'da kiem tra',
      'co bao nhieu',
      'con han',
      'thieu quyen',
      'dong bo',
      'sync',
      'loi',
      'error',
      'active',
      'paused',
      'gan nhat',
      'tong spend',
      'du dieu kien',
      'tang',
      'giam',
      'checklist',
    ];
    const adScore = adsTerms.filter((term) => normalized.includes(term)).length;
    const diagnosticScore = diagnosticTerms.filter((term) => normalized.includes(term)).length;
    return adScore >= 2 && diagnosticScore >= 2;
  }

  private isProductAdsRevenueRatioQuestion(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    const hasAds = ['ads', 'quang cao', 'chi phi ads', 'ad spend', 'spend'].some((term) => normalized.includes(term));
    const hasRevenue = ['doanh thu', 'revenue'].some((term) => normalized.includes(term));
    const hasRatio = ['%', 'phan tram', 'chiem bao nhieu', 'chiem'].some((term) => normalized.includes(term));
    return hasAds && hasRevenue && hasRatio && (normalized.includes('san pham') || normalized.includes('product'));
  }

  private isAdsProductProfitQuestion(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    const hasAds = ['ads', 'quang cao', 'spend'].some((term) => normalized.includes(term));
    const hasProduct = normalized.includes('san pham') || normalized.includes('product');
    const hasProfit = ['loi nhuan', 'lai', 'profit', 'net profit'].some((term) => normalized.includes(term));
    const hasRank = ['cao nhat', 'tot nhat', 'nhat', 'top', 'lai nhat'].some((term) => normalized.includes(term));
    return hasAds && hasProduct && hasProfit && hasRank;
  }

  private isProductProfitLeaderboardQuestion(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    const hasProduct = normalized.includes('san pham') || normalized.includes('product');
    const hasProfit = ['loi nhuan', 'lai', 'profit'].some((term) => normalized.includes(term));
    const hasPeriodOrRank = ['tuan', 'thang', 'cao nhat', 'tot nhat', 'nhat', 'top', 'vua roi'].some((term) => normalized.includes(term));
    return hasProduct && hasProfit && hasPeriodOrRank;
  }

  private isProductCountQuestion(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    const hasProduct = normalized.includes('san pham') || normalized.includes('product');
    const asksCount = ['bao nhieu', 'so luong', 'tong so', 'hien tai co', 'dem'].some((term) => normalized.includes(term));
    const asksList = ['nhung san pham gi', 'co nhung', 'danh sach', 'liet ke'].some((term) => normalized.includes(term));
    return hasProduct && asksCount && !asksList;
  }

  private isProductListQuestion(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    const hasProduct = normalized.includes('san pham') || normalized.includes('product');
    const asksList = ['nhung san pham gi', 'co nhung', 'danh sach', 'liet ke', 'san pham gi'].some((term) => normalized.includes(term));
    return hasProduct && asksList;
  }

  private isChatbotFanpagePerformanceQuestion(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    return normalized.includes('chatbot') && normalized.includes('fanpage') && ['tot', 'hieu qua', 'hoat dong'].some((term) => normalized.includes(term));
  }

  private isFanpagePerformanceQuestion(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    if (!normalized.includes('fanpage')) return false;
    if (['mat ket noi', 'ket noi', 'thieu quyen', 'permission', 'quyen', 'loi', 'disconnect', 'access'].some((term) => normalized.includes(term))) return false;
    return ['bao nhieu', 'tong so', 'hoat dong tot', 'hieu qua', 'tot nhat', 'fanpage nao'].some((term) => normalized.includes(term));
  }

  private isAgentRevenueLeaderboardQuestion(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    const hasAgent = normalized.includes('dai ly') || normalized.includes('agent');
    const hasRevenue = normalized.includes('doanh thu') || normalized.includes('revenue');
    const hasRank = ['cao nhat', 'nhat', 'top', 'tot nhat'].some((term) => normalized.includes(term));
    return hasAgent && hasRevenue && hasRank;
  }

  private isAgentProfitLeaderboardQuestion(value: string): boolean {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase();
    const hasAgent = normalized.includes('dai ly') || normalized.includes('agent');
    const hasProfit = ['loi nhuan', 'lai', 'profit'].some((term) => normalized.includes(term));
    const hasRank = ['cao nhat', 'nhat', 'top', 'tot nhat'].some((term) => normalized.includes(term));
    return hasAgent && hasProfit && hasRank;
  }

  private intentFromTextOrRole(message: string, role?: string): AiOperatorIntent {
    const normalized = this.removeVietnameseTone(`${message || ''} ${role || ''}`).toLowerCase();
    if (this.isConciseRoleBriefingRequest(normalized)) return 'concise_role_briefing';
    if (this.isAiRecommendationReviewRequest(normalized)) return 'ai_recommendation_review';
    if (this.isRootCauseAnalysisRequest(normalized)) return 'root_cause_analysis';
    if (this.isAnomalyDetectionRequest(normalized)) return 'anomaly_detection_daily';
    if (this.isPriorityRankingRequest(normalized)) return 'priority_ranking';
    if (this.isTargetGapAnalysisRequest(normalized)) return 'target_gap_analysis';
    if (this.isPeriodComparisonRequest(normalized)) return 'period_comparison';
    if (this.isProductAdsRevenueRatioQuestion(normalized)) return 'product_ads_revenue_ratio';
    if (this.isAdsProductProfitQuestion(normalized)) return 'ads_product_profit_leaderboard';
    if (this.isProductDecisionReviewRequest(normalized)) return 'product_decision_review';
    if (this.isProductPerformanceQuestion(normalized)) return 'product_profit_leaderboard';
    if (this.isProductProfitLeaderboardQuestion(normalized)) return 'product_profit_leaderboard';
    if (this.isProductCountQuestion(normalized)) return 'product_count';
    if (this.isProductListQuestion(normalized)) return 'product_list';
    if (this.isChatbotFanpagePerformanceQuestion(normalized)) return 'chatbot_fanpage_performance_lookup';
    if (this.isFanpagePerformanceQuestion(normalized)) return 'fanpage_performance_lookup';
    if (this.isCustomerValueAnalysisRequest(normalized)) return 'customer_value_analysis';
    if (this.isCustomerValueOrCareRequest(normalized)) return 'sales';
    if (this.isAgentRevenueLeaderboardQuestion(normalized)) return 'agent_revenue_leaderboard';
    if (this.isAgentProfitLeaderboardQuestion(normalized)) return 'agent_profit_leaderboard';
    if (this.isDecisionWaitingApprovalRequest(normalized)) return 'decision_waiting_approval';
    if (this.isBusinessRiskRankingRequest(normalized)) return 'business_risk_ranking';
    if (this.isCompanyKpiScorecardRequest(normalized)) return 'company_kpi_scorecard';
    if (this.isExecutiveDailyOverviewRequest(normalized)) return 'director_daily_overview';
    if (this.isOwnerAccountabilityRequest(normalized)) return 'owner_accountability_review';
    if (this.isPeoplePerformanceRequest(normalized)) return 'operations';
    if (this.isAdGroupProfitClassificationRequest(normalized)) return 'ad_group_profit_classification';
    if (this.isAdsBudgetCashflowGateRequest(normalized)) return 'ads_budget_cashflow_gate';
    if (this.isAdsScaleReadinessRequest(normalized)) return 'ads_scale_readiness';
    if (this.isAdsKillOrPauseRequest(normalized)) return 'ads_kill_or_pause_recommendation';
    if (this.isChannelProfitabilityRequest(normalized)) return 'channel_profitability_review';
    if (this.isChannelMixReviewRequest(normalized)) return 'channel_mix_review';
    if (this.isResourceAllocationDecisionRequest(normalized)) return 'resource_allocation_decision';
    if (this.isSalesSlaTaskCreationRequest(normalized)) return 'sales_sla_task_creation';
    if (this.isSalesSlaViolationRequest(normalized)) return 'sales_sla_violation';
    if (this.isLeadQualityBySourceRequest(normalized)) return 'lead_quality_by_source';
    if (this.isSalesConversionByUserRequest(normalized)) return 'sales_conversion_by_user';
    if (this.isLeadFollowupHealthRequest(normalized)) return 'lead_followup_health';
    if (this.isMarketingFunnelHealthRequest(normalized)) return 'marketing_funnel_health';
    if (this.isCreativeFatigueRequest(normalized)) return 'creative_fatigue_review';
    if (this.isOfferPerformanceRequest(normalized)) return 'offer_performance_review';
    if (this.isAdsDiagnosticChecklistRequest(normalized)) return 'ads_diagnostic_checklist';
    if (this.isLateOrderDiagnosticRequest(normalized)) return 'late_order_diagnostic';
    if (this.isFulfillmentBottleneckRequest(normalized)) return 'fulfillment_bottleneck';
    if (this.isTrackingIssueRequest(normalized)) return 'tracking_issue_check';
    if (this.isCancelRefundRiskRequest(normalized)) return 'cancel_refund_risk';
    if (this.isCashflowForecastRequest(normalized)) return 'cashflow_forecast';
    if (this.isAdvancedCashflowScenarioRequest(normalized)) return 'advanced_cashflow_scenario';
    if (this.isScenarioAnalysisRequest(normalized)) return 'scenario_analysis';
    if (this.isReceivablesCollectionPriorityRequest(normalized)) return 'receivables_collection_priority';
    if (this.isSupplierPaymentPriorityRequest(normalized)) return 'supplier_payment_priority';
    if (this.isTokenHealthCheckRequest(normalized)) return 'token_health_check';
    if (this.isFanpagePermissionCheckRequest(normalized)) return 'fanpage_permission_check';
    if (this.isPlatformSyncHealthRequest(normalized)) return 'platform_sync_health';
    if (this.isOpenAiConfigHealthRequest(normalized)) return 'openai_config_health';
    if (this.isWebhookFailureRequest(normalized)) return 'webhook_failure_diagnostic';
    if (normalized.includes('free cash') || normalized.includes('tien tu do')) return 'free_cash_summary';
    if (normalized.includes('du bao dong tien') || normalized.includes('forecast')) return 'cashflow_forecast';
    if (normalized.includes('unit economics') || normalized.includes('allowable cac')) return 'unit_economics';
    if (normalized.includes('scale readiness') || normalized.includes('du dieu kien scale')) return 'ads_scale_readiness';
    if (normalized.includes('ads') || normalized.includes('quang cao') || normalized.includes('roi') || normalized.includes('budget')) return 'ads';
    if (normalized.includes('tai chinh') || normalized.includes('dong tien') || normalized.includes('cash') || normalized.includes('runway') || normalized.includes('von')) return 'finance';
    if (normalized.includes('cong no') || normalized.includes('thanh toan') || normalized.includes('hoa hong') || normalized.includes('ncc')) return 'receivables';
    if (normalized.includes('don') || normalized.includes('order') || normalized.includes('tracking') || normalized.includes('giao hang')) return 'orders';
    if (normalized.includes('sale') || normalized.includes('agent')) return 'sales';
    if (normalized.includes('supplier')) return 'supplier';
    if (normalized.includes('manager') || normalized.includes('quan ly') || normalized.includes('van hanh')) return 'operations';
    if (normalized.includes('director') || normalized.includes('giam doc')) return 'overview';
    return 'loose';
  }

  private normalizeIntent(value?: string): AiOperatorIntent | null {
    const normalized = this.removeVietnameseTone(value || '').toLowerCase().trim();
    if (
      normalized === 'ad_group_profit_classification' ||
      normalized === 'ad group profit classification' ||
      normalized === 'profit classification' ||
      normalized === 'phan loai nhom quang cao' ||
      normalized === 'lai lo nhom quang cao'
    ) {
      return 'ad_group_profit_classification';
    }
    if (
      normalized === 'ads_diagnostic_checklist' ||
      normalized === 'ads diagnostic' ||
      normalized === 'ads-diagnostic' ||
      normalized === 'diagnostic ads' ||
      normalized === 'chan doan quang cao' ||
      normalized === 'kiem tra quang cao'
    ) {
      return 'ads_diagnostic_checklist';
    }
    const aliases: Record<string, AiOperatorIntent> = {
      overview: 'overview',
      director_daily_overview: 'director_daily_overview',
      director_weekly_priority: 'director_weekly_priority',
      business_risk_ranking: 'business_risk_ranking',
      decision_waiting_approval: 'decision_waiting_approval',
      company_kpi_scorecard: 'company_kpi_scorecard',
      root_cause_analysis: 'root_cause_analysis',
      'root cause analysis': 'root_cause_analysis',
      'phan tich nguyen nhan': 'root_cause_analysis',
      anomaly_detection_daily: 'anomaly_detection_daily',
      'anomaly detection daily': 'anomaly_detection_daily',
      'bat thuong hom nay': 'anomaly_detection_daily',
      priority_ranking: 'priority_ranking',
      'priority ranking': 'priority_ranking',
      'xep hang uu tien': 'priority_ranking',
      resource_allocation_decision: 'resource_allocation_decision',
      'resource allocation decision': 'resource_allocation_decision',
      'quyet dinh nguon luc': 'resource_allocation_decision',
      owner_accountability_review: 'owner_accountability_review',
      'owner accountability review': 'owner_accountability_review',
      'trach nhiem xu ly': 'owner_accountability_review',
      finance: 'finance',
      financial: 'finance',
      cashflow: 'finance',
      free_cash_summary: 'free_cash_summary',
      free_cash: 'free_cash_summary',
      'free cash summary': 'free_cash_summary',
      'free cash': 'free_cash_summary',
      cashflow_forecast: 'cashflow_forecast',
      'cashflow forecast': 'cashflow_forecast',
      ads_budget_cashflow_gate: 'ads_budget_cashflow_gate',
      'ads budget cashflow gate': 'ads_budget_cashflow_gate',
      advanced_cashflow_scenario: 'advanced_cashflow_scenario',
      'advanced cashflow scenario': 'advanced_cashflow_scenario',
      'cashflow scenario': 'advanced_cashflow_scenario',
      target_gap_analysis: 'target_gap_analysis',
      'target gap analysis': 'target_gap_analysis',
      'phan tich gap muc tieu': 'target_gap_analysis',
      period_comparison: 'period_comparison',
      'period comparison': 'period_comparison',
      'so sanh ky': 'period_comparison',
      scenario_analysis: 'scenario_analysis',
      'scenario analysis': 'scenario_analysis',
      'phan tich neu thi': 'scenario_analysis',
      product_count: 'product_count',
      'product count': 'product_count',
      product_list: 'product_list',
      'product list': 'product_list',
      product_profit_leaderboard: 'product_profit_leaderboard',
      'product profit leaderboard': 'product_profit_leaderboard',
      product_decision_review: 'product_decision_review',
      'product decision review': 'product_decision_review',
      fanpage_performance_lookup: 'fanpage_performance_lookup',
      'fanpage performance lookup': 'fanpage_performance_lookup',
      chatbot_fanpage_performance_lookup: 'chatbot_fanpage_performance_lookup',
      'chatbot fanpage performance lookup': 'chatbot_fanpage_performance_lookup',
      agent_revenue_leaderboard: 'agent_revenue_leaderboard',
      'agent revenue leaderboard': 'agent_revenue_leaderboard',
      agent_profit_leaderboard: 'agent_profit_leaderboard',
      'agent profit leaderboard': 'agent_profit_leaderboard',
      ads_product_profit_leaderboard: 'ads_product_profit_leaderboard',
      'ads product profit leaderboard': 'ads_product_profit_leaderboard',
      product_ads_revenue_ratio: 'product_ads_revenue_ratio',
      'product ads revenue ratio': 'product_ads_revenue_ratio',
      owner_withdrawal_readiness: 'owner_withdrawal_readiness',
      'owner withdrawal readiness': 'owner_withdrawal_readiness',
      supplier_payment_priority: 'supplier_payment_priority',
      receivables_collection_priority: 'receivables_collection_priority',
      double_payment_risk: 'double_payment_risk',
      tax_cash_reserve_check: 'tax_cash_reserve_check',
      unit_economics: 'unit_economics',
      'unit economics': 'unit_economics',
      ads: 'ads',
      advertising: 'ads',
      marketing_funnel_health: 'marketing_funnel_health',
      'marketing funnel health': 'marketing_funnel_health',
      creative_fatigue_review: 'creative_fatigue_review',
      'creative fatigue review': 'creative_fatigue_review',
      offer_performance_review: 'offer_performance_review',
      'offer performance review': 'offer_performance_review',
      channel_mix_review: 'channel_mix_review',
      channel_profitability_review: 'channel_profitability_review',
      'channel profitability review': 'channel_profitability_review',
      ads_scale_readiness: 'ads_scale_readiness',
      ads_kill_or_pause_recommendation: 'ads_kill_or_pause_recommendation',
      lead_quality_by_campaign: 'lead_quality_by_campaign',
      attribution_quality_check: 'attribution_quality_check',
      orders: 'orders',
      order: 'orders',
      late_order_diagnostic: 'late_order_diagnostic',
      fulfillment_bottleneck: 'fulfillment_bottleneck',
      tracking_issue_check: 'tracking_issue_check',
      cancel_refund_risk: 'cancel_refund_risk',
      supplier_delay_risk: 'supplier_delay_risk',
      receivables: 'receivables',
      payment: 'receivables',
      operations: 'operations',
      ops: 'operations',
      token: 'token',
      token_health_check: 'token_health_check',
      fanpage_permission_check: 'fanpage_permission_check',
      platform_sync_health: 'platform_sync_health',
      openai_config_health: 'openai_config_health',
      webhook_failure_diagnostic: 'webhook_failure_diagnostic',
      api: 'api',
      sales: 'sales',
      sale: 'sales',
      customer_value_analysis: 'customer_value_analysis',
      'customer value analysis': 'customer_value_analysis',
      lead_followup_health: 'lead_followup_health',
      sales_conversion_by_user: 'sales_conversion_by_user',
      lead_quality_by_source: 'lead_quality_by_source',
      lost_reason_summary: 'lost_reason_summary',
      sales_sla_violation: 'sales_sla_violation',
      sales_sla_task_creation: 'sales_sla_task_creation',
      'sales sla task creation': 'sales_sla_task_creation',
      quote_readiness: 'quote_readiness',
      supplier: 'supplier',
      ai_recommendation_review: 'ai_recommendation_review',
      'ai recommendation review': 'ai_recommendation_review',
      'hau kiem ai': 'ai_recommendation_review',
      concise_role_briefing: 'concise_role_briefing',
      'concise role briefing': 'concise_role_briefing',
      'tom tat theo vai tro': 'concise_role_briefing',
      loose: 'loose',
    };
    return aliases[normalized] || null;
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
    return this.removeVietnameseTone(`${route.scenarioId || ''} ${route.scenarioTitle || ''} ${route.intent}`).toLowerCase();
  }

  private roleAliasMatches(requestedRole: string, candidate: string) {
    const requested = this.removeVietnameseTone(String(requestedRole || '')).toLowerCase();
    if (requested === candidate) return true;
    if (requested === 'sale' && candidate === 'sales') return true;
    if (requested === 'sales' && candidate === 'agent') return true;
    if (requested === 'agent' && candidate === 'sales') return true;
    if (requested === 'cfo' && candidate === 'accountant') return true;
    if (requested === 'accounting' && candidate === 'accountant') return true;
    return false;
  }

  private buildRecommendations(snapshot: AiOperatorSnapshot): AiOperatorRecommendation[] {
    const recommendations: AiOperatorRecommendation[] = [];
    const performance = this.asArray(snapshot.ads.performance.data);
    const losingAds = performance
      .filter((ad: any) => (ad.totalAdsSpent || 0) > 0 && ((ad.totalNetProfit || 0) < 0 || (ad.roi || 0) < 50))
      .sort((a: any, b: any) => (a.totalNetProfit || 0) - (b.totalNetProfit || 0))
      .slice(0, 5);

    losingAds.forEach((ad: any, index: number) => {
      recommendations.push({
        id: `AI-ADS-LOSS-${index + 1}`,
        type: 'ads.review_loss',
        priority: (ad.totalNetProfit || 0) < 0 ? 'high' : 'medium',
        title: `Kiem tra quang cao ${ad.adGroupName || ad.adGroupId}`,
        reason: `ROI ${this.formatPercent(ad.roi)}, loi nhuan ${this.formatMoney(ad.totalNetProfit)}, chi ads ${this.formatMoney(ad.totalAdsSpent)} trong ky.`,
        proposedAction: (ad.totalNetProfit || 0) < 0
          ? 'Tam dung hoac giam ngan sach nhom quang cao nay sau khi duoc duyet.'
          : 'Giam ngan sach/test lai noi dung truoc khi scale tiep.',
        requiresApproval: true,
        riskLevel: 'medium',
        source: {
          module: 'ad-group-profit-report',
          id: ad.adGroupId,
          linkTo: `/ad-group-profit-report?adGroupId=${encodeURIComponent(ad.adGroupId || '')}`,
        },
      });
    });

    const optimalSpend = this.asArray(snapshot.ads.optimalSpendSuggestions.data)
      .filter((item: any) => ['increase', 'decrease', 'kill'].includes(item.scaleAction))
      .slice(0, 5);

    optimalSpend.forEach((item: any, index: number) => {
      const isIncrease = item.scaleAction === 'increase';
      recommendations.push({
        id: `AI-ADS-SCALE-${index + 1}`,
        type: `ads.${item.scaleAction}`,
        priority: item.scaleAction === 'kill' ? 'high' : 'medium',
        title: `${this.labelScaleAction(item.scaleAction)} ${item.adGroupName || item.adGroupId}`,
        reason: item.reason || `ROI hien tai ${this.formatPercent(item.currentROI)}, ngan sach goi y ${this.formatMoney(item.suggestedSpend)}.`,
        proposedAction: isIncrease
          ? `Tang ngan sach trong gioi han rule, toi da toi ${this.formatMoney(item.suggestedSpend)} neu duoc duyet.`
          : `Dieu chinh ngan sach ve ${this.formatMoney(item.suggestedSpend)} neu duoc duyet.`,
        requiresApproval: true,
        riskLevel: isIncrease ? 'high' : 'medium',
        source: {
          module: 'ad-group-profit-report',
          id: item.adGroupId,
          linkTo: `/ad-group-profit-report?adGroupId=${encodeURIComponent(item.adGroupId || '')}`,
        },
      });
    });

    const financeActions = this.asArray(snapshot.finance.actions.data?.actions);
    financeActions.slice(0, 5).forEach((action: any, index: number) => {
      recommendations.push({
        id: `AI-FINANCE-${index + 1}`,
        type: `finance.${action.type || 'review'}`,
        priority: action.priority || 'medium',
        title: action.title || 'Kiem tra tai chinh',
        reason: action.reason || action.description || 'Financial Control dang co khuyen nghi can xem.',
        proposedAction: action.description || action.impact || 'Mo man hinh tai chinh de kiem tra va xu ly.',
        requiresApproval: ['critical', 'high'].includes(action.priority),
        riskLevel: action.priority === 'critical' ? 'high' : 'medium',
        source: {
          module: 'financial-control',
          id: action.id,
          linkTo: action.linkTo,
        },
      });
    });

    const budgetPreview = snapshot.strategic.budgetPreview.data;
    if (budgetPreview?.systemLocked || budgetPreview?.globalStatus === 'blocked') {
      recommendations.push({
        id: 'AI-BUDGET-CASHFLOW-LOCK',
        type: 'finance.ads_budget_locked',
        priority: 'critical',
        title: 'Tam khoa scale ads do dieu kien dong tien',
        reason: budgetPreview.recommendation || 'Budget allocation dry-run cho thay he thong dang bi khoa hoac khong du dieu kien scale.',
        proposedAction: 'Khong tang ngan sach ads; kiem tra free cash, committed cash, no den han va allocation preview truoc khi duyet.',
        requiresApproval: true,
        riskLevel: 'high',
        source: { module: 'budget-allocation', linkTo: '/budget-allocation' },
      });
    }

    const loanDashboard = snapshot.strategic.loanDashboard.data;
    if ((loanDashboard?.overdueAmount || 0) > 0 || (loanDashboard?.due14Days || 0) > 0) {
      recommendations.push({
        id: 'AI-LOAN-DUE',
        type: 'finance.loan_due',
        priority: (loanDashboard.overdueAmount || 0) > 0 ? 'critical' : 'high',
        title: 'Kiem tra khoan vay den han',
        reason: `Qua han ${this.formatMoney(loanDashboard.overdueAmount || 0)}, den han 14 ngay ${this.formatMoney(loanDashboard.due14Days || 0)}.`,
        proposedAction: 'Doi chieu lich tra no voi free cash va quy owner truoc khi duyet chi hoac scale ads.',
        requiresApproval: true,
        riskLevel: 'high',
        source: { module: 'loan-management', linkTo: '/loans' },
      });
    }

    const laborCashflow = snapshot.strategic.laborCashflow.data;
    if ((laborCashflow?.summary?.outstanding || 0) > 0 || (laborCashflow?.overdueCount || 0) > 0) {
      recommendations.push({
        id: 'AI-LABOR-CASHFLOW',
        type: 'finance.labor_due',
        priority: (laborCashflow.overdueCount || 0) > 0 ? 'high' : 'medium',
        title: 'Soat luong/cham cong chua thanh toan',
        reason: `Con ${laborCashflow.summary?.count || 0} statement, outstanding ${this.formatMoney(laborCashflow.summary?.outstanding || 0)}, qua han ${laborCashflow.overdueCount || 0}.`,
        proposedAction: 'Xac nhan statement, chung tu va lich chi truoc khi chot free cash.',
        requiresApproval: true,
        riskLevel: 'medium',
        source: { module: 'labor-cost1', linkTo: '/labor-cost1' },
      });
    }

    const otherCostCashflow = snapshot.strategic.otherCostCashflow.data;
    if ((otherCostCashflow?.summary?.outstanding || 0) > 0 || (otherCostCashflow?.overdueCount || 0) > 0) {
      recommendations.push({
        id: 'AI-OTHER-COST-CASHFLOW',
        type: 'finance.other_cost_due',
        priority: (otherCostCashflow.overdueCount || 0) > 0 ? 'high' : 'medium',
        title: 'Soat chi phi van hanh chua thanh toan',
        reason: `Con ${otherCostCashflow.summary?.count || 0} khoan, outstanding ${this.formatMoney(otherCostCashflow.summary?.outstanding || 0)}, qua han ${otherCostCashflow.overdueCount || 0}.`,
        proposedAction: 'Uu tien khoan den han/qua han va cap nhat chung tu de forecast cashflow khong lech.',
        requiresApproval: true,
        riskLevel: 'medium',
        source: { module: 'other-cost', linkTo: '/other-cost' },
      });
    }

    const ownerFund = snapshot.strategic.ownerFund.data;
    const pendingOwnerWithdrawal = this.asArray(ownerFund?.withdrawalsByStatus).find((item: any) => item._id === 'pending');
    if ((pendingOwnerWithdrawal?.amount || 0) > 0) {
      recommendations.push({
        id: 'AI-OWNER-WITHDRAWAL-PENDING',
        type: 'finance.owner_withdrawal_pending',
        priority: 'high',
        title: 'Co lenh rut owner dang cho duyet',
        reason: `Dang pending ${pendingOwnerWithdrawal.count || 0} lenh, tong ${this.formatMoney(pendingOwnerWithdrawal.amount || 0)}.`,
        proposedAction: 'Chi duyet rut owner sau khi tru committed cash, survival floor, no den han va budget ads da khoa.',
        requiresApproval: true,
        riskLevel: 'high',
        source: { module: 'owner-fund', linkTo: '/owner-fund' },
      });
    }

    const availableFunds = snapshot.strategic.availableFunds.data?.latest;
    if (availableFunds && (availableFunds.available || 0) <= 0) {
      recommendations.push({
        id: 'AI-AVAILABLE-FUNDS-LOW',
        type: 'finance.available_funds_low',
        priority: 'high',
        title: 'Von kha dung conservative dang thap',
        reason: `Available funds snapshot moi nhat: ${this.formatMoney(availableFunds.available || 0)}; reserved payroll/payables/other ${this.formatMoney((availableFunds.reservedPayroll || 0) + (availableFunds.reservedPayables || 0) + (availableFunds.reservedOther || 0))}.`,
        proposedAction: 'Tam dung quyet dinh chi/rut/scale cho den khi cap nhat tien thu that va khoan reserve.',
        requiresApproval: true,
        riskLevel: 'high',
        source: { module: 'finance.available-funds', linkTo: '/finance/available-funds' },
      });
    }

    const receivables = snapshot.receivables.data;
    const supplierOverdue = this.asArray(receivables?.supplier?.overdue);
    if (supplierOverdue.length > 0) {
      const total = supplierOverdue.reduce((sum: number, item: any) => sum + (item.balance || 0), 0);
      recommendations.push({
        id: 'AI-DEBT-SUPPLIER-OVERDUE',
        type: 'receivable.supplier_overdue',
        priority: 'high',
        title: `${supplierOverdue.length} khoan NCC qua han`,
        reason: `Tong so tien qua han trong danh sach doc duoc: ${this.formatMoney(total)}.`,
        proposedAction: 'Nhac ke toan/ops kiem tra doi soat va lien he NCC thanh toan.',
        requiresApproval: false,
        riskLevel: 'low',
        source: { module: 'supplier-payable', linkTo: '/supplier-payable' },
      });
    }

    const agentOverdue = this.asArray(receivables?.agent?.overdue);
    if (agentOverdue.length > 0) {
      const total = agentOverdue.reduce((sum: number, item: any) => sum + (item.closingBalance || 0), 0);
      recommendations.push({
        id: 'AI-DEBT-AGENT-OVERDUE',
        type: 'payable.agent_overdue',
        priority: 'medium',
        title: `${agentOverdue.length} sao ke dai ly qua han`,
        reason: `Tong so tien con phai xu ly: ${this.formatMoney(total)}.`,
        proposedAction: 'Nhac ke toan kiem tra lich thanh toan hoa hong dai ly.',
        requiresApproval: false,
        riskLevel: 'low',
        source: { module: 'agent-receivable', linkTo: '/agent-receivable' },
      });
    }

    const employeeKpi = snapshot.manager?.employeeKpi?.data;
    const criticalEmployeeAlerts = this.asArray(employeeKpi?.alerts).filter((alert: any) => String(alert.type || '').toUpperCase() === 'CRITICAL');
    const underperformers = this.asArray(employeeKpi?.underperformers);
    if (criticalEmployeeAlerts.length || underperformers.length) {
      recommendations.push({
        id: 'AI-MGR-EMPLOYEE-KPI',
        type: 'manager.employee_kpi_alert',
        priority: criticalEmployeeAlerts.length ? 'high' : 'medium',
        title: 'Soat KPI va workload nhan vien Ads',
        reason: criticalEmployeeAlerts.length
          ? `Co ${criticalEmployeeAlerts.length} alert KPI critical; ${underperformers.length} nhan vien chua dat KPI profitable.`
          : `Co ${underperformers.length} nhan vien chua dat KPI profitable trong ky.`,
        proposedAction: 'Manager chot owner, cap lai ad group lo/qua tai va tao task coaching neu can; khong bulk-assign khi chua xac nhan employeeId/adGroupId.',
        requiresApproval: true,
        riskLevel: 'medium',
        source: { module: 'employee-ads-kpi', linkTo: '/employee-ads-kpi' },
      });
    }

    const tokenHealth = snapshot.manager?.tokenHealth?.data;
    const tokenIssueCount = (tokenHealth?.summary?.failing || 0) + (tokenHealth?.summary?.expired || 0) + (tokenHealth?.summary?.expiringSoon || 0);
    const syncHealth = snapshot.ads.syncHealth?.data;
    const syncIssueCount = (syncHealth?.summary?.failedPlatforms || 0) + (syncHealth?.summary?.stalePlatforms || 0) + (syncHealth?.summary?.tokenIssues || 0);
    if (tokenIssueCount || syncIssueCount) {
      recommendations.push({
        id: 'AI-MGR-TOKEN-SYNC-HEALTH',
        type: 'manager.token_sync_health',
        priority: tokenIssueCount + syncIssueCount >= 3 ? 'high' : 'medium',
        title: 'Kiem tra token va sync ads/social',
        reason: `Token issues ${tokenIssueCount}; sync issues ${syncIssueCount}. Du lieu ads/fanpage co the tre hoac sai neu sync fail.`,
        proposedAction: 'Kiem tra token sap het han/invalid, sync health theo platform va chay validate/sync lai sau khi manager xac nhan.',
        requiresApproval: true,
        riskLevel: 'medium',
        source: { module: 'api-tokens', linkTo: '/api-tokens' },
      });
    }

    const costPerOrder = snapshot.ads.costPerOrder?.data;
    if ((costPerOrder?.summary?.noOrdersWithSpend || 0) > 0) {
      recommendations.push({
        id: 'AI-MGR-CPO-NO-ORDER-SPEND',
        type: 'ads.no_order_spend',
        priority: 'high',
        title: 'Co spend ads khong ra don trong ky',
        reason: `${costPerOrder.summary.noOrdersWithSpend} dong/ngay ad group co chi phi nhung khong co order tuong ung; blended CPO ${costPerOrder.summary.blendedCostPerOrder == null ? 'N/A' : this.formatMoney(costPerOrder.summary.blendedCostPerOrder)}.`,
        proposedAction: 'Uu tien soat tracking, mapping adGroupId, creative/lead funnel va giam ngan sach nhom spend khong ra don sau khi duyet.',
        requiresApproval: true,
        riskLevel: 'medium',
        source: { module: 'ad-report', linkTo: '/ad-report/cost-per-order' },
      });
    }

    const marketingDecision = snapshot.manager?.marketing?.data;
    const readiness = marketingDecision?.overview?.readiness || snapshot.strategic.aiMarketingOverview.data?.readiness;
    if (readiness && readiness.status && readiness.status !== 'ready') {
      recommendations.push({
        id: 'AI-MGR-MARKETING-READINESS',
        type: 'manager.marketing_readiness',
        priority: readiness.status === 'blocked' ? 'high' : 'medium',
        title: 'AI Marketing chua san sang de quyet dinh sau',
        reason: readiness.reason || readiness.message || `Readiness hien tai: ${readiness.status}.`,
        proposedAction: 'Bo sung du lieu lead/creative/evaluation con thieu truoc khi dung AI de de xuat scale, pause hoac doi creative.',
        requiresApproval: false,
        riskLevel: 'medium',
        source: { module: 'ai-marketing', linkTo: '/ai-marketing' },
      });
    }

    const conversations = snapshot.manager?.conversations?.data || null;
    const pendingOrders = snapshot.manager?.pendingOrders?.data || null;
    const managerNeedsHuman = Number(conversations?.needsHuman || conversations?.needsHumanCount || 0);
    const managerAwaitingOrder = Number(conversations?.awaitingOrder || conversations?.awaitingOrderCount || 0);
    const pendingOrderCount = this.asArray(pendingOrders?.recentPending).length;
    if (managerNeedsHuman || managerAwaitingOrder || pendingOrderCount) {
      recommendations.push({
        id: 'AI-MGR-CONVERSATION-SLA',
        type: 'manager.conversation_sla',
        priority: managerNeedsHuman ? 'high' : 'medium',
        title: 'Hoi thoai/pending order can manager can thiep',
        reason: `Needs human ${managerNeedsHuman}; awaiting order ${managerAwaitingOrder}; pending order snapshot ${pendingOrderCount}.`,
        proposedAction: 'Giao sale/ads owner xu ly hoi thoai co y dinh mua, draft order va fanpage co auto AI bat thuong.',
        requiresApproval: false,
        riskLevel: 'low',
        source: { module: 'chat-messages', linkTo: '/chat-messages' },
      });
    }

    return recommendations.slice(0, 20);
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
      const modelInput = this.buildAiModelInput(message, scenarioContext, recommendations, knowledge, role, tokenPolicy);
      const estimatedInputTokens = this.estimateTokenCount(JSON.stringify(modelInput));
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

      if (this.supportsReasoningEffort(model)) {
        (payload as any).reasoning = {
          effort: this.normalizeReasoningEffort(config.reasoningEffort),
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

      const tokenUsage = this.buildOpenAiTokenUsage(scenarioContext, tokenPolicy, model, response.data?.usage, estimatedInputTokens);
      this.logger.log(`AI_OPERATOR_TOKEN_USAGE ${JSON.stringify(tokenUsage)}`);

      return { answer: this.enforceOperatorResponseContract(answer, scenarioContext), model, tokenUsage };
    } catch (error: any) {
      const message = error?.response?.data?.error?.message || error?.message || 'unknown OpenAI error';
      this.logger.warn(`OpenAI summary fallback used: ${message}`);
      return null;
    }
  }

  private buildAiModelInput(
    message: string,
    scenarioContext: AiOperatorScenarioContext,
    recommendations: AiOperatorRecommendation[],
    knowledge: any,
    role: string | undefined,
    tokenPolicy: AiOperatorTokenPolicy,
  ) {
    const responseContract = this.responseContractForIntent(scenarioContext.route.intent);
    const modelInput: any = {
      question: message,
      role: role || scenarioContext.role || null,
      route: {
        intent: scenarioContext.route.intent,
        workflow: scenarioContext.route.scenarioId || null,
        responseContract,
      },
      authorization: {
        allowed: !scenarioContext.route.blocked,
        missingPermissions: scenarioContext.route.deniedSources || [],
      },
      data: this.applyTokenPolicyToContext(scenarioContext.context, tokenPolicy),
      instructions: {
        mustUseResponseContract: true,
        doNotListLoadedSourcesUnlessAsked: !tokenPolicy.includeLoadedSourcesList,
        doNotMentionApprovalUnlessActionRequested: true,
        mustRespectDataQuality: true,
        badDataQualityRule: 'If dataQuality.status is bad, do not make a firm conclusion. Ask to fix missing/sync/attribution data first.',
        actionSafetyRule: 'Real actions must go through draft action, approval request, executor and audit log. Never say an action was executed unless executor success is present.',
        maxOutputTokens: tokenPolicy.maxOutputTokens,
      },
    };

    if (knowledge?.questionPlaybook?.length) {
      modelInput.questionPlaybook = knowledge.questionPlaybook.slice(0, 3).map((item: any) => ({
        groupId: item.groupId,
        title: item.title,
        analysisSteps: this.limitArrayRows(item.analysisSteps || [], 4),
        responseRules: this.limitArrayRows(item.responseRules || [], 4),
        guardrails: this.limitArrayRows(item.guardrails || [], 3),
        dataGaps: this.limitArrayRows(item.dataGaps || [], 3),
      }));
    }

    if (tokenPolicy.includeTaskSummary) {
      modelInput.taskSummary = this.buildTaskSummaryForModel(message, scenarioContext, responseContract);
    }

    if (tokenPolicy.includeApiCatalog) {
      modelInput.apiCatalog = this.limitArrayRows(knowledge?.apiCatalog || [], 20);
    }

    if (tokenPolicy.includeAssistantQuality && scenarioContext.context?.assistantQuality) {
      modelInput.dataQuality = this.compactQualityForModel(scenarioContext.context.assistantQuality, tokenPolicy);
    }

    if (scenarioContext.context?.dataQuality) {
      modelInput.dataQualityV2 = this.limitArrayRows(scenarioContext.context.dataQuality, 8);
    }

    if (scenarioContext.context?.decisionSupport) {
      modelInput.decisionSupport = this.limitArrayRows(scenarioContext.context.decisionSupport, 5);
    }

    if (tokenPolicy.includeDataGaps && scenarioContext.dataGaps?.length) {
      modelInput.dataQuality = {
        ...(modelInput.dataQuality || {}),
        dataGaps: scenarioContext.dataGaps.slice(0, 10),
      };
    }

    if (recommendations?.length && tokenPolicy.mode !== 'small_ai') {
      modelInput.recommendations = recommendations.slice(0, 5).map((item) => ({
        type: item.type,
        priority: item.priority,
        title: item.title,
        reason: item.reason,
        requiresApproval: item.requiresApproval,
      }));
    }

    return this.enforceTokenBudget(modelInput, tokenPolicy);
  }

  private applyTokenPolicyToContext(context: any, tokenPolicy: AiOperatorTokenPolicy) {
    const compact = this.limitArrayRows(this.cloneJson(context || {}), tokenPolicy.includeRawRowsLimit);

    if (!tokenPolicy.includeApiCatalog) {
      delete compact.apiCatalog;
    }
    if (!tokenPolicy.includeAssistantQuality) {
      delete compact.assistantQuality;
    } else if (!tokenPolicy.includeLoadedSourcesList) {
      delete compact.assistantQuality?.loadedSources;
    }
    if (!tokenPolicy.includeDataGaps) {
      delete compact.dataGaps;
    }
    if (!tokenPolicy.includeLoadedSourcesList) {
      delete compact.apiCoverage?.loadedSources;
      delete compact.apiCoverage?.endpointCoverage;
    }
    if (!tokenPolicy.includeDebugTrace) {
      delete compact.agentTrace;
    }

    return compact;
  }

  private compactQualityForModel(quality: any, tokenPolicy: AiOperatorTokenPolicy) {
    const compact = this.cloneJson(quality || {});
    if (!tokenPolicy.includeLoadedSourcesList) {
      delete compact.loadedSources;
    }
    delete compact.responseContract;
    return this.limitArrayRows(compact, 8);
  }

  private enforceTokenBudget(modelInput: any, tokenPolicy: AiOperatorTokenPolicy) {
    if (!tokenPolicy.maxInputTokens || tokenPolicy.maxInputTokens <= 0) {
      return modelInput;
    }
    if (this.estimateTokenCount(JSON.stringify(modelInput)) <= tokenPolicy.maxInputTokens) {
      return modelInput;
    }

    const compact = this.cloneJson(modelInput);
    compact.data = this.limitArrayRows(compact.data, Math.min(3, Math.max(1, tokenPolicy.includeRawRowsLimit)));
    if (compact.recommendations) {
      compact.recommendations = compact.recommendations.slice(0, 3);
    }
    delete compact.apiCoverage;
    delete compact.guardrails;

    if (this.estimateTokenCount(JSON.stringify(compact)) <= tokenPolicy.maxInputTokens) {
      return compact;
    }

    return {
      question: modelInput.question,
      role: modelInput.role,
      route: modelInput.route,
      authorization: modelInput.authorization,
      data: {
        ads: compact.data?.ads || null,
        finance: compact.data?.finance || null,
        tokenManagement: compact.data?.tokenManagement || null,
      },
      dataQuality: compact.dataQuality || null,
      taskSummary: compact.taskSummary || null,
      instructions: modelInput.instructions,
    };
  }

  private buildTaskSummaryForModel(message: string, scenarioContext: AiOperatorScenarioContext, responseContract: string): string {
    return [
      `Câu hỏi hiện tại: ${message}`,
      `Intent: ${scenarioContext.route.intent}.`,
      `Response contract: ${responseContract}.`,
      `Khoảng dữ liệu: ${scenarioContext.windowDays} ngày.`,
    ].join(' ');
  }

  private responseContractForIntent(intent: AiOperatorIntent): string {
    if (BUSINESS_FACT_INTENTS.includes(intent)) return 'businessFacts';
    if (intent === 'ad_group_profit_classification') return 'adGroupProfitTable';
    if (intent === 'ads_diagnostic_checklist') return 'adsDiagnosticChecklist';
    if (intent === 'api') return 'apiExplanation';
    const v2Contract = responseContractForV2Intent(intent);
    if (v2Contract?.intentGroups?.includes(intent)) return v2Contract.id;
    if (intent === 'ads') return 'decisionProposal';
    if (intent === 'overview' || intent === 'finance' || intent === 'receivables') return 'executiveSummary';
    return 'normalSummary';
  }

  private limitArrayRows(value: any, limit: number): any {
    if (Array.isArray(value)) {
      const primitiveArray = value.every((item) => item === null || ['string', 'number', 'boolean'].includes(typeof item));
      if (primitiveArray) return value;
      return (limit > 0 ? value.slice(0, limit) : []).map((item) => this.limitArrayRows(item, limit));
    }
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, this.limitArrayRows(item, limit)]));
  }

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value ?? null));
  }

  private estimateTokenCount(text: string): number {
    return Math.ceil(String(text || '').length / 4);
  }

  private buildNoAiTokenUsage(scenarioContext: AiOperatorScenarioContext, tokenPolicy: AiOperatorTokenPolicy) {
    return {
      intent: scenarioContext.route.intent,
      workflow: scenarioContext.route.scenarioId || null,
      responseContract: this.responseContractForIntent(scenarioContext.route.intent),
      model: null,
      mode: tokenPolicy.mode,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      usedFallback: true,
      createdAt: new Date().toISOString(),
    };
  }

  private buildOpenAiTokenUsage(
    scenarioContext: AiOperatorScenarioContext,
    tokenPolicy: AiOperatorTokenPolicy,
    model: string,
    usage: any,
    estimatedInputTokens: number,
  ) {
    const inputTokens = Number(usage?.input_tokens ?? usage?.prompt_tokens ?? estimatedInputTokens ?? 0);
    const outputTokens = Number(usage?.output_tokens ?? usage?.completion_tokens ?? 0);
    return {
      intent: scenarioContext.route.intent,
      workflow: scenarioContext.route.scenarioId || null,
      responseContract: this.responseContractForIntent(scenarioContext.route.intent),
      model,
      mode: tokenPolicy.mode,
      inputTokens,
      outputTokens,
      totalTokens: Number(usage?.total_tokens ?? inputTokens + outputTokens),
      usedFallback: false,
      createdAt: new Date().toISOString(),
    };
  }

  private supportsReasoningEffort(model: string): boolean {
    const normalized = String(model || '').toLowerCase();
    return normalized.startsWith('gpt-5') || /^o\d/.test(normalized);
  }

  private normalizeReasoningEffort(value?: string): 'none' | 'low' | 'medium' | 'high' | 'xhigh' {
    return ['none', 'low', 'medium', 'high', 'xhigh'].includes(String(value))
      ? value as 'none' | 'low' | 'medium' | 'high' | 'xhigh'
      : 'medium';
  }

  private enforceOperatorResponseContract(answer: string, scenarioContext: AiOperatorScenarioContext): string {
    const normalized = this.removeVietnameseTone(answer || '').toLowerCase();
    const hasDataSection = normalized.includes('du lieu') || normalized.includes('source') || normalized.includes('nguon');
    const hasRiskSection = normalized.includes('rui ro') || normalized.includes('thieu du lieu') || normalized.includes('missing');
    const hasApprovalSection = normalized.includes('can duyet') || normalized.includes('phe duyet') || normalized.includes('approval');
    if (hasDataSection && hasRiskSection && hasApprovalSection) return answer;

    const quality = scenarioContext.context?.assistantQuality || {};
    const loadedSources = Array.isArray(quality.loadedSources) ? quality.loadedSources : [];
    const dataGaps = Array.isArray(quality.dataGaps) ? quality.dataGaps : [];
    const notLoadedReadApis = Array.isArray(quality.notLoadedReadApis) ? quality.notLoadedReadApis : [];

    const addendum = [
      '',
      'Kiem tra chuan 9+:',
      `- Du lieu da doc: ${loadedSources.length ? loadedSources.slice(0, 8).join(', ') : 'chua co source nao duoc load trong context hien tai'}.`,
      `- Do tin cay: ${quality.confidence || 'unknown'}${typeof quality.score === 'number' ? ` (${quality.score}/100)` : ''}.`,
      dataGaps.length || notLoadedReadApis.length
        ? `- Rui ro/thieu du lieu: ${[...dataGaps, ...notLoadedReadApis].slice(0, 8).join('; ')}.`
        : '- Rui ro/thieu du lieu: chua thay data gap lon trong context da cap.',
      '- Can duyet: moi hanh dong chi tien, thanh toan, rut tien, tang/giam ngan sach ads hoac thay doi provider deu can nguoi co tham quyen phe duyet.',
    ].join('\n');

    return `${answer.trim()}\n${addendum}`;
  }

  private ensureVietnameseUiResponse(answer: string): string {
    const replacements: Array<[RegExp, string]> = [
      [/loaded:/g, 'đã tải:'],
      [/loaded: none/g, 'đã tải: chưa có'],
      [/financial dashboard/g, 'bảng điều khiển tài chính'],
      [/forecast/g, 'dự báo'],
      [/finance actions/g, 'hành động tài chính'],
      [/ads performance/g, 'hiệu suất quảng cáo'],
      [/ads suggestions/g, 'gợi ý quảng cáo'],
      [/ads alerts/g, 'cảnh báo quảng cáo'],
      [/ads sync health/g, 'sức khỏe đồng bộ quảng cáo'],
      [/ads cost by ad group/g, 'chi phí quảng cáo theo nhóm quảng cáo'],
      [/ads cost per order/g, 'chi phí quảng cáo trên mỗi đơn'],
      [/\borders\b/g, 'đơn hàng'],
      [/\breturns\b/g, 'hàng hoàn'],
      [/\breceivables\b/g, 'công nợ phải thu'],
      [/\boperations\b/g, 'vận hành'],
      [/employee ads KPI/g, 'KPI nhân viên quảng cáo'],
      [/ads token health/g, 'sức khỏe token quảng cáo'],
      [/manager marketing context/g, 'ngữ cảnh marketing của quản lý'],
      [/manager conversations/g, 'hội thoại của quản lý'],
      [/manager pending orders/g, 'đơn chờ xử lý của quản lý'],
      [/manager media context/g, 'ngữ cảnh media của quản lý'],
      [/manager ad entities/g, 'thực thể quảng cáo của quản lý'],
      [/funds overview/g, 'tổng quan quỹ'],
      [/available funds/g, 'vốn khả dụng'],
      [/budget preview/g, 'xem trước ngân sách'],
      [/loan dashboard/g, 'bảng khoản vay'],
      [/owner fund/g, 'quỹ chủ sở hữu'],
      [/labor cashflow/g, 'dòng tiền lương'],
      [/other cost cashflow/g, 'dòng tiền chi phí khác'],
      [/ads cost cashflow/g, 'dòng tiền chi phí quảng cáo'],
      [/ai marketing overview/g, 'tổng quan AI marketing'],
      [/ai marketing plans/g, 'kế hoạch AI marketing'],
      [/ai marketing evaluations/g, 'đánh giá AI marketing'],
      [/quote readiness/g, 'mức sẵn sàng báo giá'],
      [/access audit/g, 'kiểm toán truy cập'],
      [/free cash/g, 'tiền tự do'],
      [/committed cash/g, 'tiền đã cam kết'],
      [/\bcommitted\b/g, 'đã cam kết'],
      [/monthly burn/g, 'mức đốt tiền hằng tháng'],
      [/\bdebt\b/g, 'nợ'],
      [/\brunway\b/g, 'thời gian chịu đựng'],
      [/owner withdrawable/g, 'số tiền chủ sở hữu có thể rút'],
      [/available conservative/g, 'vốn khả dụng thận trọng'],
      [/ads dry-run locked/g, 'mô phỏng ngân sách quảng cáo đang khóa'],
      [/owner fund balance/g, 'số dư quỹ chủ sở hữu'],
      [/\boutstanding\b/g, 'chưa thanh toán'],
      [/\bstatement\b/g, 'bảng kê'],
      [/\bsnapshot\b/g, 'ảnh chụp dữ liệu'],
      [/\bscale ads\b/g, 'tăng ngân sách quảng cáo'],
      [/allocation preview/g, 'bản xem trước phân bổ'],
      [/\breserved\b/g, 'đã giữ lại'],
      [/\bpayroll\b/g, 'lương'],
      [/\bpayables\b/g, 'khoản phải trả'],
      [/\bReadiness\b/g, 'Mức sẵn sàng'],
      [/\breadiness\b/g, 'mức sẵn sàng'],
      [/Needs human/g, 'Cần người xử lý'],
      [/needs human/g, 'cần người xử lý'],
      [/awaiting order/g, 'đang chờ lên đơn'],
      [/pending order/g, 'đơn chờ xử lý'],
      [/pending snapshot/g, 'ảnh chụp dữ liệu đơn chờ xử lý'],
      [/\bmanager\b/g, 'quản lý'],
      [/Token issues/g, 'Vấn đề token'],
      [/token issues/g, 'vấn đề token'],
      [/sync issues/g, 'vấn đề đồng bộ'],
      [/sync health/g, 'sức khỏe đồng bộ'],
      [/\bplatform\b/g, 'nền tảng'],
      [/\bvalidate\b/g, 'xác thực'],
      [/\binvalid\b/g, 'không hợp lệ'],
      [/\bowner\b/g, 'người phụ trách'],
      [/\bbulk assign\b/g, 'phân công hàng loạt'],
      [/\bBulk assign\b/g, 'Phân công hàng loạt'],
      [/\bbulk-assign\b/g, 'phân công hàng loạt'],
      [/\bpause\b/g, 'tạm dừng'],
      [/auto-AI/g, 'AI tự động'],
      [/burn=0/g, 'mức đốt tiền = 0'],
      [/\bScale\b/g, 'tăng ngân sách'],
      [/\bscale\b/g, 'tăng ngân sách'],
      [/\bads(?=\/|\s|,|\.|;|:|$)/g, 'quảng cáo'],
      [/\bAds(?=\/|\s|,|\.|;|:|$)/g, 'Quảng cáo'],
      [/\bcashflow\b/g, 'dòng tiền'],
      [/\bdata gap\b/g, 'khoảng trống dữ liệu'],
      [/\bbatch\b/g, 'lô'],
      [/\bpenalty\b/g, 'phạt'],
      [/Ket luan ngan/g, 'Kết luận ngắn'],
      [/Du lieu da doc/g, 'Dữ liệu đã đọc'],
      [/Phan tich tinh huong/g, 'Phân tích tình huống'],
      [/Viec can lam/g, 'Việc cần làm'],
      [/Rui ro\/thieu du lieu/g, 'Rủi ro/thiếu dữ liệu'],
      [/Can duyet/g, 'Cần duyệt'],
      [/Kiem tra chuan 9\+/g, 'Kiểm tra chuẩn 9+'],
      [/Do tin cay/g, 'Độ tin cậy'],
      [/Giam doc/g, 'Giám đốc'],
      [/Ke toan/g, 'Kế toán'],
      [/Quan ly/g, 'Quản lý'],
      [/Tro ly/g, 'Trợ lý'],
      [/Hien /g, 'Hiện '],
      [/Hom nay/g, 'Hôm nay'],
      [/chua /g, 'chưa '],
      [/Chua /g, 'Chưa '],
      [/du lieu/g, 'dữ liệu'],
      [/Du lieu/g, 'Dữ liệu'],
      [/nguon/g, 'nguồn'],
      [/Nguon/g, 'Nguồn'],
      [/khong/g, 'không'],
      [/Khong/g, 'Không'],
      [/co /g, 'có '],
      [/Co /g, 'Có '],
      [/can /g, 'cần '],
      [/Can /g, 'Cần '],
      [/duoc/g, 'được'],
      [/Duoc/g, 'Được'],
      [/doc/g, 'đọc'],
      [/Doc/g, 'Đọc'],
      [/tom tat/g, 'tóm tắt'],
      [/Tom tat/g, 'Tóm tắt'],
      [/hanh dong/g, 'hành động'],
      [/Hanh dong/g, 'Hành động'],
      [/thuc hien/g, 'thực hiện'],
      [/Thuc hien/g, 'Thực hiện'],
      [/phan tich/g, 'phân tích'],
      [/Phan tich/g, 'Phân tích'],
      [/de xuat/g, 'đề xuất'],
      [/De xuat/g, 'Đề xuất'],
      [/quyet dinh/g, 'quyết định'],
      [/Quyet dinh/g, 'Quyết định'],
      [/tai chinh/g, 'tài chính'],
      [/Tai chinh/g, 'Tài chính'],
      [/dong tien/g, 'dòng tiền'],
      [/Dong tien/g, 'Dòng tiền'],
      [/cong no/g, 'công nợ'],
      [/Cong no/g, 'Công nợ'],
      [/don/g, 'đơn'],
      [/Don/g, 'Đơn'],
      [/ngay/g, 'ngày'],
      [/Ngay/g, 'Ngày'],
      [/thang/g, 'tháng'],
      [/Thang/g, 'Tháng'],
      [/nhan vien/g, 'nhân viên'],
      [/Nhan vien/g, 'Nhân viên'],
      [/nha cung cap/g, 'nhà cung cấp'],
      [/Nha cung cap/g, 'Nhà cung cấp'],
      [/bat buoc/g, 'bắt buộc'],
      [/Bat buoc/g, 'Bắt buộc'],
      [/phe duyet/g, 'phê duyệt'],
      [/Phe duyet/g, 'Phê duyệt'],
      [/thieu/g, 'thiếu'],
      [/Thieu/g, 'Thiếu'],
      [/rui ro/g, 'rủi ro'],
      [/Rui ro/g, 'Rủi ro'],
      [/so tien/g, 'số tiền'],
      [/So tien/g, 'Số tiền'],
      [/pham vi/g, 'phạm vi'],
      [/Pham vi/g, 'Phạm vi'],
      [/nguoi/g, 'người'],
      [/Nguoi/g, 'Người'],
      [/goi y/g, 'gợi ý'],
      [/Goi y/g, 'Gợi ý'],
      [/kiem tra/g, 'kiểm tra'],
      [/Kiem tra/g, 'Kiểm tra'],
      [/theo doi/g, 'theo dõi'],
      [/Theo doi/g, 'Theo dõi'],
      [/hien tai/g, 'hiện tại'],
      [/Hien tai/g, 'Hiện tại'],
      [/he thong/g, 'hệ thống'],
      [/He thong/g, 'Hệ thống'],
      [/hoi thoai/g, 'hội thoại'],
      [/Hoi thoai/g, 'Hội thoại'],
      [/chat luong/g, 'chất lượng'],
      [/Chat luong/g, 'Chất lượng'],
      [/san xuat/g, 'sản xuất'],
      [/San xuat/g, 'Sản xuất'],
      [/giao hang/g, 'giao hàng'],
      [/Giao hang/g, 'Giao hàng'],
      [/khach/g, 'khách'],
      [/Khach/g, 'Khách'],
      [/hoa hong/g, 'hoa hồng'],
      [/Hoa hong/g, 'Hoa hồng'],
      [/bat thuong/g, 'bất thường'],
      [/Bat thuong/g, 'Bất thường'],
      [/\bnen\b/g, 'nên'],
      [/\bNen\b/g, 'Nên'],
      [/\btruoc\b/g, 'trước'],
      [/\bTruoc\b/g, 'Trước'],
      [/\bsau do\b/g, 'sau đó'],
      [/\bSau do\b/g, 'Sau đó'],
      [/\bmoi den\b/g, 'mới đến'],
      [/\bMoi den\b/g, 'Mới đến'],
      [/\bdiem tien thap nhat\b/g, 'điểm tiền thấp nhất'],
      [/\bDiem tien thap nhat\b/g, 'Điểm tiền thấp nhất'],
      [/\btai\b/g, 'tại'],
      [/\bTai\b/g, 'Tại'],
      [/\bno den han\b/g, 'nợ đến hạn'],
      [/\bNo den han\b/g, 'Nợ đến hạn'],
      [/\bco\b/g, 'có'],
      [/\bCo\b/g, 'Có'],
      [/\bva\b/g, 'và'],
      [/\bVa\b/g, 'Và'],
      [/\btang\b/g, 'tăng'],
      [/\bTang\b/g, 'Tăng'],
      [/\bgiam\b/g, 'giảm'],
      [/\bGiam\b/g, 'Giảm'],
      [/\bngan sach\b/g, 'ngân sách'],
      [/\bNgan sach\b/g, 'Ngân sách'],
      [/\brut\b/g, 'rút'],
      [/\bRut\b/g, 'Rút'],
      [/\btra no\b/g, 'trả nợ'],
      [/\bTra no\b/g, 'Trả nợ'],
      [/\btao\b/g, 'tạo'],
      [/\bTao\b/g, 'Tạo'],
      [/\bthanh toan\b/g, 'thanh toán'],
      [/\bThanh toan\b/g, 'Thanh toán'],
      [/\bthat\b/g, 'thật'],
      [/\bThat\b/g, 'Thật'],
      [/\bdeu\b/g, 'đều'],
      [/\bDeu\b/g, 'Đều'],
      [/\bxac nhan\b/g, 'xác nhận'],
      [/\bXac nhan\b/g, 'Xác nhận'],
      [/\bro\b/g, 'rõ'],
      [/\bRo\b/g, 'Rõ'],
      [/\bduyet\b/g, 'duyệt'],
      [/\bDuyet\b/g, 'Duyệt'],
      [/\bTam khoa\b/g, 'Tạm khóa'],
      [/\btam khoa\b/g, 'tạm khóa'],
      [/\bdieu kien\b/g, 'điều kiện'],
      [/\bDieu kien\b/g, 'Điều kiện'],
      [/\bdoi chieu\b/g, 'đối chiếu'],
      [/\bDoi chieu\b/g, 'Đối chiếu'],
      [/\blich\b/g, 'lịch'],
      [/\bLich\b/g, 'Lịch'],
      [/\bvoi\b/g, 'với'],
      [/\bVoi\b/g, 'Với'],
      [/\bquy\b/g, 'quỹ'],
      [/\bQuy\b/g, 'Quỹ'],
      [/\bchi hoac\b/g, 'chi hoặc'],
      [/\bChi hoac\b/g, 'Chi hoặc'],
      [/\bsoat\b/g, 'soát'],
      [/\bSoat\b/g, 'Soát'],
      [/\bluong\b/g, 'lương'],
      [/\bLuong\b/g, 'Lương'],
      [/\bcham cong\b/g, 'chấm công'],
      [/\bCham cong\b/g, 'Chấm công'],
      [/\bchung tu\b/g, 'chứng từ'],
      [/\bChung tu\b/g, 'Chứng từ'],
      [/\blich chi\b/g, 'lịch chi'],
      [/\bLich chi\b/g, 'Lịch chi'],
      [/\bchot\b/g, 'chốt'],
      [/\bChot\b/g, 'Chốt'],
      [/\bkhoan\b/g, 'khoản'],
      [/\bKhoan\b/g, 'Khoản'],
      [/\buu tien\b/g, 'ưu tiên'],
      [/\bUu tien\b/g, 'Ưu tiên'],
      [/\bcap nhat\b/g, 'cập nhật'],
      [/\bCap nhat\b/g, 'Cập nhật'],
      [/\bde\b/g, 'để'],
      [/\bDe\b/g, 'Để'],
      [/\btu\b/g, 'từ'],
      [/\bTu\b/g, 'Từ'],
      [/\bcac\b/g, 'các'],
      [/\bCac\b/g, 'Các'],
      [/\bcua\b/g, 'của'],
      [/\bCua\b/g, 'Của'],
      [/\btrong ky\b/g, 'trong kỳ'],
      [/\bTrong ky\b/g, 'Trong kỳ'],
      [/\bgan nhat\b/g, 'gần nhất'],
      [/\bGan nhat\b/g, 'Gần nhất'],
      [/\bkhuyen nghi\b/g, 'khuyến nghị'],
      [/\bKhuyen nghi\b/g, 'Khuyến nghị'],
      [/\ban toan\b/g, 'an toàn'],
      [/\bAn toan\b/g, 'An toàn'],
      [/\blon\b/g, 'lớn'],
      [/\bLon\b/g, 'Lớn'],
      [/\bbo sot\b/g, 'bỏ sót'],
      [/\bBo sot\b/g, 'Bỏ sót'],
      [/\bso dien thoai\b/g, 'số điện thoại'],
      [/\bSo dien thoai\b/g, 'Số điện thoại'],
      [/\bsan pham\b/g, 'sản phẩm'],
      [/\bSan pham\b/g, 'Sản phẩm'],
      [/\bgia\b/g, 'giá'],
      [/\bGia\b/g, 'Giá'],
      [/\bdoi\b/g, 'đổi'],
      [/\bDoi\b/g, 'Đổi'],
      [/\bCon (?=\d)/g, 'Còn '],
      [/\bcon (?=\d)/g, 'còn '],
      [/\bchi phi\b/g, 'chi phí'],
      [/\bChi phi\b/g, 'Chi phí'],
      [/ngân sách quảng cáo/g, 'ngân sách quảng cáo'],
      [/ngân sách ads/g, 'ngân sách quảng cáo'],
      [/Ngân sách ads/g, 'Ngân sách quảng cáo'],
      [/quỹ chủ sở hữu balance/g, 'số dư quỹ chủ sở hữu'],
      [/quỹ người phụ trách/g, 'quỹ chủ sở hữu'],
      [/Rút người phụ trách/g, 'Rút tiền chủ sở hữu'],
      [/rút người phụ trách/g, 'rút tiền chủ sở hữu'],
      [/dự báo dòng tiền/g, 'dự báo dòng tiền'],
      [/chi phí khac/g, 'chi phí khác'],
      [/Chi phí khac/g, 'Chi phí khác'],
      [/Von kha dung/g, 'Vốn khả dụng'],
      [/von kha dung/g, 'vốn khả dụng'],
      [/\bconservative\b/g, 'thận trọng'],
      [/\bdang\b/g, 'đang'],
      [/\bDang\b/g, 'Đang'],
      [/\bthap\b/g, 'thấp'],
      [/\bThap\b/g, 'Thấp'],
      [/\bsan sang\b/g, 'sẵn sàng'],
      [/\bSan sang\b/g, 'Sẵn sàng'],
      [/quỹết/g, 'quyết'],
      [/Quỹết/g, 'Quyết'],
      [/quyết định sau/g, 'quyết định sâu'],
      [/Quyết định sau/g, 'Quyết định sâu'],
      [/can thiep/g, 'can thiệp'],
      [/cần thiep/g, 'cần can thiệp'],
      [/Can thiep/g, 'Can thiệp'],
      [/Cần thiep/g, 'Cần can thiệp'],
      [/cần quản lý cần can thiệp/g, 'cần quản lý can thiệp'],
      [/Cần quản lý cần can thiệp/g, 'Cần quản lý can thiệp'],
      [/cần quản lý cần thiệp/g, 'cần quản lý can thiệp'],
      [/Cần quản lý cần thiệp/g, 'Cần quản lý can thiệp'],
      [/\bsync\b/g, 'đồng bộ'],
      [/\bSync\b/g, 'Đồng bộ'],
      [/\bsocial\b/g, 'mạng xã hội'],
      [/Rủi rõ/g, 'Rủi ro'],
      [/rủi rõ/g, 'rủi ro'],
      [/\bchi phi khac\b/g, 'chi phí khác'],
      [/\bChi phi khac\b/g, 'Chi phí khác'],
      [/\bvan hanh\b/g, 'vận hành'],
      [/\bVan hanh\b/g, 'Vận hành'],
      [/\bden han\b/g, 'đến hạn'],
      [/\bDen han\b/g, 'Đến hạn'],
      [/\bqua han\b/g, 'quá hạn'],
      [/\bQua han\b/g, 'Quá hạn'],
      [/\blech\b/g, 'lệch'],
      [/\bLech\b/g, 'Lệch'],
      [/\btat\b/g, 'tắt'],
      [/\bTat\b/g, 'Tắt'],
      [/\bthay\b/g, 'thấy'],
      [/\bThay\b/g, 'Thấy'],
      [/\btoi\b/g, 'tới'],
      [/\bToi\b/g, 'Tới'],
    ];

    return replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), String(answer || '').trim());
  }

  private buildBusinessFactAnswer(
    message: string,
    snapshot: AiOperatorSnapshot,
    intent: AiOperatorIntent,
  ): string {
    const source = snapshot.businessFacts;
    const facts = source?.data;
    if (!source?.ok || !facts) {
      return [
        'Chua doc duoc business-facts de tra loi cau hoi nay.',
        `Nguon business-facts: ${source?.error || 'khong co trong snapshot'}.`,
      ].join('\n');
    }

    switch (intent) {
      case 'product_count':
        return this.buildProductCountFactAnswer(facts);
      case 'product_list':
        return this.buildProductListFactAnswer(facts);
      case 'product_profit_leaderboard':
        return this.buildProductProfitFactAnswer(message, facts);
      case 'fanpage_performance_lookup':
        return this.buildFanpagePerformanceFactAnswer(facts);
      case 'chatbot_fanpage_performance_lookup':
        return this.buildChatbotFanpagePerformanceFactAnswer(facts);
      case 'agent_revenue_leaderboard':
        return this.buildAgentLeaderboardFactAnswer(facts, 'revenue');
      case 'agent_profit_leaderboard':
        return this.buildAgentLeaderboardFactAnswer(facts, 'profit');
      case 'ads_product_profit_leaderboard':
        return this.buildAdsProductProfitFactAnswer(facts);
      case 'product_ads_revenue_ratio':
        return this.buildProductAdsRevenueRatioFactAnswer(message, facts);
      default:
        return 'Chua co rule-based answer cho intent business fact nay.';
    }
  }

  private buildProductCountFactAnswer(facts: any): string {
    const products = facts.products || {};
    const statusText = this.asArray(products.byStatus)
      .slice(0, 6)
      .map((item: any) => `${item.status}: ${item.count}`)
      .join(', ') || 'chua co phan nhom status';
    return [
      `Hien tai co ${products.total || 0} san pham trong he thong.`,
      `Dang active: ${products.active || 0}. Theo status: ${statusText}.`,
      `Can bo sung media: ${products.missingMedia || 0}; can bo sung gia NCC: ${products.missingSupplierPrice || 0}.`,
    ].join('\n');
  }

  private buildProductListFactAnswer(facts: any): string {
    const products = facts.products || {};
    const rows = this.asArray(products.list).slice(0, 50);
    const names = rows.map((product: any, index: number) => {
      const sku = product.sku ? ` [${product.sku}]` : '';
      const status = product.status ? ` - ${product.status}` : '';
      return `${index + 1}. ${product.name}${sku}${status}`;
    });
    return [
      `He thong dang co ${products.total || 0} san pham${products.truncated ? `; dang hien ${rows.length}/${products.total} san pham dau tien theo ten.` : '.'}`,
      ...(names.length ? names : ['Chua co san pham nao trong snapshot.']),
    ].join('\n');
  }

  private buildProductProfitFactAnswer(message: string, facts: any): string {
    const normalized = this.removeVietnameseTone(message || '').toLowerCase();
    const wantsWeek = normalized.includes('tuan') || !normalized.includes('thang');
    const wantsMonth = normalized.includes('thang');
    const sections: string[] = [];
    if (wantsWeek) {
      sections.push(this.productProfitSection('Tuan vua roi', facts.productProfit?.week));
    }
    if (wantsMonth) {
      sections.push(this.productProfitSection('Thang vua roi', facts.productProfit?.month));
    }
    return sections.join('\n\n') || this.productProfitSection('Ky hien tai', facts.productProfit?.current);
  }

  private productProfitSection(label: string, report: any): string {
    const rows = this.asArray(report?.products).slice(0, 5);
    const top = rows[0];
    if (!top) {
      return `${label}: chua co san pham co don hoan tat trong ky ${this.factDateRangeText(report?.dateRange)}.`;
    }
    return [
      `${label} (${this.factDateRangeText(report?.dateRange)}): san pham lai nhat la ${top.productName} voi loi nhuan ${this.formatMoney(top.netProfit)}, doanh thu ${this.formatMoney(top.totalRevenue)}, ${top.totalOrders} don, margin ${this.formatPercent(top.profitMargin)}.`,
      'Top san pham:',
      ...rows.map((row: any, index: number) =>
        `${index + 1}. ${row.productName}: lai ${this.formatMoney(row.netProfit)}, doanh thu ${this.formatMoney(row.totalRevenue)}, don ${row.totalOrders}, margin ${this.formatPercent(row.profitMargin)}.`,
      ),
    ].join('\n');
  }

  private buildFanpagePerformanceFactAnswer(facts: any): string {
    const fanpages = facts.fanpages || {};
    const rows = this.asArray(fanpages.topFanpages).slice(0, 5);
    const top = rows[0];
    return [
      `Hien tai co ${fanpages.total || 0} fanpage; active ${fanpages.active || 0}; bat AI ${fanpages.aiEnabled || 0}; webhook subscribed ${fanpages.webhookSubscribed || 0}.`,
      top
        ? `Fanpage hoat dong tot nhat trong ky ${this.factDateRangeText(fanpages.dateRange)} la ${top.name}: doanh thu ${this.formatMoney(top.revenue)}, loi nhuan ${this.formatMoney(top.netProfit)}, ${top.orders} don, ${top.conversations} hoi thoai, score ${Number(top.performanceScore || 0).toFixed(1)}.`
        : `Chua co du lieu hoat dong fanpage trong ky ${this.factDateRangeText(fanpages.dateRange)}.`,
      'Top fanpage:',
      ...(rows.length
        ? rows.map((row: any, index: number) =>
            `${index + 1}. ${row.name}: doanh thu ${this.formatMoney(row.revenue)}, loi nhuan ${this.formatMoney(row.netProfit)}, don ${row.orders}, hoi thoai ${row.conversations}, needsHuman ${row.needsHuman}.`,
          )
        : ['- Chua co fanpage nao co tin hieu hoat dong.']),
    ].join('\n');
  }

  private buildChatbotFanpagePerformanceFactAnswer(facts: any): string {
    const fanpages = facts.fanpages || {};
    const rows = this.asArray(fanpages.topChatbotFanpages).slice(0, 5);
    const top = rows[0];
    return [
      top
        ? `Chatbot fanpage hoat dong tot nhat trong ky ${this.factDateRangeText(fanpages.dateRange)} la ${top.name}: AI=${top.aiEnabled ? 'bat' : 'tat'}, webhook=${top.subscribedWebhook ? 'bat' : 'tat'}, outbound ${top.outboundCount}, inbound ${top.inboundCount}, needsHuman ${top.needsHuman}, score ${Number(top.chatbotScore || 0).toFixed(1)}.`
        : `Chua co fanpage nao co du lieu chatbot trong ky ${this.factDateRangeText(fanpages.dateRange)}.`,
      'Top chatbot fanpage:',
      ...(rows.length
        ? rows.map((row: any, index: number) =>
            `${index + 1}. ${row.name}: AI=${row.aiEnabled ? 'bat' : 'tat'}, webhook=${row.subscribedWebhook ? 'bat' : 'tat'}, hoi thoai ${row.conversations}, outbound ${row.outboundCount}, needsHuman ${row.needsHuman}.`,
          )
        : ['- Chua co du lieu chatbot fanpage.']),
    ].join('\n');
  }

  private buildAgentLeaderboardFactAnswer(facts: any, metric: 'revenue' | 'profit'): string {
    const report = facts.agents?.current || {};
    const rows = [...this.asArray(report.agents)]
      .sort((a: any, b: any) => metric === 'revenue'
        ? (b.totalRevenue || 0) - (a.totalRevenue || 0)
        : (b.netProfit || 0) - (a.netProfit || 0))
      .slice(0, 5);
    const top = rows[0];
    const label = metric === 'revenue' ? 'doanh thu' : 'loi nhuan';
    if (!top) {
      return `Chua co dai ly nao co don hoan tat trong ky ${this.factDateRangeText(report.dateRange)}.`;
    }
    return [
      `Dai ly co ${label} cao nhat trong ky ${this.factDateRangeText(report.dateRange)} la ${top.agentName}: doanh thu ${this.formatMoney(top.totalRevenue)}, loi nhuan ${this.formatMoney(top.netProfit)}, ${top.totalOrders} don, margin ${this.formatPercent(top.profitMargin)}.`,
      'Top dai ly:',
      ...rows.map((row: any, index: number) =>
        `${index + 1}. ${row.agentName}: doanh thu ${this.formatMoney(row.totalRevenue)}, loi nhuan ${this.formatMoney(row.netProfit)}, don ${row.totalOrders}, hoa hong ${this.formatMoney(row.totalAgentCommission)}.`,
      ),
    ].join('\n');
  }

  private buildAdsProductProfitFactAnswer(facts: any): string {
    const report = facts.adsProducts?.current || {};
    const rows = this.asArray(report.products).slice(0, 5);
    const top = rows[0];
    if (!top) {
      return `Chua co du lieu ads theo san pham trong ky ${this.factDateRangeText(report.dateRange)}.`;
    }
    return [
      `Quang cao ve san pham co loi nhuan cao nhat trong ky ${this.factDateRangeText(report.dateRange)} la ${top.productName}: loi nhuan sau ads ${this.formatMoney(top.netProfitAfterAds)}, doanh thu gan ads ${this.formatMoney(top.adAttributedRevenue)}, spend ${this.formatMoney(top.adsSpend)}, ${top.adAttributedOrders} don gan ads.`,
      'Top san pham theo loi nhuan sau ads:',
      ...rows.map((row: any, index: number) =>
        `${index + 1}. ${row.productName}: lai sau ads ${this.formatMoney(row.netProfitAfterAds)}, spend ${this.formatMoney(row.adsSpend)}, doanh thu gan ads ${this.formatMoney(row.adAttributedRevenue)}, ty le ads/doanh thu ${row.adsRevenueRatio == null ? 'N/A' : this.formatPercent(row.adsRevenueRatio)}.`,
      ),
    ].join('\n');
  }

  private buildProductAdsRevenueRatioFactAnswer(message: string, facts: any): string {
    const report = facts.adsProducts?.current || {};
    const rows = this.asArray(report.products);
    const productName = this.extractProductNameFromQuestion(message);
    if (!productName) {
      const suggestions = rows
        .filter((row: any) => (row.adsSpend || 0) > 0 || (row.totalRevenue || 0) > 0)
        .slice(0, 5)
        .map((row: any, index: number) => `${index + 1}. ${row.productName}`)
        .join('\n');
      return [
        'Can ten san pham cu the de tinh ty le chi phi ads/doanh thu.',
        suggestions ? `Mot so san pham co du lieu:\n${suggestions}` : 'Chua co san pham nao co du lieu ads/doanh thu trong ky.',
      ].join('\n');
    }

    const matched = this.findProductAdsFact(rows, productName);
    if (!matched) {
      return [
        `Khong tim thay san pham khop voi "${productName}" trong du lieu ads/doanh thu ky ${this.factDateRangeText(report.dateRange)}.`,
        'Hay gui lai dung ten san pham trong danh sach san pham.',
      ].join('\n');
    }

    return [
      `San pham ${matched.productName} trong ky ${this.factDateRangeText(report.dateRange)}: chi phi ads ${this.formatMoney(matched.adsSpend)}, doanh thu ${this.formatMoney(matched.totalRevenue)}.`,
      `Ty le ads/doanh thu = ${matched.adsRevenueRatio == null ? 'N/A do doanh thu = 0' : this.formatPercent(matched.adsRevenueRatio)}.`,
      `Neu chi tinh don gan ads: doanh thu ${this.formatMoney(matched.adAttributedRevenue)}, ty le ${matched.adAttributedAdsRevenueRatio == null ? 'N/A' : this.formatPercent(matched.adAttributedAdsRevenueRatio)}, loi nhuan sau ads ${this.formatMoney(matched.netProfitAfterAds)}.`,
    ].join('\n');
  }

  private factDateRangeText(dateRange: any): string {
    if (!dateRange?.from || !dateRange?.to) return 'khong ro ky';
    return `${dateRange.from} den ${dateRange.to}`;
  }

  private extractProductNameFromQuestion(message: string): string | null {
    const text = String(message || '').replace(/\s+/g, ' ').trim();
    const normalized = this.removeVietnameseTone(text).toLowerCase();
    if (!normalized || normalized.includes('san pham ...') || normalized.endsWith('san pham')) return null;
    const match = normalized.match(/san pham\s+(.+?)(?:\?|$)/) || normalized.match(/product\s+(.+?)(?:\?|$)/);
    const value = match?.[1]?.trim().replace(/^la\s+/, '').replace(/^ten\s+/, '');
    if (!value || ['gi', 'nao', '...', '.'].includes(value)) return null;
    return value;
  }

  private findProductAdsFact(rows: any[], productName: string) {
    const target = this.removeVietnameseTone(productName || '').toLowerCase().trim();
    if (!target) return null;
    return this.asArray(rows).find((row: any) => {
      const name = this.removeVietnameseTone(String(row.productName || '')).toLowerCase();
      const sku = this.removeVietnameseTone(String(row.productSku || '')).toLowerCase();
      return name === target || sku === target || name.includes(target) || target.includes(name);
    }) || null;
  }

  private buildRuleBasedAnswer(
    message: string,
    snapshot: AiOperatorSnapshot,
    recommendations: AiOperatorRecommendation[],
    knowledge: ReturnType<typeof buildAiOperatorKnowledge>,
    role?: string,
    route?: AiOperatorContextRoute,
  ): string {
    const normalized = this.removeVietnameseTone(message).toLowerCase();
    const inferredIntent = route?.intent || this.intentFromTextOrRole(message, role);
    if (BUSINESS_FACT_INTENTS.includes(inferredIntent)) {
      return this.buildBusinessFactAnswer(message, snapshot, inferredIntent);
    }
    if (inferredIntent === 'ad_group_profit_classification' || this.isAdGroupProfitClassificationRequest(normalized)) {
      return this.buildAdGroupProfitClassificationAnswer(snapshot);
    }
    if (inferredIntent === 'ads_diagnostic_checklist' || this.isAdsDiagnosticChecklistRequest(normalized)) {
      return this.buildAdsDiagnosticChecklistAnswer(snapshot);
    }
    if (normalized.includes('token') || normalized.includes('api key') || normalized.includes('openai')) {
      return this.buildTokenManagementAnswer();
    }
    if (normalized.includes('api') || normalized.includes('endpoint') || normalized.includes('erp')) {
      return this.buildApiCatalogAnswer();
    }
    if (['free_cash_summary', 'cashflow_forecast', 'ads_budget_cashflow_gate', 'advanced_cashflow_scenario', 'scenario_analysis', 'owner_withdrawal_readiness', 'unit_economics'].includes(inferredIntent)) {
      return this.buildCfoDecisionContractAnswer(snapshot, recommendations, inferredIntent);
    }
    if (['marketing_funnel_health', 'creative_fatigue_review', 'offer_performance_review', 'channel_mix_review', 'channel_profitability_review', 'resource_allocation_decision', 'product_decision_review', 'ads_scale_readiness', 'ads_kill_or_pause_recommendation', 'lead_quality_by_campaign', 'attribution_quality_check'].includes(inferredIntent)) {
      return this.buildMarketingOptimizationContractAnswer(snapshot, recommendations, inferredIntent);
    }
    if (inferredIntent === 'sales_sla_task_creation') {
      return this.buildSalesSlaTaskCreationAnswer(snapshot);
    }
    if (inferredIntent === 'decision_waiting_approval' || inferredIntent === 'ai_recommendation_review') {
      return this.buildDecisionWaitingApprovalAnswer(snapshot, recommendations);
    }
    if (['company_kpi_scorecard', 'target_gap_analysis', 'period_comparison'].includes(inferredIntent)) {
      return this.buildCompanyKpiScorecardAnswer(snapshot, recommendations);
    }
    if (['director_daily_overview', 'director_weekly_priority', 'business_risk_ranking', 'root_cause_analysis', 'anomaly_detection_daily', 'priority_ranking', 'owner_accountability_review', 'concise_role_briefing'].includes(inferredIntent)) {
      return this.buildDirectorOverviewAnswer(snapshot, recommendations);
    }
    if (inferredIntent === 'finance') {
      return this.buildFinanceAnswer(snapshot, recommendations);
    }
    if (inferredIntent === 'receivables') {
      return this.buildReceivablesAnswer(snapshot, recommendations);
    }
    if (inferredIntent === 'ads') {
      return this.buildAdsAnswer(snapshot, recommendations);
    }
    if (inferredIntent === 'orders') {
      return this.buildOrdersAnswer(snapshot);
    }
    if (inferredIntent === 'sales' || inferredIntent === 'customer_value_analysis') {
      return this.buildSalesAnswer(snapshot);
    }
    if (inferredIntent === 'supplier') {
      return this.buildSupplierAnswer(snapshot);
    }
    if (inferredIntent === 'operations') {
      return this.buildOperationsAnswer(snapshot, recommendations);
    }
    if ((inferredIntent === 'overview' || inferredIntent === 'loose') && role) {
      return this.buildRoleDecisionAnswer(role, snapshot, recommendations, knowledge);
    }
    if (
      normalized.includes('tinh huong') ||
      normalized.includes('van hanh') ||
      normalized.includes('giam doc') ||
      normalized.includes('quan ly') ||
      normalized.includes('sale') ||
      normalized.includes('ke toan') ||
      normalized.includes('ads')
    ) {
      return this.buildRoleDecisionAnswer(role, snapshot, recommendations, knowledge);
    }
    if (normalized.includes('lead') || normalized.includes('sale')) {
      return [
        'Hien snapshot backend chua co module leads rieng de ket luan sale nao dang bo sot lead.',
        'Can noi them nguon lead hoac map lead tu chat-message/pending-order truoc khi AI cham SLA sale chinh xac.',
      ].join('\n');
    }

    const top = recommendations.slice(0, 5);
    if (!top.length) {
      return [
        'Hom nay chua thay canh bao lon tu cac nguon du lieu doc duoc.',
        'AI da doc tai chinh, ads, don hang va cong no; phan lead/invoice rieng chua co module ro trong backend hien tai.',
      ].join('\n');
    }

    return [
      'Ket luan ngan: Co viec can xem theo du lieu ERP hien co.',
      `Du lieu da doc: ${this.loadedSourceSummary(snapshot)}.`,
      `Phan tich tinh huong: He thong tim thay ${recommendations.length} khuyen nghi trong ky ${snapshot.windowDays} ngay.`,
      'Viec can lam:',
      ...top.map((item) => `- ${item.title}: ${item.proposedAction}`),
      `Rui ro/thieu du lieu: ${snapshot.dataGaps.length ? snapshot.dataGaps.join(' | ') : 'chua thay canh bao thieu du lieu lon trong snapshot.'}`,
      'Can duyet: Chua co hanh dong nao duoc thuc hien; moi thao tac tai chinh/ads/payment van can nguoi duyet.',
    ].join('\n');
  }

  private buildCompanyKpiScorecardAnswer(snapshot: AiOperatorSnapshot, recommendations: AiOperatorRecommendation[]): string {
    const facts = snapshot.businessFacts?.data;
    const today = facts?.productProfit?.today?.totals || {};
    const yesterday = facts?.productProfit?.yesterday?.totals || {};
    const monthToDate = facts?.productProfit?.monthToDate?.totals || {};
    const dashboard = snapshot.finance.dashboard.data;
    const adsClassification = snapshot.ads.profitClassification?.data;
    const topIssues = recommendations.slice(0, 5);
    const targetRevenue = Number(facts?.targets?.monthRevenue || 0);
    const targetProgress = targetRevenue > 0
      ? `${this.formatPercent((Number(monthToDate.totalRevenue || 0) / targetRevenue) * 100)} muc tieu thang`
      : 'chua co target doanh thu thang trong snapshot';

    return [
      'Ket luan: KPI cong ty can doc theo doanh thu, loi nhuan, dong tien va ads/order risk cung luc.',
      `Hom nay: doanh thu ${this.formatMoney(today.totalRevenue || 0)}, loi nhuan ${this.formatMoney(today.netProfit || 0)}, don hoan tat ${today.totalOrders || 0}.`,
      `Hom qua: doanh thu ${this.formatMoney(yesterday.totalRevenue || 0)}, loi nhuan ${this.formatMoney(yesterday.netProfit || 0)}, don hoan tat ${yesterday.totalOrders || 0}.`,
      `Thang nay: doanh thu ${this.formatMoney(monthToDate.totalRevenue || 0)}, loi nhuan ${this.formatMoney(monthToDate.netProfit || 0)}, don hoan tat ${monthToDate.totalOrders || 0}; tien do muc tieu: ${targetProgress}.`,
      `Dong tien: free cash ${this.formatMoney(dashboard?.freeCash || 0)}, committed cash ${this.formatMoney(dashboard?.committedCash || 0)}, runway ${dashboard?.runwayMonths == null ? 'N/A' : `${Number(dashboard.runwayMonths).toFixed(1)} thang`}.`,
      `Ads: ${adsClassification?.summary ? `lai ${adsClassification.summary.profitable || 0}, lo ${adsClassification.summary.loss || 0}, chua du du lieu ${adsClassification.summary.insufficientData || 0}` : 'chua co phan loai lai/lo nhom quang cao trong snapshot'}.`,
      'Viec can lam:',
      ...(topIssues.length ? topIssues.map((item) => `- ${item.title}: ${item.proposedAction}`) : ['- Chua co khuyen nghi uu tien cao tu snapshot hien tai.']),
      `Rui ro/thieu du lieu: ${this.dataGapSummary(snapshot)}`,
      'Can duyet: Neu can thay doi ngan sach ads, tao batch thanh toan, rut owner hoac sua gia/quote thi phai tao de xuat cho duyet truoc.',
    ].join('\n');
  }

  private buildDecisionWaitingApprovalAnswer(snapshot: AiOperatorSnapshot, recommendations: AiOperatorRecommendation[]): string {
    const approvals = recommendations.filter((item) => item.requiresApproval).slice(0, 8);
    const financeActions = this.asArray(snapshot.finance.actions?.data?.actions).slice(0, 5);
    const marketingPlans = this.asArray(snapshot.strategic.aiMarketingPlans?.data?.plans || snapshot.strategic.aiMarketingPlans?.data).slice(0, 5);
    const marketingEvaluations = this.asArray(snapshot.strategic.aiMarketingEvaluations?.data?.evaluations || snapshot.strategic.aiMarketingEvaluations?.data).slice(0, 5);
    const opsActions = this.asArray(snapshot.operations?.data?.suggestions || snapshot.operations?.data?.actions || snapshot.operations?.data).slice(0, 5);
    const totalSignals = approvals.length + financeActions.length + marketingPlans.length + marketingEvaluations.length + opsActions.length;

    const lines = [
      `Ket luan: ${totalSignals ? `Co ${totalSignals} tin hieu/de xuat can xem truoc khi duyet.` : 'Chua thay hang doi phe duyet ro trong snapshot hien tai.'}`,
      'Danh sach uu tien:',
      ...(approvals.length
        ? approvals.map((item) => `- ${item.title}: ${item.reason}. De xuat: ${item.proposedAction}`)
        : ['- Chua co recommendation requiresApproval trong snapshot.']),
    ];

    if (financeActions.length) {
      lines.push(`Financial actions: ${financeActions.map((item: any) => item.title || item.type || item.action || item.id).filter(Boolean).join('; ')}.`);
    }
    if (marketingPlans.length || marketingEvaluations.length) {
      lines.push(`AI marketing cho duyet: plans=${marketingPlans.length}, evaluations=${marketingEvaluations.length}.`);
    }
    if (opsActions.length) {
      lines.push(`Ops suggestions: ${opsActions.map((item: any) => item.title || item.type || item.id).filter(Boolean).join('; ')}.`);
    }

    lines.push(`Rui ro/thieu du lieu: ${this.dataGapSummary(snapshot)}`);
    lines.push('Can duyet: AI chi tong hop. Approved/executed chi duoc noi khi co executor/audit log thanh cong.');
    return lines.join('\n');
  }

  private buildCfoDecisionContractAnswer(
    snapshot: AiOperatorSnapshot,
    recommendations: AiOperatorRecommendation[],
    intent: AiOperatorIntent,
  ): string {
    const dashboard = snapshot.finance.dashboard.data;
    const forecast = snapshot.finance.forecast.data;
    const budgetPreview = snapshot.strategic.budgetPreview.data;
    const availableFunds = snapshot.strategic.availableFunds.data?.latest;
    const freeCash = Number(dashboard?.freeCash ?? availableFunds?.available ?? 0);
    const lowPoint = Number(forecast?.lowPoint ?? dashboard?.freeCash ?? 0);
    const blockedByCash = freeCash <= 0 || lowPoint < 0 || budgetPreview?.systemLocked || budgetPreview?.globalStatus === 'blocked';
    const paymentPriorities = recommendations
      .filter((item) => item.type.includes('finance') || item.type.includes('loan') || item.type.includes('supplier') || item.type.includes('agent'))
      .slice(0, 4);

    return [
      `Ket luan: ${blockedByCash ? 'Chua nen duyet hanh dong chi tien/tang ads.' : 'Co the lap de xuat co kiem soat, nhung van can phe duyet.'}`,
      `cashStatus: ${blockedByCash ? 'tight' : 'safe'}.`,
      `freeCash: ${this.formatMoney(freeCash)}.`,
      `forecastRisk: diem tien thap nhat ${this.formatMoney(lowPoint)}; budget gate ${budgetPreview?.systemLocked ? 'dang khoa' : 'chua khoa'}.`,
      `allowedActions: ${blockedByCash ? 'chi sua du lieu, thu hoi cong no, giam chi bat buoc' : 'co the tao draft tang ads/rut/chi tien trong gioi han rule'}.`,
      `blockedActions: ${blockedByCash ? 'tang ngan sach ads, rut owner fund, tra them khoan khong bat buoc' : 'khong co hanh dong bi chan boi fallback hien tai'}.`,
      'paymentPriorities:',
      ...(paymentPriorities.length ? paymentPriorities.map((item) => `- ${item.title}: ${item.proposedAction}`) : ['- Chua co uu tien thanh toan tu snapshot.']),
      `risks: ${this.dataGapSummary(snapshot)}`,
      'Can duyet: Moi thay doi ngan sach ads/rut owner/tra no/tao batch thanh toan phai tao draft action va approval request truoc khi executor goi API that.',
      `Intent: ${intent}.`,
    ].join('\n');
  }

  private buildMarketingOptimizationContractAnswer(
    snapshot: AiOperatorSnapshot,
    recommendations: AiOperatorRecommendation[],
    intent: AiOperatorIntent,
  ): string {
    const classification = snapshot.ads.profitClassification.data;
    const groups = this.asArray(classification?.groups);
    const profitableGroups = groups.filter((item: any) => item.status === 'profitable').slice(0, 5);
    const lossGroups = groups.filter((item: any) => item.status === 'loss').slice(0, 5);
    const marketing = snapshot.manager?.marketing?.data || snapshot.strategic.aiMarketingOverview.data || {};
    const costPerOrder = snapshot.ads.costPerOrder.data;
    const budgetPreview = snapshot.strategic.budgetPreview.data || snapshot.manager?.budgetPreview?.data;
    const financeGateAllowed = !(budgetPreview?.systemLocked || budgetPreview?.globalStatus === 'blocked');
    const creativeIssues = this.asArray(marketing.creativeIssues || marketing.creatives?.issues || marketing.alerts).slice(0, 5);
    const funnelBottlenecks = this.asArray(marketing.bottlenecks || marketing.funnel?.bottlenecks || marketing.overview?.bottlenecks).slice(0, 5);
    const salesIssues = recommendations.filter((item) => item.type.includes('conversation') || item.type.includes('sla')).slice(0, 4);
    const scaleCandidates = recommendations.filter((item) => item.type.includes('increase') || item.type.includes('scale')).slice(0, 5);
    const pauseCandidates = recommendations.filter((item) => item.type.includes('kill') || item.type.includes('loss') || item.type.includes('pause')).slice(0, 5);
    const cpoText = costPerOrder?.summary?.blendedCostPerOrder == null
      ? 'N/A'
      : this.formatMoney(costPerOrder.summary.blendedCostPerOrder);
    const funnelBottleneckText = funnelBottlenecks.length
      ? JSON.stringify(funnelBottlenecks).slice(0, 500)
      : `chua co bottleneck ro; CPO ${cpoText}`;

    return [
      `Ket luan: ${financeGateAllowed ? 'Co the phan tich toi uu marketing, nhung scale van phai qua CFO gate.' : 'Marketing khong duoc scale vi finance gate dang chan.'}`,
      `profitableGroups: ${profitableGroups.length}; lossGroups: ${lossGroups.length}; watchGroups: ${groups.length - profitableGroups.length - lossGroups.length}.`,
      `scaleCandidates: ${scaleCandidates.length ? scaleCandidates.map((item) => item.title).join('; ') : 'chua co ung vien scale du manh'}.`,
      `pauseCandidates: ${pauseCandidates.length ? pauseCandidates.map((item) => item.title).join('; ') : 'chua co ung vien pause duoc xac nhan'}.`,
      `creativeIssues: ${creativeIssues.length ? JSON.stringify(creativeIssues).slice(0, 500) : 'chua co creative issue ro trong snapshot'}.`,
      `funnelBottlenecks: ${funnelBottleneckText}.`,
      `salesIssues: ${salesIssues.length ? salesIssues.map((item) => item.title).join('; ') : 'chua co SLA sale issue ro trong snapshot'}.`,
      `financeGate: allowed=${financeGateAllowed}; reason=${budgetPreview?.recommendation || budgetPreview?.globalStatus || 'khong thay block tu budget preview'}.`,
      'recommendedActions:',
      ...(recommendations.slice(0, 5).length ? recommendations.slice(0, 5).map((item) => `- ${item.title}: ${item.proposedAction}`) : ['- Bo sung funnel/creative/offer data truoc khi ra quyet dinh manh.']),
      `Rui ro/thieu du lieu: ${this.dataGapSummary(snapshot)}`,
      `Intent: ${intent}.`,
    ].join('\n');
  }

  private buildSalesSlaTaskCreationAnswer(snapshot: AiOperatorSnapshot): string {
    const conversations = snapshot.manager?.conversations?.data || {};
    const pendingOrders = snapshot.manager?.pendingOrders?.data || {};
    const needsHuman = Number(conversations.needsHuman || conversations.needsHumanCount || 0);
    const awaitingOrder = Number(conversations.awaitingOrder || conversations.awaitingOrderCount || 0);
    const pendingRows = this.asArray(pendingOrders.recentPending).slice(0, 10);
    const draftCount = Math.max(needsHuman + awaitingOrder, pendingRows.length);

    return [
      'proposedAction: Tao task nhap cho sale xu ly lead/hoi thoai qua SLA.',
      'entity: lead/conversation/pending-order.',
      `beforeState: needsHuman=${needsHuman}; awaitingOrder=${awaitingOrder}; pendingRows=${pendingRows.length}.`,
      `afterState: ${draftCount} task nhap cho duyet, chua giao viec that.`,
      'reason: Lead qua han/chua goi lam giam ty le chot va khong duoc dung de ket luan ads loi neu sale SLA dang vi pham.',
      'expectedImpact: Giam lead bo sot va tach ro trach nhiem sale truoc khi quy ket cho marketing.',
      `risks: ${this.dataGapSummary(snapshot)}`,
      'requiredApproval: manager approve draft task truoc khi assign.',
      'status: draft.',
    ].join('\n');
  }

  private buildRoleDecisionAnswer(
    role: string | undefined,
    snapshot: AiOperatorSnapshot,
    recommendations: AiOperatorRecommendation[],
    knowledge: ReturnType<typeof buildAiOperatorKnowledge>,
  ): string {
    const normalizedRole = this.removeVietnameseTone(role || '').toLowerCase();
    if (normalizedRole.includes('director') || normalizedRole.includes('giam doc')) {
      return this.buildDirectorOverviewAnswer(snapshot, recommendations);
    }
    if (normalizedRole.includes('account') || normalizedRole.includes('cfo') || normalizedRole.includes('ke toan')) {
      return this.buildAccountantOverviewAnswer(snapshot, recommendations);
    }
    if (normalizedRole.includes('manager') || normalizedRole.includes('quan ly')) {
      return this.buildManagerOverviewAnswer(snapshot, recommendations);
    }
    if (normalizedRole.includes('ads')) {
      return this.buildAdsAnswer(snapshot, recommendations);
    }
    if (normalizedRole.includes('sale') || normalizedRole.includes('agent')) {
      return this.buildSalesAnswer(snapshot);
    }
    if (normalizedRole.includes('supplier') || normalizedRole.includes('nha cung cap')) {
      return this.buildSupplierAnswer(snapshot);
    }
    return this.buildRolePlaybookAnswer(role, knowledge);
  }

  private buildDirectorOverviewAnswer(snapshot: AiOperatorSnapshot, recommendations: AiOperatorRecommendation[]): string {
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
      ? `free cash ${this.formatMoney(dashboard.freeCash)}, committed 14 ngay ${this.formatMoney(dashboard.committedCash)}, runway ${dashboard.runwayMonths == null ? 'khong gioi han neu burn=0' : `${Number(dashboard.runwayMonths).toFixed(1)} thang`}`
      : 'chua doc duoc Financial Control dashboard';
    const forecastLine = forecast
      ? `diem tien thap nhat 7 ngay ${this.formatMoney(forecast.lowPoint)} tai T+${forecast.lowPointDay}`
      : 'chua doc duoc forecast 7 ngay';
    const cashDepth = [
      availableFunds ? `available conservative ${this.formatMoney(availableFunds.available || 0)}` : 'available funds chua doc duoc',
      loanDashboard ? `no den han 14 ngay ${this.formatMoney(loanDashboard.due14Days || 0)}` : 'loan dashboard chua doc duoc',
      budgetPreview ? `ads dry-run locked=${budgetPreview.systemLocked ? 'co' : 'khong'}` : 'budget preview chua doc duoc',
      ownerFund ? `owner fund balance ${this.formatMoney(ownerFund.totalBalance || 0)}` : 'owner fund chua doc duoc',
    ].join('; ');
    const commitments = `luong outstanding ${this.formatMoney(laborCashflow?.summary?.outstanding || 0)}, chi phi khac outstanding ${this.formatMoney(otherCostCashflow?.summary?.outstanding || 0)}`;

    return [
      `Ket luan ngan: Giam doc nen xem dong tien truoc, sau do moi den ads/cong no.`,
      `Du lieu da doc: ${this.loadedSourceSummary(snapshot)}.`,
      `Phan tich tinh huong: ${financeStatus}; ${forecastLine}; ${cashDepth}; ${commitments}.`,
      'Viec can lam:',
      ...(top.length ? top.map((item) => `- ${item.title}: ${item.proposedAction}`) : ['- Chua co khuyen nghi uu tien cao tu snapshot hien tai.']),
      `Rui ro/thieu du lieu: ${this.dataGapSummary(snapshot)}`,
      'Can duyet: Rut owner, tra no, tao batch thanh toan, tang/giam/tat ads that deu can xac nhan ro ID, so tien/pham vi va nguoi duyet.',
    ].join('\n');
  }

  private buildAccountantOverviewAnswer(snapshot: AiOperatorSnapshot, recommendations: AiOperatorRecommendation[]): string {
    const finance = this.buildFinanceAnswer(snapshot, recommendations);
    const receivables = this.buildReceivablesAnswer(snapshot, recommendations);
    return [
      'Ket luan ngan: Ke toan/CFO nen uu tien dong tien that, cong no den han va chung tu truoc khi ghi nhan thanh toan.',
      finance,
      receivables,
    ].join('\n');
  }

  private buildManagerOverviewAnswer(snapshot: AiOperatorSnapshot, recommendations: AiOperatorRecommendation[]): string {
    const operations = snapshot.operations.data;
    const actions = this.asArray(operations?.actions || operations?.items || operations);
    const orders = snapshot.orders.data;
    const employeeKpi = snapshot.manager?.employeeKpi?.data;
    const tokenHealth = snapshot.manager?.tokenHealth?.data;
    const syncHealth = snapshot.ads.syncHealth?.data;
    const budgetPreview = snapshot.manager?.budgetPreview?.data || snapshot.strategic.budgetPreview.data;
    const costPerOrder = snapshot.ads.costPerOrder?.data;
    const marketing = snapshot.manager?.marketing?.data;
    const conversations = snapshot.manager?.conversations?.data;
    const pendingOrders = snapshot.manager?.pendingOrders?.data;
    const managerRecommendations = recommendations
      .filter((item) =>
        item.type.startsWith('manager.') ||
        item.type.startsWith('ops.') ||
        item.type.startsWith('ads.') ||
        item.type.includes('budget') ||
        item.type.includes('order'),
      )
      .slice(0, 6);
    const kpiLine = employeeKpi?.summary
      ? `KPI Ads: ${employeeKpi.summary.employeeCount || 0} nhan vien, ${employeeKpi.summary.underperformerCount || 0} under KPI, ${employeeKpi.summary.criticalAlerts || 0} alert critical`
      : 'KPI Ads: chua doc duoc employee KPI';
    const tokenLine = tokenHealth?.summary
      ? `Token: ${tokenHealth.summary.activeTokens || 0}/${tokenHealth.summary.totalTokens || 0} active, failing ${tokenHealth.summary.failing || 0}, expiring ${tokenHealth.summary.expiringSoon || 0}`
      : 'Token: chua doc duoc api-token health';
    const syncLine = syncHealth?.summary
      ? `Sync: ${syncHealth.summary.okPlatforms || 0}/${syncHealth.summary.platforms || 0} platform ok, stale ${syncHealth.summary.stalePlatforms || 0}, token issue ${syncHealth.summary.tokenIssues || 0}`
      : 'Sync: chua doc duoc ads sync health';
    const cpoLine = costPerOrder?.summary
      ? `CPO: blended ${costPerOrder.summary.blendedCostPerOrder == null ? 'N/A' : this.formatMoney(costPerOrder.summary.blendedCostPerOrder)}, no-order-spend ${costPerOrder.summary.noOrdersWithSpend || 0}`
      : 'CPO: chua doc duoc cost/order';
    const marketingReadiness = marketing?.overview?.readiness?.status || snapshot.strategic.aiMarketingOverview.data?.readiness?.status || 'chua co';
    const cashGate = budgetPreview?.systemLocked
      ? 'budget/cashflow gate dang khoa scale'
      : budgetPreview?.summary
        ? `budget dry-run ok ${budgetPreview.summary.successCount || 0}, skipped ${budgetPreview.summary.skippedCount || 0}`
        : 'chua doc duoc budget dry-run';
    const orderLine = orders
      ? `${orders.totalInWindow || 0} don trong ky, supplier pending ${orders.pendingPayments?.supplierPending || 0}, agent pending ${orders.pendingPayments?.agentPending || 0}`
      : 'chua doc duoc order snapshot';
    const conversationLine = conversations
      ? `needs human ${conversations.needsHuman || 0}, awaiting order ${conversations.awaitingOrder || 0}, pending snapshot ${this.asArray(pendingOrders?.recentPending).length}`
      : 'chua doc duoc conversation snapshot';

    return [
      'Ket luan ngan: Manager nen chot viec nong theo thu tu: cash/budget gate, ads/KPI, token-sync, order/SLA.',
      `Du lieu da doc: ${this.loadedSourceSummary(snapshot)}.`,
      `Phan tich tinh huong: ${cashGate}; ${kpiLine}; ${tokenLine}; ${syncLine}; ${cpoLine}; AI Marketing readiness ${marketingReadiness}; orders ${orderLine}; conversations ${conversationLine}; ops actions ${actions.length || 0}.`,
      'Viec can lam:',
      ...(managerRecommendations.length
        ? managerRecommendations.map((item) => `- ${item.title}: ${item.proposedAction}`)
        : [
            '- Chot owner cho ops actions/ads alerts dang mo.',
            '- Soat nhan vien Ads under KPI hoac qua tai truoc khi gan them ad group.',
            '- Kiem tra token/sync health neu so lieu ads/fanpage bat thuong.',
          ]),
      `Rui ro/thieu du lieu: ${this.dataGapSummary(snapshot)}`,
      'Can duyet: Bulk assign ad group, pause/scale ads, validate/rotate token, approve pending order va bat/tat auto-AI hoi thoai can xac nhan ro ID/pham vi.',
    ].join('\n');
  }

  private buildReceivablesAnswer(snapshot: AiOperatorSnapshot, recommendations: AiOperatorRecommendation[]): string {
    const receivables = snapshot.receivables.data;
    if (!receivables) {
      return [
        'Ket luan ngan: Chua doc duoc cong no NCC/dai ly.',
        `Du lieu da doc: ${this.loadedSourceSummary(snapshot)}.`,
        'Phan tich tinh huong: Thieu supplier-payable/agent-receivable lam cac quyet dinh chi tien va free cash co the sai.',
        'Viec can lam: Nap lai source cong no, kiem tra permission va doi chieu statement dang mo.',
        'Rui ro/thieu du lieu: Can nap supplier-payable/agent-receivable context truoc khi ket luan cong no.',
        'Can duyet: Khong tao batch/dong statement/ghi nhan payment khi chua co danh sach statement va tong tien.',
      ].join('\n');
    }

    const supplierOpen = receivables.supplier?.open || {};
    const agentOpen = receivables.agent?.open || {};
    const supplierOverdue = this.asArray(receivables.supplier?.overdue);
    const agentOverdue = this.asArray(receivables.agent?.overdue);
    const receivableRecommendations = recommendations.filter((item) =>
      item.type.includes('supplier') || item.type.includes('agent') || item.type.includes('receivable') || item.type.includes('payable'),
    );

    return [
      'Ket luan ngan: Can soat cong no qua han va statement dang mo truoc khi ra quyet dinh chi tien.',
      `Du lieu da doc: NCC open ${supplierOpen.count || 0} khoan, balance ${this.formatMoney(supplierOpen.balance || 0)}; dai ly open ${agentOpen.count || 0} statement, balance ${this.formatMoney(agentOpen.closingBalance || 0)}.`,
      `Phan tich tinh huong: NCC qua han ${supplierOverdue.length}; dai ly qua han ${agentOverdue.length}.`,
      'Viec can lam:',
      ...(receivableRecommendations.length
        ? receivableRecommendations.slice(0, 5).map((item) => `- ${item.title}: ${item.proposedAction}`)
        : ['- Kiem tra statement qua han, doi chieu chung tu va xac nhan owner phu trach tung khoan.']),
      `Rui ro/thieu du lieu: ${this.dataGapSummary(snapshot)}`,
      'Can duyet: Tao/dong statement, ghi nhan payment, batch thanh toan lon va rollback cong no can nguoi duyet.',
    ].join('\n');
  }

  private buildOrdersAnswer(snapshot: AiOperatorSnapshot): string {
    const orders = snapshot.orders.data;
    if (!orders) {
      return [
        'Ket luan ngan: Chua doc duoc order snapshot, nen chua ket luan duoc don hang.',
        `Du lieu da doc: ${this.loadedSourceSummary(snapshot)}.`,
        'Phan tich tinh huong: Thieu order context lam ROI, cong no va pending payment co the lech.',
        'Viec can lam: Kiem tra source orders/test-order2 va permission truoc khi chot van hanh.',
        `Rui ro/thieu du lieu: ${this.dataGapSummary(snapshot)}`,
        'Can duyet: Khong sua trang thai/gia/payment hang loat khi chua co danh sach don va nguoi duyet.',
      ].join('\n');
    }
    const pending = orders.pendingPayments || {};
    const statuses = this.asArray(orders.byStatus)
      .slice(0, 5)
      .map((item: any) => `${item._id}: ${item.count}`)
      .join(', ');
    return [
      `Ket luan ngan: Co ${orders.totalInWindow || 0} don trong ky ${snapshot.windowDays} ngay can theo doi.`,
      `Du lieu da doc: status top ${statuses || 'khong co'}; payment pending supplier ${pending.supplierPending || 0}, agent ${pending.agentPending || 0}.`,
      'Phan tich tinh huong: Neu pending payment cao, dong tien/loi nhuan realized co the bi lech so voi bao cao uoc tinh.',
      'Viec can lam: Soat don tre, don thieu tracking, don pending payment va cac don loi nhuan am truoc khi chot bao cao.',
      `Rui ro/thieu du lieu: ${this.dataGapSummary(snapshot)}`,
      'Can duyet: Sua tien/gia/supplier/agent/trang thai thanh toan hang loat can xac nhan va audit.',
    ].join('\n');
  }

  private buildOperationsAnswer(snapshot: AiOperatorSnapshot, recommendations: AiOperatorRecommendation[]): string {
    const operations = snapshot.operations.data;
    const actions = this.asArray(operations?.actions || operations?.items || operations);
    const top = recommendations.filter((item) => item.type.startsWith('ops.') || item.type.includes('operation')).slice(0, 5);
    return [
      'Ket luan ngan: Viec van hanh nen uu tien cac task anh huong cashflow, SLA chat/order va ads alert.',
      `Du lieu da doc: ${this.loadedSourceSummary(snapshot)}; ops actions ${actions.length || 0}.`,
      `Phan tich tinh huong: ${actions.length ? 'Da co danh sach viec ops can xu ly.' : 'Chua co action ops ro trong snapshot.'}`,
      'Viec can lam:',
      ...(top.length
        ? top.map((item) => `- ${item.title}: ${item.proposedAction}`)
        : actions.slice(0, 5).map((item: any) => `- ${item.title || item.name || item.type || 'Viec can xu ly'}: ${item.description || item.reason || 'kiem tra chi tiet trong module ops'}`)),
      actions.length || top.length ? '' : '- Mo Ops Actions/Ads Alerts de chot owner va deadline.',
      `Rui ro/thieu du lieu: ${this.dataGapSummary(snapshot)}`,
      'Can duyet: Task co tac dong tai chinh, token, budget, payment hoac xoa/sua du lieu can phe duyet.',
    ].filter(Boolean).join('\n');
  }

  private buildSalesAnswer(snapshot: AiOperatorSnapshot): string {
    const orders = snapshot.orders.data;
    const totalOrders = orders?.totalInWindow || 0;
    return [
      'Ket luan ngan: Sale co the xem don/pending order, nhung module lead doc lap chua du manh de cham SLA sale 9+.',
      `Du lieu da doc: ${this.loadedSourceSummary(snapshot)}; don trong ky ${totalOrders}.`,
      'Phan tich tinh huong: Neu lead nam trong chat-message/pending-order thi AI co the ho tro nhac viec; neu lead o nguon khac thi chua du context.',
      'Viec can lam: Uu tien hoi thoai chua co so dien thoai, pending order chua chot, don thieu thong tin khach va san pham thieu gia/media.',
      `Rui ro/thieu du lieu: ${this.dataGapSummary(snapshot)}`,
      'Can duyet: Doi gia, doi supplier, sua hoa hong hoặc tao don bat thuong can nguoi phu trach xac nhan.',
    ].join('\n');
  }

  private buildSupplierAnswer(snapshot: AiOperatorSnapshot): string {
    const orders = snapshot.orders.data;
    const returns = snapshot.returns?.data;
    return [
      'Ket luan ngan: Tro ly supplier nen chi doc va goi y trong pham vi don cua supplier, khong xem tai chinh toan cong ty.',
      `Du lieu da doc: ${this.loadedSourceSummary(snapshot)}; don trong ky ${orders?.totalInWindow || 0}; don hoan ${returns?.summary?.returnOrders || 0}.`,
      'Phan tich tinh huong: Nen uu tien don tre san xuat/giao hang, don thieu tracking, don hoan va phieu return can cap nhat ly do.',
      'Viec can lam: Cap nhat tracking/trang thai, ghi chu don loi, va bao ops khi co khieu nai hoac lech COD.',
      `Rui ro/thieu du lieu: ${this.dataGapSummary(snapshot)}`,
      'Can duyet: Supplier khong tu sua gia, payment, statement hoac don cua supplier khac.',
    ].join('\n');
  }

  private loadedSourceSummary(snapshot: AiOperatorSnapshot): string {
    const sources = [
      ['bảng điều khiển tài chính', snapshot.finance.dashboard],
      ['dự báo dòng tiền', snapshot.finance.forecast],
      ['hành động tài chính', snapshot.finance.actions],
      ['hiệu suất quảng cáo', snapshot.ads.performance],
      ['phân loại lãi/lỗ nhóm quảng cáo', snapshot.ads.profitClassification],
      ['gợi ý quảng cáo', snapshot.ads.optimalSpendSuggestions],
      ['cảnh báo quảng cáo', snapshot.ads.alerts],
      ['chẩn đoán quảng cáo', snapshot.ads.diagnostic],
      ['sức khỏe đồng bộ quảng cáo', snapshot.ads.syncHealth],
      ['chi phí quảng cáo theo nhóm quảng cáo', snapshot.ads.costByAdGroup],
      ['chi phí quảng cáo trên mỗi đơn', snapshot.ads.costPerOrder],
      ['đơn hàng', snapshot.orders],
      ['hàng hoàn', snapshot.returns],
      ['công nợ phải thu', snapshot.receivables],
      ['vận hành', snapshot.operations],
      ['KPI nhân viên quảng cáo', snapshot.manager?.employeeKpi],
      ['sức khỏe token quảng cáo', snapshot.manager?.tokenHealth],
      ['ngữ cảnh marketing của quản lý', snapshot.manager?.marketing],
      ['hội thoại của quản lý', snapshot.manager?.conversations],
      ['đơn chờ xử lý của quản lý', snapshot.manager?.pendingOrders],
      ['ngữ cảnh media của quản lý', snapshot.manager?.media],
      ['thực thể quảng cáo của quản lý', snapshot.manager?.adEntities],
      ['tổng quan quỹ', snapshot.strategic.fundsOverview],
      ['vốn khả dụng', snapshot.strategic.availableFunds],
      ['xem trước ngân sách', snapshot.strategic.budgetPreview],
      ['bảng khoản vay', snapshot.strategic.loanDashboard],
      ['quỹ chủ sở hữu', snapshot.strategic.ownerFund],
      ['dòng tiền lương', snapshot.strategic.laborCashflow],
      ['dòng tiền chi phí khác', snapshot.strategic.otherCostCashflow],
      ['dòng tiền chi phí quảng cáo', snapshot.strategic.adsCostCashflow],
      ['tổng quan AI marketing', snapshot.strategic.aiMarketingOverview],
      ['kế hoạch AI marketing', snapshot.strategic.aiMarketingPlans],
      ['đánh giá AI marketing', snapshot.strategic.aiMarketingEvaluations],
      ['mức sẵn sàng báo giá', snapshot.strategic.quoteReadiness],
      ['kiểm toán truy cập', snapshot.strategic.accessAudit],
    ];
    const loaded = sources.filter(([, result]: any) => result?.ok && result?.data).map(([name]) => name);
    const failed = sources.filter(([, result]: any) => result && result.ok === false).map(([name]) => name);
    const chunks = [loaded.length ? `đã tải: ${loaded.join(', ')}` : 'đã tải: chưa có'];
    if (failed.length) chunks.push(`lỗi tải: ${failed.join(', ')}`);
    return chunks.join('; ');
  }

  private dataGapSummary(snapshot: AiOperatorSnapshot): string {
    return snapshot.dataGaps.length
      ? snapshot.dataGaps.join(' | ')
      : 'chua thay data gap lon trong snapshot hien tai.';
  }

  private buildPermissionDeniedAnswer(context: AiOperatorScenarioContext): string {
    const route = context.route;
    const permissions = context.auth.permissions.length ? context.auth.permissions.join(', ') : 'khong co permission nghiep vu';
    const denied = route.deniedSources?.length ? route.deniedSources.join(', ') : 'workflow/API context';
    return [
      `Backend da nhan dien intent "${route.intent}"${route.scenarioId ? ` theo workflow ${route.scenarioId}` : ''}, nhung user hien tai khong du quyen doc du lieu can thiet.`,
      `Role: ${context.auth.role || 'unknown'}; permissions: ${permissions}.`,
      `Nguon bi chan: ${denied}.`,
      'AI khong duoc dien giai hoac suy doan tren du lieu ma backend khong cho phep. Hay dung tai khoan co quyen phu hop hoac cap permission cho module lien quan.',
    ].join('\n');
  }

  private buildApiCatalogAnswer(): string {
    const lines = [
      `AI da nhan dien ${ERP_API_CATALOG.length} nhom ERP API chinh can biet khi dieu hanh he thong:`,
      ...ERP_API_CATALOG.map((item) => {
        const read = item.readEndpoints.slice(0, 3).join(', ');
        const write = item.writeEndpoints.slice(0, 2).join(', ');
        return `- ${item.domain}: ${item.purpose} Doc: ${read}. Ghi: ${write}.`;
      }),
      'Mac dinh AI Operator chi doc/tom tat/de xuat. Cac API ghi nhu tao batch, rotate token, apply budget, rut owner can xac nhan ro ID, pham vi va nguoi duyet.',
    ];
    return lines.join('\n');
  }

  private buildRolePlaybookAnswer(role?: string, knowledge?: ReturnType<typeof buildAiOperatorKnowledge>): string {
    const normalizedRole = String(role || '').trim().toLowerCase();
    const playbooks = normalizedRole
      ? ROLE_PLAYBOOKS.filter((item) => item.role === normalizedRole || item.title.toLowerCase().includes(normalizedRole))
      : ROLE_PLAYBOOKS;
    const selected = playbooks.length ? playbooks : ROLE_PLAYBOOKS;
    const workflows = (knowledge?.scenarioWorkflows || []).slice(0, 8);

    return [
      'Cac tinh huong van hanh thuong gap theo vai tro:',
      ...selected.slice(0, 6).map((playbook) => [
        `- ${playbook.title}: ${playbook.summary}`,
        `  Cau hoi moi ngay: ${playbook.dailyQuestions.slice(0, 3).join(' | ')}`,
        `  Tinh huong: ${playbook.frequentScenarios.slice(0, 3).join(' | ')}`,
      ].join('\n')),
      workflows.length ? 'Workflow/API tuong ung:' : '',
      ...workflows.map((workflow) => [
        `- ${workflow.scenarioId} ${workflow.title}: ${workflow.goal}`,
        `  Doc: ${workflow.readApis.slice(0, 3).join(', ')}`,
        `  Ghi sau duyet: ${workflow.writeApis.slice(0, 3).join(', ') || 'khong ghi'}`,
        `  Muc du API: ${workflow.apiSufficiency}; gap: ${workflow.missingDataOrApi.slice(0, 2).join(' | ') || 'khong ro'}`,
      ].join('\n')),
      'AI nen dung playbook nay de hoi lai khi thieu du lieu va khong tu thuc thi thao tac rui ro cao.',
    ].filter(Boolean).join('\n');
  }

  private buildTokenManagementAnswer(): string {
    return [
      'Quan ly AI API token trong he thong nen di theo OpenAI Config, khong tron voi token ads/social.',
      `- ${AI_TOKEN_MANAGEMENT_GUIDE.aiTokenRoutes[0].route}: tao/sua/test OpenAI API key, model, prompt, scope va config mac dinh cho AI.`,
      `- ${AI_TOKEN_MANAGEMENT_GUIDE.aiTokenRoutes[1].route}: quan ly Meta/Google/TikTok token cho sync ads va fanpage.`,
      `- ${AI_TOKEN_MANAGEMENT_GUIDE.aiTokenRoutes[2].route}: cau hinh credential sync ads theo platform.`,
      'Guardrail: khong hien full key/token trong danh sach, khong dua secret vao prompt, rotate key production phai co owner/ly do/thoi diem.',
    ].join('\n');
  }

  private buildAdGroupProfitClassificationAnswer(snapshot: AiOperatorSnapshot): string {
    const report = snapshot.ads.profitClassification?.data;
    if (!report) {
      return [
        'Tôi chưa tải được báo cáo phân loại lãi/lỗ nhóm quảng cáo.',
        `Dữ liệu đã đọc: ${this.loadedSourceSummary(snapshot)}.`,
        'Cần bổ sung hoặc tải lại nguồn `ads.ad-group-profit-classification` từ API `GET /api/ads/ad-groups/profit-classification?days=7`.',
        'Hiện chưa có hành động cần duyệt vì đây mới là yêu cầu kiểm tra, chưa yêu cầu chỉnh ads.',
      ].join('\n');
    }

    const statusLabel: Record<string, string> = {
      profitable: 'Lãi',
      loss: 'Lỗ',
      break_even: 'Hòa vốn',
      insufficient_data: 'Chưa đủ dữ liệu',
    };
    const groups = this.asArray(report.groups);
    const tableRows = groups.slice(0, 20).map((group: any) => [
      group.name || group.adGroupId || 'Không rõ',
      group.platform || '-',
      this.formatMoney(group.spend || 0),
      String(group.leads || 0),
      String(group.orders || 0),
      this.formatMoney(group.revenue || 0),
      group.netProfitAfterAds == null ? 'N/A' : this.formatMoney(group.netProfitAfterAds),
      statusLabel[group.status] || group.status || 'Không rõ',
      group.reason || '-',
    ]);
    const scalable = groups
      .filter((group: any) => group.status === 'profitable')
      .sort((a: any, b: any) => (b.netProfitAfterAds || 0) - (a.netProfitAfterAds || 0))
      .slice(0, 5);
    const reduceOrPause = groups
      .filter((group: any) => group.status === 'loss')
      .sort((a: any, b: any) => (a.netProfitAfterAds || 0) - (b.netProfitAfterAds || 0))
      .slice(0, 5);
    const insufficient = groups.filter((group: any) => group.status === 'insufficient_data').slice(0, 5);
    const listNames = (items: any[]) => items.map((item: any) => item.name || item.adGroupId).filter(Boolean).join(', ') || 'không có';

    return [
      `Tôi kiểm tra trong ${report.periodDays || snapshot.windowDays} ngày gần nhất.`,
      '',
      `Tổng số nhóm quảng cáo đọc được: ${report.total || 0} nhóm.`,
      '',
      'Phân loại:',
      `- Lãi: ${report.summary?.profitable || 0} nhóm`,
      `- Lỗ: ${report.summary?.loss || 0} nhóm`,
      `- Hòa vốn: ${report.summary?.breakEven || 0} nhóm`,
      `- Chưa đủ dữ liệu: ${report.summary?.insufficientData || 0} nhóm`,
      '',
      'Bảng chi tiết:',
      '| Nhóm | Nền tảng | Spend | Lead | Đơn | Doanh thu | Lợi nhuận sau ads | Trạng thái | Lý do |',
      '|---|---:|---:|---:|---:|---:|---:|---|---|',
      ...tableRows.map((row) => `| ${row.join(' | ')} |`),
      groups.length > tableRows.length ? `| ... còn ${groups.length - tableRows.length} nhóm khác | | | | | | | | |` : '',
      '',
      'Kết luận:',
      `- Nhóm có thể xem xét tăng: ${listNames(scalable)}.`,
      `- Nhóm cần giảm/pause hoặc kiểm tra lại: ${listNames(reduceOrPause)}.`,
      `- Nhóm chưa đủ dữ liệu: ${listNames(insufficient)}.`,
      '',
      `Dữ liệu thiếu/chất lượng dữ liệu: ${this.asArray(report.dataQuality?.notes).length ? report.dataQuality.notes.join(' | ') : 'chưa thấy cảnh báo lớn trong báo cáo phân loại.'}`,
      'Cần duyệt: hiện chưa có hành động cần duyệt vì người dùng mới yêu cầu kiểm tra, chưa yêu cầu chỉnh ads.',
    ].filter((line) => line !== '').join('\n');
  }

  private buildAdsDiagnosticChecklistAnswer(snapshot: AiOperatorSnapshot): string {
    const diagnostic = snapshot.ads.diagnostic?.data;
    if (!diagnostic) {
      return [
        'Kết luận ngắn: Chưa tải được gói chẩn đoán quảng cáo, nên chưa thể trả lời đủ 10 mục bằng số liệu thật.',
        `Dữ liệu đã đọc: ${this.loadedSourceSummary(snapshot)}.`,
        `Rủi ro/thiếu dữ liệu: ${this.dataGapSummary(snapshot)}`,
        'Cần làm: tải lại nguồn ads.diagnostic-overview hoặc cấp quyền đọc ad-accounts, ad-groups, fanpages, advertising-costs, chat-messages, pending-orders và ads-budget.',
        'Cần duyệt: chưa có hành động tăng/giảm ngân sách hay gọi provider nào được thực hiện.',
      ].join('\n');
    }

    const dateText = (value: any) => {
      if (!value) return 'chưa có dữ liệu';
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? 'chưa có dữ liệu' : parsed.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    };
    const yesNoUnknown = (value: any) => value === true ? 'có' : value === false ? 'không' : 'chưa rõ';
    const listNames = (items: any[], nameKey = 'name', limit = 5) => {
      const names = this.asArray(items)
        .slice(0, limit)
        .map((item: any) => item?.[nameKey] || item?.adGroupName || item?.accountName || item?.pageId || item?.adGroupId || item?.accountId)
        .filter(Boolean);
      return names.length ? names.join(', ') : 'không có';
    };
    const listSpend = (items: any[], labelKey = 'adGroupName', limit = 5) => {
      const rows = this.asArray(items).slice(0, limit).map((item: any) => {
        const label = item?.[labelKey] || item?.adGroupName || item?.accountName || item?.adGroupId || item?.accountId || 'unknown';
        return `${label}: ${this.formatMoney(item?.spent || 0)}`;
      });
      return rows.length ? rows.join('; ') : 'không có';
    };
    const listProfit = (items: any[], limit = 5) => {
      const rows = this.asArray(items).slice(0, limit).map((item: any) => {
        const label = item?.adGroupName || item?.name || item?.adGroupId || 'unknown';
        return `${label}: doanh thu ${this.formatMoney(item?.totalRevenue || 0)}, lợi nhuận ${this.formatMoney(item?.totalNetProfit || 0)}`;
      });
      return rows.length ? rows.join('; ') : 'không có';
    };
    const readinessLabel = (item: any) => {
      const statusMap: Record<string, string> = {
        not_ready: 'chưa đủ điều kiện',
        pending_approval: 'đề xuất chờ duyệt',
        ready_review: 'đủ dữ liệu, cần rà soát',
      };
      const label = item?.adGroupName || item?.adGroupId || 'unknown';
      return `${label}: ${statusMap[item?.status] || item?.status || 'chưa rõ'} (${item?.reason || 'không có lý do'})`;
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
    const missingData = this.asArray(diagnostic.missingData);
    const tokenSummary = accounts.tokenSummary || {};
    const syncSummary = sync.summary || {};
    const readinessItems = this.asArray(readiness.items);

    return [
      `Kết luận ngắn: Đã kiểm tra checklist quảng cáo theo cửa sổ ${diagnostic.windowDays || snapshot.windowDays} ngày. Tổng spend là ${this.formatMoney(spend7d.totalSpent || 0)}; đề xuất chờ duyệt ${readiness.summary?.pendingApproval || 0}; chưa đủ điều kiện ${readiness.summary?.notReady || 0}.`,
      '1. Kết nối tài khoản quảng cáo:',
      `- Đã kiểm tra: có. Tài khoản: ${accounts.total || 0} tổng, ${accounts.active || 0} active. Token còn hạn/hợp lệ: ${yesNoUnknown(accounts.tokenValid)}; active token ${tokenSummary.activeTokens ?? 'chưa rõ'}/${tokenSummary.totalTokens ?? 'chưa rõ'}, expired ${tokenSummary.expired ?? 'chưa rõ'}, failing ${tokenSummary.failing ?? 'chưa rõ'}. Lỗi provider: ${accounts.providerErrorCount || 0}; mẫu lỗi: ${listNames(accounts.providerErrors, 'source', 3)}.`,
      '2. Fanpage:',
      `- Fanpage đã kết nối: ${fanpages.total || 0}; active: ${fanpages.active || 0}. Fanpage active: ${listNames(fanpages.activePages, 'name', 6)}. Thiếu quyền/webhook/token: ${fanpages.missingPermissionCount || 0}; mẫu: ${listNames(fanpages.missingPermissions, 'name', 5)}.`,
      '3. Đồng bộ dữ liệu:',
      `- Lần sync gần nhất: ${dateText(sync.lastSyncAt)}. Facebook lỗi: ${yesNoUnknown(sync.hasFacebookError)}; Google lỗi: ${yesNoUnknown(sync.hasGoogleError)}. Sync health: ok ${syncSummary.okPlatforms ?? 'chưa rõ'}/${syncSummary.platforms ?? 'chưa rõ'}, stale ${syncSummary.stalePlatforms ?? 'chưa rõ'}, token issue ${syncSummary.tokenIssues ?? 'chưa rõ'}. Log lỗi: ${listNames(sync.errorLogs, 'source', 5)}.`,
      '4. Campaign/adset/ad:',
      `- Campaign active suy từ ad group: ${entities.campaigns?.activeInferred || 0}/${entities.campaigns?.totalInferred || 0}. Adset/ad group active: ${entities.adsets?.active || 0}/${entities.adsets?.total || 0}. Ads active: chưa đếm được vì chưa có collection Ads/Creative riêng. Campaign/adset paused/error: ${entities.adsets?.pausedOrError || 0}; mẫu: ${listNames(entities.adsets?.pausedOrErrorItems, 'name', 5)}.`,
      '5. Spend 7 ngày:',
      `- Tổng spend: ${this.formatMoney(spend7d.totalSpent || 0)}; records ${spend7d.records || 0}, impressions ${spend7d.impressions || 0}, clicks ${spend7d.clicks || 0}, conversations ${spend7d.conversations || 0}. Theo tài khoản: ${listSpend(spend7d.byAccount, 'accountName', 5)}. Theo nhóm quảng cáo: ${listSpend(spend7d.byAdGroup, 'adGroupName', 5)}.`,
      '6. Lead/inbox/form:',
      `- Lead suy từ unique sender/inbox: ${leads.leadCount || 0}; inbox message: ${leads.inboxCount || 0}; form: chưa có module/Form API riêng; pending order: ${leads.pendingOrders || 0}. Lead chưa xử lý: ${leads.unhandledLeadCount || 0} gồm needsHuman ${leads.needsHuman || 0}, awaiting message ${leads.awaitingMessages || 0}, draft/awaiting order ${(leads.pendingByStatus?.draft || 0) + (leads.pendingByStatus?.awaiting || 0)}.`,
      '7. Lead gắn ERP:',
      `- Lead/conversation đã gắn khách/đơn hoặc pending-order: ${attribution.linkedToErp || 0}. Chưa attribution được: ${attribution.unattributed || 0}; conversation có ad group: ${attribution.conversationsWithAdGroup || 0}.`,
      '8. Doanh thu/lợi nhuận theo nhóm quảng cáo:',
      `- Nhóm có doanh thu: ${this.asArray(profit.groupsWithRevenue).length}; ${listProfit(profit.groupsWithRevenue, 5)}. Nhóm có lợi nhuận dương: ${this.asArray(profit.groupsWithProfit).length}; ${listProfit(profit.groupsWithProfit, 5)}. Nhóm chưa có dữ liệu profit/order: ${this.asArray(profit.groupsWithoutData).length}; ${listNames(profit.groupsWithoutData, 'name', 5)}.`,
      '9. Nhóm lỗ/lãi:',
      `- Nhóm lãi: ${this.asArray(pnl.winning).length}; ${listProfit(pnl.winning, 5)}. Nhóm lỗ: ${this.asArray(pnl.losing).length}; ${listProfit(pnl.losing, 5)}. Nhóm chưa đủ dữ liệu: ${this.asArray(pnl.insufficientData).length}; ${listNames(pnl.insufficientData, 'name', 5)}.`,
      '10. Đủ điều kiện tăng/giảm ngân sách chưa:',
      `- Quy tắc đang dùng: spend = 0 thì chưa đủ điều kiện; thiếu lead/profit thì chưa đủ điều kiện; đủ dữ liệu thì chỉ tạo đề xuất chờ duyệt, không tự apply provider. Kết quả: kiểm tra ${readiness.summary?.totalChecked || 0} nhóm, chưa đủ điều kiện ${readiness.summary?.notReady || 0}, đề xuất chờ duyệt ${readiness.summary?.pendingApproval || 0}, đủ dữ liệu cần rà soát ${readiness.summary?.readyReview || 0}. Mẫu: ${readinessItems.slice(0, 8).map(readinessLabel).join('; ') || 'không có'}.`,
      `Rủi ro/thiếu dữ liệu: ${missingData.length ? missingData.join(' | ') : this.dataGapSummary(snapshot)}`,
      'Cần duyệt: Chưa có hành động tăng/giảm ngân sách, pause ads hoặc gọi provider nào được thực hiện.',
    ].join('\n');
  }

  private buildAdsAnswer(snapshot: AiOperatorSnapshot, recommendations: AiOperatorRecommendation[]): string {
    const adsRecommendations = recommendations.filter((item) => item.type.startsWith('ads.'));
    const performance = this.asArray(snapshot.ads.performance.data);
    const losingCount = performance.filter((ad: any) => (ad.totalAdsSpent || 0) > 0 && ((ad.totalNetProfit || 0) < 0 || (ad.roi || 0) < 50)).length;
    const budgetPreview = snapshot.strategic.budgetPreview.data;
    const marketingOverview = snapshot.strategic.aiMarketingOverview.data;
    const adsCost = snapshot.strategic.adsCostCashflow.data;
    const syncHealth = snapshot.ads.syncHealth?.data;
    const costPerOrder = snapshot.ads.costPerOrder?.data;
    const cashGate = budgetPreview?.systemLocked
      ? 'bi khoa boi budget/cashflow gate'
      : budgetPreview?.summary
        ? `dry-run allocation ${budgetPreview.summary.successCount || 0} ok, ${budgetPreview.summary.skippedCount || 0} skipped`
        : 'chua doc duoc budget allocation dry-run';
    const syncLine = syncHealth?.summary
      ? `sync ${syncHealth.summary.okPlatforms || 0}/${syncHealth.summary.platforms || 0} ok, stale ${syncHealth.summary.stalePlatforms || 0}, token issue ${syncHealth.summary.tokenIssues || 0}`
      : 'sync health chua co';
    const cpoLine = costPerOrder?.summary
      ? `CPO blended ${costPerOrder.summary.blendedCostPerOrder == null ? 'N/A' : this.formatMoney(costPerOrder.summary.blendedCostPerOrder)}, no-order-spend ${costPerOrder.summary.noOrdersWithSpend || 0}`
      : 'CPO chua co';

    if (!adsRecommendations.length) {
      return [
        `Ket luan ngan: Chua thay nhom quang cao lo ro trong ${snapshot.windowDays} ngay gan nhat tu du lieu doc duoc.`,
        `Du lieu da doc: ${this.loadedSourceSummary(snapshot)}.`,
        `Phan tich tinh huong: Cashflow gate ${cashGate}; ads spend ${this.formatMoney(adsCost?.summary?.spent || 0)}; ${syncLine}; ${cpoLine}; AI marketing readiness ${marketingOverview?.readiness?.status || 'chua co'}.`,
        'Viec can lam:',
        '- Tiep tuc theo doi ROI, net profit, spend va chat luong lead truoc khi scale.',
        `Rui ro/thieu du lieu: ${this.dataGapSummary(snapshot)}`,
        'Can duyet: Moi thay doi ngan sach, pause/kill/scale va apply provider that deu can approval ro ID, muc tien va pham vi.',
      ].join('\n');
    }

    return [
      `Ket luan ngan: Co ${losingCount} nhom quang cao can xem trong ${snapshot.windowDays} ngay gan nhat.`,
      `Du lieu da doc: ${this.loadedSourceSummary(snapshot)}.`,
      `Phan tich tinh huong: Cashflow gate ${cashGate}; ads spend ${this.formatMoney(adsCost?.summary?.spent || 0)}; ${syncLine}; ${cpoLine}; leads/orders ROI marketing ${this.formatMoney(marketingOverview?.summary?.netProfit || 0)} net profit.`,
      'Viec can lam:',
      ...adsRecommendations.slice(0, 5).map((item) => `- ${item.title}: ${item.reason} De xuat: ${item.proposedAction}`),
      `Rui ro/thieu du lieu: ${this.dataGapSummary(snapshot)}`,
      'Can duyet: Cac thay doi ads that van can buoc duyet, gioi han tang/giam va dry-run provider truoc khi apply.',
    ].join('\n');
  }

  private buildFinanceAnswer(snapshot: AiOperatorSnapshot, recommendations: AiOperatorRecommendation[]): string {
    const dashboard = snapshot.finance.dashboard.data;
    const forecast = snapshot.finance.forecast.data;
    const financeActions = this.asArray(snapshot.finance.actions.data?.actions);
    const financeRecommendations = recommendations.filter((item) => item.type.startsWith('finance.'));
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
        'Ket luan ngan: Chua doc duoc Financial Control dashboard, nen khong duoc ket luan an toan dong tien.',
        `Du lieu da doc: ${this.loadedSourceSummary(snapshot)}.`,
        'Phan tich tinh huong: Thieu dashboard tai chinh lam moi quyet dinh rut tien, tra no hoac scale ads co rui ro cao.',
        'Viec can lam: Nap lai financial-control dashboard va kiem tra cac source bi failed/permission_denied truoc khi ra quyet dinh.',
        `Rui ro/thieu du lieu: ${this.dataGapSummary(snapshot)}`,
        'Can duyet: Khong duoc rut owner, tang ads budget hoac ghi nhan payment khi dashboard tai chinh chua doc duoc.',
      ].join('\n');
    }

    const lines = [
      `Ket luan ngan: ${dataQuality?.isDecisionLocked ? 'Tam khoa quyet dinh rui ro cao vi chat luong du lieu chua du.' : 'Co the danh gia dong tien dua tren dashboard hien tai.'}`,
      `Du lieu da doc: bank balance ${this.formatMoney(dashboard.bankBalance)}, free cash ${this.formatMoney(dashboard.freeCash)}, committed 14 ngay ${this.formatMoney(dashboard.committedCash)}, monthly burn ${this.formatMoney(dashboard.monthlyBurn)}, debt ${this.formatMoney(dashboard.totalDebtOutstanding || 0)}.`,
      `Phan tich tinh huong: runway ${dashboard.runwayMonths == null ? 'khong gioi han neu burn = 0' : `${Number(dashboard.runwayMonths).toFixed(1)} thang`}; owner withdrawable ${this.formatMoney(dashboard.ownerWithdrawable || 0)}; ads budget approved 7 ngay ${this.formatMoney(dashboard.adsBudgetApproved || 0)}.`,
    ];

    if (forecast) {
      lines.push(`Forecast: diem thap nhat 7 ngay ${this.formatMoney(forecast.lowPoint)} vao T+${forecast.lowPointDay}; cash crunch=${forecast.isCashCrunch ? 'co' : 'khong'}; survival risk=${forecast.isSurvivalRisk ? 'co' : 'khong'}.`);
    }

    if (receivables) {
      lines.push(`Cong no: NCC qua han ${this.asArray(receivables.supplier?.overdue).length}, dai ly qua han ${this.asArray(receivables.agent?.overdue).length}.`);
    }

    if (availableFunds) {
      lines.push(`Von kha dung: available ${this.formatMoney(availableFunds.available)}, collected revenue ${this.formatMoney(availableFunds.collectedRevenue)}, loan available ${this.formatMoney(availableFunds.loanAvailable)}, reserved total ${this.formatMoney((availableFunds.reservedPayroll || 0) + (availableFunds.reservedPayables || 0) + (availableFunds.reservedOther || 0))}.`);
    }

    if (fundsOverview?.validation) {
      lines.push(`Quy: validation ${fundsOverview.validation.isValid ? 'khop' : 'lech'}; ads allowed ${this.formatMoney(fundsOverview.formulas?.adsBudgetAllowed || 0)}; tien tu do ${this.formatMoney(fundsOverview.formulas?.tienTuDo || 0)}.`);
    }

    if (loanDashboard) {
      lines.push(`No vay: outstanding ${this.formatMoney(loanDashboard.totalOutstanding || 0)}, den han 14 ngay ${this.formatMoney(loanDashboard.due14Days || 0)}, qua han ${this.formatMoney(loanDashboard.overdueAmount || 0)}.`);
    }

    if (laborCashflow || otherCostCashflow) {
      lines.push(`Chi phi sap chi: luong outstanding ${this.formatMoney(laborCashflow?.summary?.outstanding || 0)}, chi phi khac outstanding ${this.formatMoney(otherCostCashflow?.summary?.outstanding || 0)}.`);
    }

    if (budgetPreview) {
      lines.push(`Ads budget dry-run: available ${this.formatMoney(budgetPreview.totalAvailable || 0)}, allocated ${this.formatMoney(budgetPreview.totalAllocated || 0)}, systemLocked=${budgetPreview.systemLocked ? 'co' : 'khong'}.`);
    }

    lines.push('Viec can lam:');
    if (financeActions.length) {
      lines.push(...financeActions.slice(0, 5).map((item: any) => `- ${item.title || item.type}: ${item.description || item.reason || 'kiem tra chi tiet'}${item.amount ? ` (${this.formatMoney(item.amount)})` : ''}`));
    } else if (financeRecommendations.length) {
      lines.push(...financeRecommendations.slice(0, 5).map((item) => `- ${item.title}: ${item.proposedAction}`));
    } else {
      lines.push('- Chua co action tai chinh uu tien cao; tiep tuc theo doi forecast, cong no va khoan vay den han.');
    }

    const qualityNotes = [
      ...(dataQuality?.blockingReasons || []),
      ...(dataQuality?.notes || []),
      ...(budgetPreview?.systemLocked ? ['Budget allocation dang bi khoa/han che, khong nen scale ads.'] : []),
      ...snapshot.dataGaps,
    ];
    if (qualityNotes.length) {
      lines.push(`Rui ro/thieu du lieu: ${Array.from(new Set(qualityNotes)).slice(0, 6).join(' | ')}`);
    } else {
      lines.push('Rui ro/thieu du lieu: Chua thay data gap lon trong snapshot tai chinh.');
    }

    lines.push('Can duyet: Rut owner, tra no, tao batch thanh toan, tang/giam ads budget va sua so tien deu can approval ro rang.');
    return lines.join('\n');
  }

  private compactSnapshot(snapshot: AiOperatorSnapshot) {
    const performance = this.asArray(snapshot.ads.performance.data);
    const suggestions = this.asArray(snapshot.ads.optimalSpendSuggestions.data);

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

  private dateRangeMatch(startDate: Date, endDate: Date) {
    return {
      $or: [
        { orderDate: { $gte: startDate, $lte: endDate } },
        { orderDate: { $exists: false }, createdAt: { $gte: startDate, $lte: endDate } },
        { orderDate: null, createdAt: { $gte: startDate, $lte: endDate } },
      ],
    };
  }

  private dateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
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

  private asArray(value: any): any[] {
    return Array.isArray(value) ? value : [];
  }

  private normalizeWindowDays(windowDays: number): number {
    const numeric = Number(windowDays) || 7;
    return Math.min(90, Math.max(1, Math.round(numeric)));
  }

  private labelScaleAction(action: string): string {
    switch (action) {
      case 'increase':
        return 'De xuat tang ngan sach';
      case 'decrease':
        return 'De xuat giam ngan sach';
      case 'kill':
        return 'De xuat tam dung';
      default:
        return 'De xuat giu nguyen';
    }
  }

  private formatMoney(value: any): string {
    const numeric = Number(value) || 0;
    return `${Math.round(numeric).toLocaleString('vi-VN')}d`;
  }

  private formatPercent(value: any): string {
    const numeric = Number(value) || 0;
    return `${numeric.toFixed(1)}%`;
  }

  private removeVietnameseTone(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }
}
