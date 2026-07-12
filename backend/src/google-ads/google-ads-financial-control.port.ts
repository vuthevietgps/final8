import { FinancialControlFull } from '../finance/interfaces/financial-control.interface';

/**
 * Read-only boundary used by the Google Ads live execution gate. FinanceModule
 * binds this token to the canonical FinancialControlService instance.
 */
export const GOOGLE_ADS_FINANCIAL_CONTROL = Symbol('GOOGLE_ADS_FINANCIAL_CONTROL');

export interface GoogleAdsFinancialControlReadModel {
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
