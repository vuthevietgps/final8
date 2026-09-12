import axios from 'axios';
import { AdGroupSyncService } from './ad-group.sync.service';

jest.mock('axios');

describe('AdGroupSyncService Facebook credential and timezone safety', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;
  const adAccountModel = {
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  const apiTokenService = {
    getRawAccessTokenForAdsManagement: jest.fn().mockResolvedValue('sensitive-token'),
  };
  let service: AdGroupSyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdGroupSyncService(
      adAccountModel as any,
      {} as any,
      {} as any,
      apiTokenService as any,
    );
  });

  it('stores the raw provider IANA timezone and authenticates through a Bearer header', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        name: 'Meta account',
        account_status: 1,
        currency: 'VND',
        timezone_name: ' Asia/Ho_Chi_Minh ',
      },
    } as any);

    await (service as any).syncAdAccount({
      _id: 'account-record',
      accountId: 'act_123456789',
      name: 'Existing account',
    });

    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.not.stringContaining('sensitive-token'),
      expect.objectContaining({
        params: {
          fields: expect.stringContaining('timezone_name'),
        },
        headers: { Authorization: 'Bearer sensitive-token' },
      }),
    );
    expect(mockedAxios.get.mock.calls[0][1]?.params).not.toHaveProperty('access_token');
    expect(adAccountModel.updateOne).toHaveBeenCalledWith(
      { _id: 'account-record' },
      expect.objectContaining({
        $set: expect.objectContaining({ timezoneId: 'Asia/Ho_Chi_Minh' }),
      }),
    );
  });

  it('removes provider-added access_token parameters from every paging URL', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          data: [],
          paging: {
            next: 'https://graph.facebook.com/v25.0/act_123/adsets?after=cursor&access_token=provider-copy',
          },
        },
      } as any)
      .mockResolvedValueOnce({ data: { data: [] } } as any);

    await (service as any).syncAdsetsForAccount({ accountId: '123' });

    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    for (const [url, options] of mockedAxios.get.mock.calls) {
      expect(String(url)).not.toContain('access_token=');
      expect(options).toEqual({
        headers: { Authorization: 'Bearer sensitive-token' },
      });
    }
  });
});
