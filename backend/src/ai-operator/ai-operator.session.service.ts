import { normalizeIntent } from './ai-operator.intent';
import { ensureVietnameseUiResponse } from './ai-operator.response-format';
import { removeVietnameseTone } from './ai-operator.format';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AiOperatorMessage,
  AiOperatorMessageDocument,
} from './schemas/ai-operator-message.schema';
import {
  AiOperatorSession,
  AiOperatorSessionDocument,
} from './schemas/ai-operator-session.schema';
import {
  AiOperatorAuthContext,
  AiOperatorContextRoute,
  AiOperatorRecommendation,
} from './ai-operator.interfaces';
import { trimText } from './ai-operator.snapshot-utils';
import { buildAuthContext } from './ai-operator.auth-context';


@Injectable()
export class AiOperatorSessionService {
  constructor(
    @InjectModel(AiOperatorSession.name) private readonly aiSessionModel: Model<AiOperatorSessionDocument>,
    @InjectModel(AiOperatorMessage.name) private readonly aiMessageModel: Model<AiOperatorMessageDocument>,
  ) {}

  async createSession(currentUser: any, dto?: { title?: string; role?: string }) {
    const auth = buildAuthContext(currentUser, dto?.role);
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
    const auth = buildAuthContext(currentUser);
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
    const auth = buildAuthContext(currentUser);
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
    const auth = buildAuthContext(currentUser);
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
    const auth = buildAuthContext(currentUser);
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
      reason: trimText(dto.reason, 1000),
      correction: trimText(dto.correction, 4000),
      expectedIntent: normalizeIntent(dto.expectedIntent) || dto.expectedIntent || null,
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
    const auth = buildAuthContext(currentUser);
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
      notes: trimText(dto.notes, 3000),
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
    const auth = buildAuthContext(currentUser);
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
        contentPreview: trimText(message.content, 500),
        createdAt: message.createdAt,
      })),
    };
  }

  async persistChatTurn(currentUser: any, sessionId: string | undefined, userMessage: string, response: any) {
    const auth = buildAuthContext(currentUser, response.role || undefined);
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

  private compactStoredRecommendations(recommendations: AiOperatorRecommendation[] = []) {
    return recommendations.slice(0, 10).map((item) => ({
      id: item.id,
      type: item.type,
      priority: item.priority,
      title: ensureVietnameseUiResponse(item.title),
      requiresApproval: item.requiresApproval,
      riskLevel: item.riskLevel,
      source: item.source,
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
      .map((tag) => removeVietnameseTone(String(tag || '').trim()).toLowerCase().replace(/[^a-z0-9_-]+/g, '_'))
      .filter(Boolean)
      .slice(0, 20);
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
}
