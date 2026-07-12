import { Injectable } from '@nestjs/common';
import { ApiTokenService } from '../api-token/api-token.service';
import {
  createDefaultGoogleAdsReadonlyTransportService,
  GoogleAdsReadonlyTransportService,
} from '../ai-data-pack/provider-adapters/google-ads-readonly/google-ads-readonly-transport.service';

export interface VerifiedAdsChildAccount {
  accountId: string;
  name: string;
  currency: string;
  timezoneId: string;
  status: string;
}

export interface AdsManagerReadonlyVerificationResult {
  runtimeCredentialResolved: true;
  providerConnectionVerified: true;
  verifiedScopes: string[];
  childAccounts: VerifiedAdsChildAccount[];
}

export const ADS_MANAGER_READONLY_VERIFIER = Symbol('ADS_MANAGER_READONLY_VERIFIER');

export interface AdsManagerReadonlyVerifier {
  verifyGoogleMcc(input: {
    managerAccountId: string;
    vaultProvider: string;
    credentialReferenceId?: string;
  }): Promise<AdsManagerReadonlyVerificationResult>;
}

/**
 * The provider boundary is deliberately read-only and template constrained.
 * It cannot accept a URL, GAQL text, mutation, or validateOnly operation from a caller.
 */
@Injectable()
export class AdsManagerAccountReadonlyVerificationService implements AdsManagerReadonlyVerifier {
  private transportInstance?: GoogleAdsReadonlyTransportService;

  constructor(private readonly apiTokenService: ApiTokenService) {}

  async verifyGoogleMcc(input: {
    managerAccountId: string;
    vaultProvider: string;
    credentialReferenceId?: string;
  }): Promise<AdsManagerReadonlyVerificationResult> {
    const normalizedManagerId = this.numericId(input.managerAccountId);
    if (!normalizedManagerId) {
      throw new Error('Google MCC account ID is invalid.');
    }
    if (!['env_reference', 'erp_secret_store'].includes(input.vaultProvider)) {
      throw new Error('Registry vault provider is not supported by the Google Ads runtime resolver.');
    }
    if (input.vaultProvider === 'erp_secret_store' && !String(input.credentialReferenceId || '').trim()) {
      throw new Error('ERP secret-store credentialReferenceId is required.');
    }

    const runtime = await this.apiTokenService.getGoogleAdsRuntimeConfig({
      loginCustomerId: normalizedManagerId,
      credentialReferenceId: input.credentialReferenceId,
    });
    const expectedSource = input.vaultProvider === 'env_reference' ? 'env' : 'database';
    const runtimeComplete = Boolean(
      runtime.clientId && runtime.clientSecret && runtime.refreshToken && runtime.developerToken,
    );
    if (!runtimeComplete
      || runtime.configSource !== expectedSource
      || runtime.refreshTokenSource !== expectedSource
      || this.numericId(runtime.loginCustomerId) !== normalizedManagerId) {
      throw new Error('Registry credential reference did not resolve to the expected Google MCC runtime configuration.');
    }

    const rows = await this.transport().searchStream({
      customerId: normalizedManagerId,
      loginCustomerId: normalizedManagerId,
      credentialReferenceId: input.credentialReferenceId,
      allowedCustomerIds: [normalizedManagerId],
      templateId: 'manager_children',
      absoluteDeadlineAt: new Date(Date.now() + 30_000).toISOString(),
    });

    const childAccounts = rows
      .map((row) => this.mapChild(row))
      .filter((child): child is VerifiedAdsChildAccount => Boolean(child))
      .filter((child) => child.accountId !== normalizedManagerId);

    return {
      runtimeCredentialResolved: true,
      providerConnectionVerified: true,
      // A successful Google Ads request proves the credential is effective for
      // the single OAuth scope used by Google Ads. No token material is returned.
      verifiedScopes: ['https://www.googleapis.com/auth/adwords'],
      childAccounts: this.uniqueChildren(childAccounts),
    };
  }

  private transport(): GoogleAdsReadonlyTransportService {
    if (!this.transportInstance) {
      this.transportInstance = createDefaultGoogleAdsReadonlyTransportService(this.apiTokenService);
    }
    return this.transportInstance;
  }

  private mapChild(row: any): VerifiedAdsChildAccount | null {
    const client = row?.customerClient || row?.customer_client || {};
    if (client.manager === true || Number(client.level) === 0) return null;
    const accountId = this.numericId(client.clientCustomer || client.client_customer);
    if (!accountId) return null;
    return {
      accountId,
      name: String(client.descriptiveName || client.descriptive_name || `Google Ads ${accountId}`).trim(),
      currency: String(client.currencyCode || client.currency_code || '').trim().toUpperCase(),
      timezoneId: String(client.timeZone || client.time_zone || '').trim(),
      status: String(client.status || 'UNKNOWN').trim().toUpperCase(),
    };
  }

  private uniqueChildren(children: VerifiedAdsChildAccount[]): VerifiedAdsChildAccount[] {
    return Array.from(new Map(children.map((child) => [child.accountId, child])).values())
      .sort((a, b) => a.accountId.localeCompare(b.accountId));
  }

  private numericId(value: unknown): string {
    return String(value || '').replace(/\D/g, '');
  }
}
