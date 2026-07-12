import type {
  AdsAutomationSmallCapReadinessFixtureMode,
} from './contracts/ads-automation-small-cap-readiness-simulator.contract';

export const ADS_AUTOMATION_SMALL_CAP_READINESS_SIMULATOR_FIXTURE: {
  reportDate: string;
  now: string;
  fixtureMode: AdsAutomationSmallCapReadinessFixtureMode;
  maxSmallCapIncreaseVnd: number;
  maxSmallCapIncreasePercent: number;
} = {
  reportDate: '2026-07-04',
  now: '2026-07-04T06:00:00.000Z',
  fixtureMode: 'htx_ads_small_cap_readiness_demo',
  maxSmallCapIncreaseVnd: 100000,
  maxSmallCapIncreasePercent: 10,
};
