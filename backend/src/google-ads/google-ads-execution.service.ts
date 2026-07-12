import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import { Model } from 'mongoose';
import { ApiTokenService } from '../api-token/api-token.service';
import { getAdsSafetyConfig } from '../common/ads-safety-config';
import { redactSecrets, redactSecretString } from '../common/utils/secret-redaction.util';
import {
  GoogleAdsExecutionPolicyService,
  GoogleAdsExecutionPreflight,
  GoogleAdsFinancialControlDiagnostic,
} from './google-ads-execution-policy.service';
import { GoogleAdsFinancialExecutionLeaseService } from './google-ads-financial-execution-lease.service';
import { GoogleAdsPostExecutionService } from './google-ads-post-execution.service';
import {
  GoogleAdsActionExecutionLog,
  GoogleAdsActionExecutionLogDocument,
} from './schemas/google-ads-action-execution-log.schema';
import {
  GoogleAdsActionPlan,
  GoogleAdsActionPlanDocument,
  GoogleAdsActionPlanItem,
} from './schemas/google-ads-action-plan.schema';

type ExecuteBody = {
  actionIds?: string[];
  dryRun?: boolean;
  validateOnly?: boolean;
  source?: string;
};

@Injectable()
export class GoogleAdsExecutionService implements OnModuleInit {
  private readonly logger = new Logger(GoogleAdsExecutionService.name);

  constructor(
    @InjectModel(GoogleAdsActionPlan.name)
    private readonly actionPlanModel: Model<GoogleAdsActionPlanDocument>,
    @InjectModel(GoogleAdsActionExecutionLog.name)
    private readonly executionLogModel: Model<GoogleAdsActionExecutionLogDocument>,
    private readonly apiTokenService: ApiTokenService,
    private readonly executionPolicy: GoogleAdsExecutionPolicyService,
    private readonly financialExecutionLease: GoogleAdsFinancialExecutionLeaseService,
    private readonly postExecutionService: GoogleAdsPostExecutionService,
  ) {}

