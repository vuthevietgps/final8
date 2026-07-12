import { AdGroupAutoControlService } from './ad-group.auto-control.service';
import { AdGroupModule } from './ad-group.module';
import { AdGroupController } from './ad-group.controller';
import axios from 'axios';

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

describe('AdGroupAutoControlService Phase 0 safety', () => {
  it('does not sync, update, or call providers while approval integration is unavailable', async () => {
    const previousProduction = process.env.GOOGLE_ADS_PRODUCTION_ENABLED;
    const previousExecution = process.env.AI_MARKETING_PROVIDER_EXECUTION_ENABLED;
    process.env.GOOGLE_ADS_PRODUCTION_ENABLED = 'true';
    process.env.AI_MARKETING_PROVIDER_EXECUTION_ENABLED = 'true';
    const adGroupModel = { find: jest.fn(), updateOne: jest.fn() };
    const adAccountModel = { findById: jest.fn() };
    const facebookSync = { syncForDate: jest.fn() };
    const apiTokenService = {
      getRawAccessTokenForAdsManagement: jest.fn(),
      getGoogleAdsRuntimeConfig: jest.fn(),
      getGoogleAdsAccessToken: jest.fn(),
      getTikTokRuntimeConfig: jest.fn(),
    };
    const service = new AdGroupAutoControlService(
      adGroupModel as any,
      adAccountModel as any,
      {} as any,
      facebookSync as any,
      apiTokenService as any,
    );

    try {
      await service.cronEnforceThresholds();
    } finally {
      if (previousProduction === undefined) delete process.env.GOOGLE_ADS_PRODUCTION_ENABLED;
      else process.env.GOOGLE_ADS_PRODUCTION_ENABLED = previousProduction;
      if (previousExecution === undefined) delete process.env.AI_MARKETING_PROVIDER_EXECUTION_ENABLED;
      else process.env.AI_MARKETING_PROVIDER_EXECUTION_ENABLED = previousExecution;
    }

    expect(facebookSync.syncForDate).not.toHaveBeenCalled();
    expect(adGroupModel.find).not.toHaveBeenCalled();
    expect(adGroupModel.updateOne).not.toHaveBeenCalled();
    expect(adAccountModel.findById).not.toHaveBeenCalled();
    expect(apiTokenService.getGoogleAdsRuntimeConfig).not.toHaveBeenCalled();
    expect(apiTokenService.getRawAccessTokenForAdsManagement).not.toHaveBeenCalled();
    expect(apiTokenService.getTikTokRuntimeConfig).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('is neither a controller nor an exported provider from AdGroupModule', () => {
    const controllers = Reflect.getMetadata('controllers', AdGroupModule) || [];
    const exports = Reflect.getMetadata('exports', AdGroupModule) || [];

    expect(controllers).toEqual([AdGroupController]);
    expect(controllers).not.toContain(AdGroupAutoControlService);
    expect(exports).not.toContain(AdGroupAutoControlService);
  });
});
