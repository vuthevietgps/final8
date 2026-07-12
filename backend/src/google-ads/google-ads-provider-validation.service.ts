import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import { Model } from 'mongoose';
import { ApiTokenService } from '../api-token/api-token.service';
import { redactSecretString } from '../common/utils/secret-redaction.util';
import { GoogleAdsOperationBuilderService } from './google-ads-operation-builder.service';
import {
  GoogleAdsActionPlan,
  GoogleAdsActionPlanDocument,
  GoogleAdsActionPlanItem,
} from './schemas/google-ads-action-plan.schema';

type ValidationError = { code?: string; message: string; fieldPath?: string };

@Injectable()
export class GoogleAdsProviderValidationService {
  constructor(
    @InjectModel(GoogleAdsActionPlan.name)
    private readonly actionPlanModel: Model<GoogleAdsActionPlanDocument>,
    private readonly apiTokenService: ApiTokenService,
    private readonly operationBuilder: GoogleAdsOperationBuilderService,
  ) {}

  async validatePlan(planId: string) {
    const plan: any = await this.actionPlanModel.findOne({ planId: String(planId || '').trim() });
    if (!plan) throw new NotFoundException('Google Ads action plan not found.');
    if (['executing', 'executed'].includes(plan.status)) {
      throw new BadRequestException('Executed action plans cannot be provider-validated again.');
    }
    if (plan.items.some((action: GoogleAdsActionPlanItem) => action.status !== 'pending')) {
      throw new BadRequestException('Only pending actions can be provider-validated.');
    }

    const results = [];
    const planErrors: Array<ValidationError & { actionId: string }> = [];
    for (const action of plan.items as GoogleAdsActionPlanItem[]) {
      const result = await this.validateAction(action);
      Object.assign(action, {
        providerValidationStatus: result.status,
        providerValidationErrors: result.errors,
        providerRequestId: result.providerRequestId,
        providerValidatedAt: new Date(),
      });
      results.push({
        actionId: action.actionId,
        providerValidationStatus: result.status,
        providerRequestId: result.providerRequestId,
        providerValidationErrors: result.errors,
      });
      planErrors.push(...result.errors.map((error) => ({ actionId: action.actionId, ...error })));
    }

    const passed = results.filter((result) => result.providerValidationStatus === 'provider_validate_passed').length;
    plan.providerValidationStatus = passed === results.length ? 'passed' : passed === 0 ? 'failed' : 'partial';
    plan.providerValidationErrors = planErrors;
    plan.providerValidatedAt = new Date();
    plan.markModified?.('items');
    await plan.save();

    return {
      success: passed === results.length,
      planId: plan.planId,
      providerValidationStatus: plan.providerValidationStatus,
      actionsTotal: results.length,
      actionsPassed: passed,
      actionsFailed: results.length - passed,
      actions: results,
    };
  }

  private async validateAction(action: GoogleAdsActionPlanItem): Promise<{
    status: 'provider_validate_passed' | 'provider_validate_failed';
    errors: ValidationError[];
    providerRequestId?: string;
  }> {
    try {
      const operations = this.operationBuilder.build(action);
      if (action.actionType === 'monitor_only') {
        return { status: 'provider_validate_passed', errors: [] };
      }
      if (!operations.length) throw new BadRequestException('No Google Ads operations were built for validation.');

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
      const loginCustomerId = this.numericId(config.loginCustomerId);
      if (loginCustomerId) headers['login-customer-id'] = loginCustomerId;
      const response = await axios.post(url, {
        mutateOperations: operations,
        partialFailure: false,
        validateOnly: true,
      }, { headers });
      if (response?.data?.partialFailureError) {
        const providerError: any = new Error('Google Ads validateOnly returned partial failure.');
        providerError.response = {
          data: { error: response.data.partialFailureError },
          headers: response.headers,
        };
        throw providerError;
      }
      return {
        status: 'provider_validate_passed',
        errors: [],
        providerRequestId: this.requestId(response?.headers, response?.data?.partialFailureError?.details),
      };
    } catch (error: any) {
      return {
        status: 'provider_validate_failed',
        errors: this.providerErrors(error),
        providerRequestId: this.requestId(error?.response?.headers, error?.response?.data?.error?.details),
      };
    }
  }

  private providerErrors(error: any): ValidationError[] {
    const provider = error?.response?.data?.error;
    const details = Array.isArray(provider?.details) ? provider.details : [];
    const extracted = details.flatMap((detail: any) => {
      const failures = detail?.errors || detail?.googleAdsFailure?.errors || [];
      return Array.isArray(failures) ? failures.map((failure: any) => ({
        code: this.errorCode(failure?.errorCode),
        message: redactSecretString(String(failure?.message || provider?.message || error?.message || 'Provider validation failed.')),
        fieldPath: failure?.location?.fieldPathElements
          ?.map((element: any) => element?.fieldName)
          .filter(Boolean)
          .join('.'),
      })) : [];
    });
    if (extracted.length) return extracted.slice(0, 20);
    return [{
      code: provider?.code ? String(provider.code) : undefined,
      message: redactSecretString(String(provider?.message || error?.message || 'Provider validation failed.')),
    }];
  }

  private errorCode(value: any) {
    if (!value || typeof value !== 'object') return undefined;
    const [group, code] = Object.entries(value)[0] || [];
    return group && code ? `${group}.${code}` : undefined;
  }

  private requestId(headers: any, details?: any[]) {
    const value = headers?.get?.('request-id')
      || headers?.['request-id']
      || headers?.['request_id']
      || details?.find((detail: any) => detail?.requestId)?.requestId;
    return value ? redactSecretString(String(value)) : undefined;
  }

  private numericId(value: any) {
    const normalized = String(value || '').replace(/\D/g, '');
    return normalized || undefined;
  }
}