  async onModuleInit() {
    try {
      const collection = this.executionLogModel.collection;
      const indexes = await collection.indexes();
      const legacy = indexes.find((index: any) =>
        index?.unique
        && index?.key?.idempotencyKey === 1
        && !index?.partialFilterExpression?.idempotencyReserved,
      );
      if (legacy?.name) await collection.dropIndex(legacy.name);
      const currentIndexes = await collection.indexes();
      const current = currentIndexes.find((index: any) =>
        index?.name === 'uniq_google_ads_reserved_idempotency_key',
      );
      const currentIsSafe = Boolean(
        current?.unique
        && current?.key?.idempotencyKey === 1
        && current?.partialFilterExpression?.idempotencyReserved === true,
      );
      if (current && !currentIsSafe && current.name) {
        await collection.dropIndex(current.name);
      }
      if (!currentIsSafe) {
        await collection.createIndex(
          { idempotencyKey: 1 },
          {
            unique: true,
            partialFilterExpression: { idempotencyReserved: true },
            name: 'uniq_google_ads_reserved_idempotency_key',
          },
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Google Ads execution idempotency index is unavailable: ${redactSecretString(error?.message || 'UNKNOWN_ERROR')}`,
      );
      throw new Error(
        'Google Ads execution idempotency protection is unavailable; backend startup is blocked.',
      );
    }
  }

  async execute(currentUser: any, planId: string, body: ExecuteBody) {
    const dryRun = body?.dryRun === true;
    this.assertRequest(body, dryRun);
    if (!dryRun) this.assertLiveExecutionEnabled();

    const plan: any = await this.actionPlanModel.findOne({ planId: this.requiredText(planId, 'planId') });
    if (!plan) throw new NotFoundException('Google Ads action plan not found.');
    if (['executing', 'executed', 'failed', 'rejected'].includes(plan.status)) {
      throw new BadRequestException(`Action plan cannot execute when status is ${plan.status}.`);
    }
    const actions = this.selectActions(plan.items, body.actionIds!);
    await this.assertNotExecuted(actions);
    const separationOfDuties = this.evaluateSeparationOfDuties(currentUser, actions);
    if (!dryRun && !separationOfDuties.allowed) {
      throw new BadRequestException(separationOfDuties.reason);
    }
    // Build and validate deterministic operations first. This phase does not
    // call the provider and lets rescue actions bypass the spend-increase lock.
    const preliminary = await this.executionPolicy.preflight(plan, actions, {
      enforceFinancialControl: false,
    });

    if (dryRun) {
      const financialControl = await this.executionPolicy.evaluateFinancialControl(preliminary);
      return this.createDryRunLogs(
        plan,
        preliminary,
        currentUser,
        financialControl,
        separationOfDuties,
      );
    }

    const requiresFinancialControl = await this.executionPolicy.hasSpendIncreasingExposure(preliminary);
    if (!requiresFinancialControl) {
      return this.executeLive(plan, preliminary, currentUser);
    }

    const leaseToken = await this.financialExecutionLease.acquire();
    try {
      // Re-read synced state and Financial Control after the distributed lease
      // is held. No two spend-increasing executions can pass on the same base.
      const finalPreflight = await this.executionPolicy.preflight(plan, actions, {
        enforceFinancialControl: true,
      });
      return await this.executeLive(plan, finalPreflight, currentUser, leaseToken);
    } finally {
      await this.financialExecutionLease.release(leaseToken);
    }
  }

  private async createDryRunLogs(
    plan: any,
    preflight: GoogleAdsExecutionPreflight[],
    currentUser: any,
    financialControl: GoogleAdsFinancialControlDiagnostic,
    separationOfDuties: { allowed: boolean; reason?: string },
  ) {
    const executedBy = this.userLabel(currentUser);
    const executedByUserId = this.userId(currentUser) || undefined;
    const logs = [];
    for (const item of preflight) {
      const log: any = await this.executionLogModel.create({
        planId: plan.planId,
        actionId: item.action.actionId,
        idempotencyKey: item.action.idempotencyKey,
        actionType: item.action.actionType,
        status: 'dry_run',
        idempotencyReserved: false,
        approvedBy: item.action.approvedBy,
        approvedByUserId: item.action.approvedByUserId,
        executedBy,
        executedByUserId,
        beforeState: item.beforeState,
        requestOperations: item.operations,
        providerErrors: [],
        executedAt: new Date(),
      });
      logs.push(this.toPlain(log));
    }
    return {
      success: financialControl.allowed && separationOfDuties.allowed,
      dryRun: true,
      liveEligible: financialControl.allowed && separationOfDuties.allowed,
      financialControl,
      separationOfDuties,
      planId: plan.planId,
      executed: 0,
      failed: 0,
      logs,
    };
  }

  private async executeLive(
    plan: any,
    preflight: GoogleAdsExecutionPreflight[],
    currentUser: any,
    financialLeaseToken?: string,
  ) {
    const executedBy = this.userLabel(currentUser);
    const executedByUserId = this.userId(currentUser);
    plan.status = 'executing';
    await plan.save();
    const logs = [];

    for (const item of preflight) {
      let log: any;
      try {
        if (financialLeaseToken) {
          await this.financialExecutionLease.renew(financialLeaseToken);
        }
        log = await this.reserveIdempotency(plan.planId, item, executedBy, executedByUserId);
        const provider = await this.callProvider(item.action, item.operations);
        log.status = 'success';
        log.providerRequestId = provider.providerRequestId;
        log.providerResponse = provider.providerResponse;
        log.providerErrors = [];
        log.afterState = provider.afterState;
        log.executedAt = new Date();
        await log.save();
        item.action.status = 'executed';
        await this.runPostExecution(plan.planId, item.action, log);
      } catch (error: any) {
        if (error instanceof ConflictException || !log) {
          this.refreshPlanStatus(plan);
          plan.markModified('items');
          await plan.save();
          throw error;
        }
        const providerErrors = this.providerErrors(error);
        log.status = 'failed';
        log.idempotencyReserved = false;
        log.providerRequestId = this.requestId(error?.response?.headers, error?.response?.data?.error?.details);
        log.providerErrors = providerErrors;
        log.executedAt = new Date();
        await log.save();
        logs.push(this.toPlain(log));
        item.action.status = 'failed';
        continue;
      }
      logs.push(this.toPlain(log));
    }

    this.refreshPlanStatus(plan);
    plan.markModified('items');
    await plan.save();

    const failed = logs.filter((log) => log.status === 'failed').length;
    return {
      success: failed === 0,
      dryRun: false,
      planId: plan.planId,
      planStatus: plan.status,
      executed: logs.length - failed,
      failed,
      logs,
    };
  }

  private async reserveIdempotency(
    planId: string,
    item: GoogleAdsExecutionPreflight,
    executedBy: string,
    executedByUserId: string,
  ) {
    try {
      return await this.executionLogModel.create({
        planId,
        actionId: item.action.actionId,
        idempotencyKey: item.action.idempotencyKey,
        actionType: item.action.actionType,
        status: 'executing',
        idempotencyReserved: true,
        approvedBy: item.action.approvedBy,
        approvedByUserId: item.action.approvedByUserId,
        executedBy,
        executedByUserId,
        beforeState: item.beforeState,
        requestOperations: item.operations,
        providerErrors: [],
        executedAt: new Date(),
      });
    } catch (error: any) {
      if (error?.code === 11000) throw new ConflictException(`idempotencyKey already executed or reserved: ${item.action.idempotencyKey}`);
      throw error;
    }
  }

  private async runPostExecution(planId: string, action: GoogleAdsActionPlanItem, log: any) {
    try {
      log.syncedRemoteState = await this.postExecutionService.handleSuccessfulExecution({
        planId,
        action,
        executionLog: log,
      });
      log.postExecutionErrors = [];
    } catch (error: any) {
      log.postExecutionErrors = [{
        step: 'post_execution',
        message: redactSecretString(error?.message || String(error)),
      }];
      this.logger.warn(`Google Ads post-execution processing failed for action ${action.actionId}: ${log.postExecutionErrors[0].message}`);
    }
    try {
      await log.save();
    } catch (error: any) {
      this.logger.warn(`Failed to persist Google Ads post-execution state for action ${action.actionId}: ${redactSecretString(error?.message || String(error))}`);
    }
  }

  private async callProvider(action: GoogleAdsActionPlanItem, operations: Array<Record<string, any>>) {
    const config = await this.apiTokenService.getGoogleAdsRuntimeConfig({
      customerId: action.customerId,
      loginCustomerId: action.loginCustomerId,
    });
    if (!config.developerToken) throw new BadRequestException('Missing Google Ads developer token.');
    if (!config.refreshToken) throw new BadRequestException('Missing Google Ads refresh token.');
    const accessToken = await this.apiTokenService.getGoogleAdsAccessToken(config);
    if (!accessToken) throw new BadRequestException('Cannot get Google Ads access token.');
    const url = `https://googleads.googleapis.com/${config.apiVersion}/customers/${action.customerId}/googleAds:mutate`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': config.developerToken,
      'Content-Type': 'application/json',
    };
    const loginCustomerId = this.digits(config.loginCustomerId);
    if (loginCustomerId) headers['login-customer-id'] = loginCustomerId;
    const response = await axios.post(url, {
      mutateOperations: operations,
      partialFailure: false,
      validateOnly: false,
    }, { headers, timeout: this.providerMutationTimeoutMs() });
    if (response?.data?.partialFailureError) {
      const providerError: any = new Error('Google Ads mutate returned partial failure.');
      providerError.response = { data: { error: response.data.partialFailureError }, headers: response.headers };
      throw providerError;
    }
    const providerResponse: any = redactSecrets(response?.data || {});
    return {
      providerRequestId: this.requestId(response?.headers, response?.data?.partialFailureError?.details),
      providerResponse,
      afterState: { mutateOperationResponses: providerResponse?.mutateOperationResponses || [] },
    };
  }

  private assertRequest(body: ExecuteBody, dryRun: boolean) {
    if (body?.source !== undefined && body.source !== 'codex_operator') {
      throw new BadRequestException('Execution source must be codex_operator.');
    }
    if (body?.validateOnly === true) {
      throw new BadRequestException('Use the provider validation endpoint for validateOnly requests.');
    }
    if (!Array.isArray(body?.actionIds) || !body.actionIds.length) {
      throw new BadRequestException('actionIds must explicitly select at least one action.');
    }
    const normalized = body.actionIds.map((value) => this.requiredText(value, 'actionId'));
    if (new Set(normalized).size !== normalized.length) throw new BadRequestException('actionIds must be unique.');
    if (!dryRun && body?.validateOnly !== false) {
      throw new BadRequestException('Live execution requires validateOnly=false explicitly.');
    }
  }

  private assertLiveExecutionEnabled() {
    const safety = getAdsSafetyConfig();
    if (!safety.googleAdsProductionEnabled) {
      throw new BadRequestException('Google Ads production execution is disabled by GOOGLE_ADS_PRODUCTION_ENABLED.');
    }
    if (!safety.providerExecutionEnabled) {
      throw new BadRequestException('Provider execution is disabled by AI_MARKETING_PROVIDER_EXECUTION_ENABLED.');
    }
    if (safety.dryRun) {
      throw new BadRequestException('Live execution is disabled while AI_MARKETING_DRY_RUN=true.');
    }
  }

  private selectActions(items: GoogleAdsActionPlanItem[], actionIds: string[]) {
    const byId = new Map(items.map((item) => [item.actionId, item]));
    return actionIds.map((actionId) => {
      const action = byId.get(actionId);
      if (!action) throw new NotFoundException(`Google Ads action plan item not found: ${actionId}`);
      return action;
    });
  }

  private async assertNotExecuted(actions: GoogleAdsActionPlanItem[]) {
    const existing: any = await this.executionLogModel.findOne({
      idempotencyKey: { $in: actions.map((action) => action.idempotencyKey) },
      $or: [
        { status: 'success' },
        { idempotencyReserved: true },
      ],
    }).lean();
    if (existing) throw new ConflictException(`idempotencyKey already executed or reserved: ${existing.idempotencyKey}`);
  }

  private refreshPlanStatus(plan: any) {
    plan.status = plan.items.some((action: GoogleAdsActionPlanItem) => action.status === 'failed')
      ? 'failed'
      : plan.items.every((action: GoogleAdsActionPlanItem) => ['executed', 'rejected'].includes(action.status))
        ? 'executed'
        : plan.items.some((action: GoogleAdsActionPlanItem) => action.status === 'pending')
          ? 'partially_approved'
          : 'approved';
  }

  private providerErrors(error: any) {
    const provider = error?.response?.data?.error;
    const details = Array.isArray(provider?.details) ? provider.details : [];
    const errors = details.flatMap((detail: any) => detail?.errors || detail?.googleAdsFailure?.errors || []);
    if (errors.length) {
      return errors.slice(0, 20).map((item: any) => ({
        errorCode: redactSecrets(item?.errorCode || {}),
        message: redactSecretString(String(item?.message || provider?.message || 'Provider execution failed.')),
      }));
    }
    return [{
      code: provider?.code ? String(provider.code) : undefined,
      message: redactSecretString(String(provider?.message || error?.message || 'Provider execution failed.')),
    }];
  }

  private requestId(headers: any, details?: any[]) {
    const value = headers?.get?.('request-id')
      || headers?.['request-id']
      || headers?.['request_id']
      || details?.find((detail: any) => detail?.requestId)?.requestId;
    return value ? redactSecretString(String(value)) : undefined;
  }

  private toPlain(value: any) {
    return redactSecrets(value?.toObject ? value.toObject() : value);
  }

  private requiredText(value: any, field: string) {
    const normalized = String(value || '').trim();
    if (!normalized) throw new BadRequestException(`${field} is required.`);
    return normalized;
  }

  private userLabel(user: any) {
    return String(user?.email || user?.username || user?.fullName || user?._id || user?.id || 'unknown');
  }

  private evaluateSeparationOfDuties(
    currentUser: any,
    actions: GoogleAdsActionPlanItem[],
  ): { allowed: boolean; reason?: string } {
    const executorUserId = this.userId(currentUser);
    if (!executorUserId) {
      return {
        allowed: false,
        reason: 'Live Google Ads execution requires an authenticated executor user ID.',
      };
    }
    for (const action of actions) {
      const approverUserId = String(action.approvedByUserId || '').trim();
      if (!approverUserId) {
        return {
          allowed: false,
          reason: `Action ${action.actionId} has no canonical approver user ID; live execution is blocked.`,
        };
      }
      if (approverUserId === executorUserId) {
        return {
          allowed: false,
          reason: `Action ${action.actionId} must be executed by a different user than its approver.`,
        };
      }
    }
    return { allowed: true };
  }

  private userId(user: any) {
    const value = user?.id || user?._id || user?.sub;
    return value ? String(value) : '';
  }

  private digits(value: any) {
    return String(value || '').replace(/\D/g, '');
  }

  private providerMutationTimeoutMs() {
    const configured = Number(process.env.GOOGLE_ADS_MUTATION_TIMEOUT_MS);
    if (!Number.isFinite(configured)) return 30_000;
    return Math.min(120_000, Math.max(5_000, Math.floor(configured)));
  }
}
