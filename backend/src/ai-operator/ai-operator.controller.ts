import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { FeatureModule } from '../plan/feature-module.decorator';
import { AiOperatorService } from './ai-operator.service';
import { AiOperatorChatDto } from './dto/ai-operator-chat.dto';
import {
  CreateAiOperatorSessionDto,
  ReviewAiOperatorSessionDto,
  SubmitAiOperatorMessageFeedbackDto,
  UpdateAiOperatorSessionDto,
} from './dto/ai-operator-session.dto';

@FeatureModule('ai-operator')
@Controller('ai-operator')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermissions('ai-assistant')
export class AiOperatorController {
  constructor(private readonly service: AiOperatorService) {}

  @Get('knowledge')
  getKnowledge(@CurrentUser() currentUser: any, @Query('role') role?: string) {
    return this.service.getKnowledge(role, currentUser);
  }

  @Get('token-management')
  getTokenManagement() {
    return this.service.getTokenManagement();
  }

  @Get('v2/registries')
  getV2Registries() {
    return this.service.getV2Registries();
  }

  @Get('v2/metrics')
  getV2MetricsRegistry() {
    return this.service.getV2MetricsRegistry();
  }

  @Get('v2/api-catalog')
  getV2ApiCatalog() {
    return this.service.getV2ApiCatalog();
  }

  @Get('v2/management-situations')
  getV2ManagementSituations() {
    return this.service.getV2ManagementSituations();
  }

  @Get('v2/decision-rules')
  getV2DecisionRules() {
    return this.service.getV2DecisionRules();
  }

  @Get('v2/regression-test-cases')
  getV2RegressionTestCases() {
    return this.service.getV2RegressionTestCases();
  }

  @Post('v2/decisions/evaluate')
  evaluateV2Decision(@Body() body: { decisionType?: string; metrics?: Record<string, number>; dataQuality?: any }) {
    return this.service.evaluateV2Decision(body);
  }

  @Post('sessions')
  createSession(@CurrentUser() currentUser: any, @Body() body: CreateAiOperatorSessionDto) {
    return this.service.createSession(currentUser, body);
  }

  @Get('sessions')
  listSessions(
    @CurrentUser() currentUser: any,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('all') all?: string,
  ) {
    return this.service.listSessions(currentUser, { limit, status, all });
  }

  @Get('sessions/:sessionId')
  getSessionDetail(
    @CurrentUser() currentUser: any,
    @Param('sessionId') sessionId: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getSessionDetail(currentUser, sessionId, { limit });
  }

  @Patch('sessions/:sessionId')
  updateSession(
    @CurrentUser() currentUser: any,
    @Param('sessionId') sessionId: string,
    @Body() body: UpdateAiOperatorSessionDto,
  ) {
    return this.service.updateSession(currentUser, sessionId, body);
  }

  @Patch('sessions/:sessionId/review')
  reviewSession(
    @CurrentUser() currentUser: any,
    @Param('sessionId') sessionId: string,
    @Body() body: ReviewAiOperatorSessionDto,
  ) {
    return this.service.reviewSession(currentUser, sessionId, body);
  }

  @Post('messages/:messageId/feedback')
  submitMessageFeedback(
    @CurrentUser() currentUser: any,
    @Param('messageId') messageId: string,
    @Body() body: SubmitAiOperatorMessageFeedbackDto,
  ) {
    return this.service.submitMessageFeedback(currentUser, messageId, body);
  }

  @Get('analytics/summary')
  getConversationAnalytics(
    @CurrentUser() currentUser: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('all') all?: string,
  ) {
    return this.service.getConversationAnalytics(currentUser, { from, to, limit, all });
  }

  @Get('workflow-quality')
  getWorkflowQuality(@CurrentUser() currentUser: any, @Query('role') role?: string) {
    return this.service.getWorkflowQuality(currentUser, role);
  }

  @Get('snapshot')
  getSnapshot(@CurrentUser() currentUser: any, @Query('windowDays') windowDays?: string) {
    return this.service.getSnapshot(windowDays ? Number(windowDays) : 7, currentUser);
  }

  @Get('context')
  getScenarioContext(
    @Query('windowDays') windowDays?: string,
    @Query('role') role?: string,
    @Query('scenarioId') scenarioId?: string,
    @Query('intent') intent?: string,
    @Query('message') message?: string,
    @CurrentUser() currentUser?: any,
  ) {
    return this.service.getScenarioContext({
      message,
      windowDays: windowDays ? Number(windowDays) : 7,
      role,
      scenarioId,
      intent,
      currentUser,
    });
  }

  @Get('recommendations')
  getRecommendations(@CurrentUser() currentUser: any, @Query('windowDays') windowDays?: string) {
    return this.service.getRecommendations(windowDays ? Number(windowDays) : 7, currentUser);
  }

  @Post('chat')
  chat(@CurrentUser() currentUser: any, @Body() body: AiOperatorChatDto) {
    return this.service.chat(body.message, body.windowDays || 7, body.role, body.scenarioId, body.intent, currentUser, body.sessionId);
  }
}
