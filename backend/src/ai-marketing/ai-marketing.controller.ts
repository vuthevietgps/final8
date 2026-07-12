import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { FeatureModule } from '../plan/feature-module.decorator';
import { AiMarketingService } from './ai-marketing.service';
import { SecretRedactionInterceptor } from '../common/interceptors/secret-redaction.interceptor';
import {
  ApplyPlanDto,
  ApprovePlanItemDto,
  CreateCreativeAssetDto,
  CreateMarketingLeadDto,
  CreativePerformanceQueryDto,
  DirectAdGroupActionDto,
  EvaluationQueryDto,
  GenerateAdsPlanDto,
  LeadFunnelQueryDto,
  ListPlansQueryDto,
  SyncLeadsDto,
  UpdateCreativeAssetDto,
  UpdateMarketingLeadDto,
} from './dto/ai-marketing.dto';

@FeatureModule('ai-marketing')
@Controller('ai-marketing')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(SecretRedactionInterceptor)
export class AiMarketingController {
  constructor(private readonly service: AiMarketingService) {}

  @Get('overview')
  @RequirePermissions('google-ads.read')
  getOverview(@Query() query: LeadFunnelQueryDto) {
    return this.service.getOverview(query);
  }

  @Post('leads')
  @RequirePermissions('google-ads.plan')
  createLead(@Body() body: CreateMarketingLeadDto) {
    return this.service.createLead(body);
  }

  @Patch('leads/:leadId')
  @RequirePermissions('google-ads.plan')
  updateLead(@Param('leadId') leadId: string, @Body() body: UpdateMarketingLeadDto) {
    return this.service.updateLead(leadId, body);
  }

  @Get('leads/funnel')
  @RequirePermissions('google-ads.read')
  getLeadFunnel(@Query() query: LeadFunnelQueryDto) {
    return this.service.getLeadFunnel(query);
  }

  @Post('leads/sync')
  @RequirePermissions('google-ads.plan')
  syncLeads(@Body() body: SyncLeadsDto) {
    return this.service.syncLeadsFromSignals(body);
  }

  @Get('creatives/performance')
  @RequirePermissions('google-ads.read')
  getCreativePerformance(@Query() query: CreativePerformanceQueryDto) {
    return this.service.getCreativePerformance(query);
  }

  @Get('creatives')
  @RequirePermissions('google-ads.read')
  listCreatives(@Query() query: CreativePerformanceQueryDto) {
    return this.service.listCreatives(query);
  }

  @Post('creatives')
  @RequirePermissions('google-ads.plan')
  createCreative(@CurrentUser() currentUser: any, @Body() body: CreateCreativeAssetDto) {
    return this.service.createCreative(currentUser, body);
  }

  @Patch('creatives/:creativeId')
  @RequirePermissions('google-ads.plan')
  updateCreative(
    @CurrentUser() currentUser: any,
    @Param('creativeId') creativeId: string,
    @Body() body: UpdateCreativeAssetDto,
  ) {
    return this.service.updateCreative(currentUser, creativeId, body);
  }

  @Post('plans/generate')
  @RequirePermissions('google-ads.plan')
  generatePlan(@CurrentUser() currentUser: any, @Body() body: GenerateAdsPlanDto) {
    return this.service.generatePlan(currentUser, body);
  }

  @Get('plans')
  @RequirePermissions('google-ads.read')
  listPlans(@Query() query: ListPlansQueryDto) {
    return this.service.listPlans(query);
  }

  @Get('plans/:planId')
  @RequirePermissions('google-ads.read')
  getPlan(@Param('planId') planId: string) {
    return this.service.getPlan(planId);
  }

  @Patch('plans/:planId/items/:itemId/approve')
  @RequirePermissions('google-ads.approve')
  approvePlanItem(
    @CurrentUser() currentUser: any,
    @Param('planId') planId: string,
    @Param('itemId') itemId: string,
    @Body() body: ApprovePlanItemDto,
  ) {
    return this.service.approvePlanItem(currentUser, planId, itemId, body);
  }

  @Post('plans/:planId/apply')
  @RequirePermissions('google-ads.execute')
  applyPlan(
    @CurrentUser() currentUser: any,
    @Param('planId') planId: string,
    @Body() body: ApplyPlanDto,
  ) {
    return this.service.applyPlan(currentUser, planId, body);
  }

  @Get('actions/evaluations')
  @RequirePermissions('google-ads.read')
  listEvaluations(@Query() query: EvaluationQueryDto) {
    return this.service.listEvaluations(query);
  }

  @Post('actions/evaluations/run')
  @RequirePermissions('google-ads.read')
  runEvaluations(@Query('force') force?: string) {
    return this.service.runEvaluations(force === 'true' || force === '1');
  }

  @Post('ad-groups/:adGroupId/actions')
  @RequirePermissions('google-ads.execute')
  runAdGroupAction(
    @CurrentUser() currentUser: any,
    @Param('adGroupId') adGroupId: string,
    @Body() body: DirectAdGroupActionDto,
  ) {
    return this.service.runDirectAdGroupAction(currentUser, adGroupId, body);
  }
}
