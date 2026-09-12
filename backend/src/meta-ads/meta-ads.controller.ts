import { Body, Controller, Get, Param, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { SecretRedactionInterceptor } from '../common/interceptors/secret-redaction.interceptor';
import { CreateMetaAdsActionPlanDto } from './dto/create-meta-ads-action-plan.dto';
import {
  ExecuteMetaAdsActionPlanDto,
  ValidateMetaAdsActionPlanDto,
} from './dto/execute-meta-ads-action-plan.dto';
import {
  ApproveMetaAdsActionPlanDto,
  RejectMetaAdsActionPlanDto,
} from './dto/meta-ads-action-transition.dto';
import { MetaAdsActionPlanService } from './meta-ads-action-plan.service';
import { MetaAdsApprovalService } from './meta-ads-approval.service';
import { MetaAdsCapabilitiesService } from './meta-ads-capabilities.service';
import { MetaAdsExecutionService } from './meta-ads-execution.service';
import { MetaAdsLookupService } from './meta-ads-lookup.service';
import { MetaAdsProviderValidationService } from './meta-ads-provider-validation.service';

@Controller('meta-ads')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(SecretRedactionInterceptor)
@RequirePermissions('meta-ads.read')
export class MetaAdsController {
  constructor(
    private readonly actionPlanService: MetaAdsActionPlanService,
    private readonly approvalService: MetaAdsApprovalService,
    private readonly providerValidationService: MetaAdsProviderValidationService,
    private readonly executionService: MetaAdsExecutionService,
    private readonly capabilitiesService: MetaAdsCapabilitiesService,
    private readonly lookupService: MetaAdsLookupService,
  ) {}

  @Get('capabilities')
  getCapabilities() {
    return this.capabilitiesService.getCapabilities();
  }

  @Get('lookups/ad-accounts')
  getAdAccountLookup() {
    return this.lookupService.listAdAccounts();
  }

  @Get('lookups/campaigns/:adAccountId')
  getCampaignLookup(@Param('adAccountId') adAccountId: string) {
    return this.lookupService.listCampaigns(adAccountId);
  }

  @Get('lookups/ad-sets/:adAccountId')
  getAdSetLookup(@Param('adAccountId') adAccountId: string) {
    return this.lookupService.listAdSets(adAccountId);
  }

  @Get('lookups/ad-creatives/:adAccountId')
  getAdCreativeLookup(@Param('adAccountId') adAccountId: string) {
    return this.lookupService.listAdCreatives(adAccountId);
  }

  @Get('lookups/ads/:adAccountId')
  getAdLookup(@Param('adAccountId') adAccountId: string) {
    return this.lookupService.listAds(adAccountId);
  }

  @Post('action-plans')
  @RequirePermissions('meta-ads.plan')
  async createPlan(@CurrentUser() user: any, @Body() body: CreateMetaAdsActionPlanDto) {
    const plan = await this.actionPlanService.createPlan(body, this.userId(user));
    return this.presentPlan(user, plan);
  }

  @Get('action-plans/:planId')
  async getPlan(@CurrentUser() user: any, @Param('planId') planId: string) {
    return this.presentPlan(user, await this.actionPlanService.getPlan(planId));
  }

  @Post('action-plans/:planId/validate')
  @RequirePermissions('meta-ads.validate')
  async validatePlan(
    @CurrentUser() user: any,
    @Param('planId') planId: string,
    @Body() body: ValidateMetaAdsActionPlanDto,
  ) {
    const plan = await this.actionPlanService.getPlan(planId);
    const actionIds = body.actionIds?.length
      ? body.actionIds
      : plan.actions
        .filter((action) => ['pending_validation', 'validation_failed'].includes(action.workflowStatus))
        .map((action) => action.actionId);
    if (!actionIds.length) return this.presentPlan(user, plan);
    await this.providerValidationService.validateActions(planId, actionIds);
    return this.presentPlan(user, await this.actionPlanService.getPlan(planId));
  }

  @Patch('action-plans/:planId/actions/:actionId/approve')
  @RequirePermissions('meta-ads.approve')
  async approveAction(
    @CurrentUser() user: any,
    @Param('planId') planId: string,
    @Param('actionId') actionId: string,
    @Body() body: ApproveMetaAdsActionPlanDto,
  ) {
    await this.approvalService.approve(planId, actionId, this.userId(user), body);
    return this.presentPlan(user, await this.actionPlanService.getPlan(planId));
  }

  @Patch('action-plans/:planId/actions/:actionId/reject')
  @RequirePermissions('meta-ads.approve')
  async rejectAction(
    @CurrentUser() user: any,
    @Param('planId') planId: string,
    @Param('actionId') actionId: string,
    @Body() body: RejectMetaAdsActionPlanDto,
  ) {
    await this.approvalService.reject(planId, actionId, this.userId(user), body);
    return this.presentPlan(user, await this.actionPlanService.getPlan(planId));
  }

  @Post('action-plans/:planId/execute')
  @RequirePermissions('meta-ads.execute')
  executePlan(
    @CurrentUser() user: any,
    @Param('planId') planId: string,
    @Body() body: ExecuteMetaAdsActionPlanDto,
  ) {
    return this.executionService.execute(user, planId, body);
  }

  @Get('action-plans/:planId/executions')
  async getExecutions(@Param('planId') planId: string) {
    const result = await this.executionService.getExecutions(planId);
    return result.executions;
  }

  @Post('execution-reservations/:idempotencyKey/reconcile')
  @RequirePermissions('meta-ads.execute')
  reconcile(@Param('idempotencyKey') idempotencyKey: string) {
    return this.executionService.reconcile(idempotencyKey);
  }

  private async presentPlan(user: any, planInput: any) {
    const plan = planInput?.toObject ? planInput.toObject() : planInput;
    const diagnostics = await this.executionService.evaluateEligibility(
      user,
      plan.planId,
      plan.actions.map((action: any) => action.actionId),
    );
    const byAction = new Map<string, any>(
      (diagnostics.actions || []).map((item: any) => [item.actionId, item]),
    );
    const actions = plan.actions.map((action: any) => {
      const { providerValidationCredentialReferenceId: _credentialReference, ...publicAction } = action;
      return {
        ...publicAction,
        status: action.workflowStatus,
        blockers: byAction.get(action.actionId)?.blockers || [],
      };
    });
    const activeActions = actions.filter((action: any) => action.workflowStatus !== 'rejected');
    const validatedActions = activeActions.filter(
      (action: any) => action.providerValidationStatus === 'passed',
    );
    const expiryTimes = validatedActions
      .map((action: any) => new Date(action.providerValidationExpiresAt || 0).getTime())
      .filter((value: number) => Number.isFinite(value) && value > 0);
    const validationBlockers = activeActions
      .filter((action: any) => action.providerValidationStatus !== 'passed')
      .map((action: any) => action.providerValidationError || `Action ${action.actionId} has not passed validate_only.`);
    const liveEligible = actions.length > 0
      && actions.every((action: any) => byAction.get(action.actionId)?.liveEligible === true);
    const liveBlockers = Array.from(new Set(
      actions.flatMap((action: any) => byAction.get(action.actionId)?.blockers || []),
    ));
    return {
      ...plan,
      actions,
      providerValidation: {
        passed: activeActions.length > 0 && validatedActions.length === activeActions.length,
        expiresAt: expiryTimes.length ? new Date(Math.min(...expiryTimes)).toISOString() : undefined,
        blockers: validationBlockers,
      },
      liveEligible,
      liveEligibility: { eligible: liveEligible, blockers: liveBlockers },
      blockers: liveBlockers,
    };
  }

  private userId(user: any): string {
    return String(user?.id || user?._id || user?.sub || '').trim();
  }
}
