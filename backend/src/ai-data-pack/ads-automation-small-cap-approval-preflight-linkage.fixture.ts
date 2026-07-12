import type {
  AdsAutomationSmallCapApprovalPreflightLinkageFixtureMode,
} from './contracts/ads-automation-small-cap-approval-preflight-linkage.contract';

export const ADS_AUTOMATION_SMALL_CAP_APPROVAL_PREFLIGHT_LINKAGE_FIXTURE: {
  reportDate: string;
  now: string;
  fixtureMode: AdsAutomationSmallCapApprovalPreflightLinkageFixtureMode;
  approvalId: string;
  sourceDraftId: string;
  sourceDecisionId: string;
  validationId: string;
  policyDecisionId: string;
  executionRecordId: string;
  accountId: string;
  campaignId: string;
  adGroupId: string;
  campaignBudgetId: string;
  campaignBudgetResourceName: string;
  currentDailyBudgetVnd: number;
  requestedDailyBudgetVnd: number;
  simulatedCappedIncreaseVnd: number;
} = {
  reportDate: '2026-07-04',
  now: '2026-07-04T07:15:00.000Z',
  fixtureMode: 'htx_ads_small_cap_approval_preflight_linkage_demo',
  approvalId: 'ADSAPPROVAL-small-cap-linkage-demo',
  sourceDraftId: 'ADSDRAFT-small-cap-linkage-budget-2001',
  sourceDecisionId: 'DEC-scale-amount-small-cap-linkage-2001',
  validationId: 'ADSPROVIDERVALIDATE-small-cap-linkage-demo',
  policyDecisionId: 'ADSPOLICY-small-cap-linkage-demo',
  executionRecordId: 'ADSEXEC-DRYRUN-small-cap-linkage-demo',
  accountId: '1234567890',
  campaignId: '1001',
  adGroupId: '2001',
  campaignBudgetId: '3001',
  campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
  currentDailyBudgetVnd: 1000000,
  requestedDailyBudgetVnd: 1200000,
  simulatedCappedIncreaseVnd: 100000,
};
