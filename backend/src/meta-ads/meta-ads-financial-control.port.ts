import { FinancialControlFull } from '../finance/interfaces/financial-control.interface';

/**
 * Read-only boundary reserved for the Meta Ads delivery-activation gate.
 * A future module integration must bind this token to the canonical
 * FinancialControlService instance.
 */
export const META_ADS_FINANCIAL_CONTROL = Symbol('META_ADS_FINANCIAL_CONTROL');

export interface MetaAdsFinancialControlReadModel {
  getFullMetrics(forceRefresh?: boolean): Promise<FinancialControlFull>;
  getOptimalAdsSuggestion(): Promise<{
    adGroups: Array<{
      adGroupId: string;
      optimalSuggested: number;
    }>;
    totalOptimalDaily: number;
    totalOptimalWeekly: number;
  }>;
}
