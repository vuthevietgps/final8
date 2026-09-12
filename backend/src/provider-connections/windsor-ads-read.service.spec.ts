import { WindsorAdsReadService } from './windsor-ads-read.service';
import { Types } from 'mongoose';

describe('Windsor Google Ads read staging', () => {
  const connectionId = '64b000000000000000000001';
  const apiKey = 'fixture-windsor-key-not-real';
  const requiredFields = [
    'account_id', 'date', 'campaign_id', 'campaign', 'campaign_status',
    'ad_group_id', 'ad_group_name', 'ad_group_status', 'spend', 'impressions',
    'clicks', 'conversions', 'conversion_value', 'currency',
  ];
  let connectionModel: any;
  let resourceModel: any;
  let metricModel: any;
  let runModel: any;
  let connections: any;
  let http: any;
  let service: WindsorAdsReadService;

  beforeEach(() => {
    connectionModel = {
      findOneAndUpdate: jest.fn().mockResolvedValue({ _id: connectionId }),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    resourceModel = { bulkWrite: jest.fn().mockResolvedValue({}) };
    metricModel = { bulkWrite: jest.fn().mockResolvedValue({}) };
    runModel = {
      create: jest.fn().mockResolvedValue({}),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    connections = { getVerifiedWindsorReadAccess: jest.fn().mockResolvedValue({
      id: connectionId, revision: 3, accountIds: ['1396730688'], apiKey,
    }) };
    http = { get: jest.fn()
      .mockResolvedValueOnce(requiredFields.map(id => ({ id })))
      .mockResolvedValueOnce([{ id: 'include_inactive' }])
      .mockResolvedValueOnce({ data: [{
        account_id: '139-673-0688', account_name: 'Phù hiệu xe nhanh', date: '2026-09-05',
        campaign_id: '1001', campaign: 'vui trần 1', campaign_status: 'ENABLED',
        ad_group_id: '2001', ad_group_name: 'Nhóm tìm kiếm', ad_group_status: 'ENABLED',
        spend: 408312, impressions: 268, clicks: 41, conversions: 4,
        all_conversions: 4, conversion_value: 4, currency: 'VND',
      }] }) };
    service = new WindsorAdsReadService(
      connectionModel, resourceModel, metricModel, runModel, connections, http,
    );
  });

  it('discovers the schema, includes inactive entities and stages exact daily metrics', async () => {
    const result = await service.sync(connectionId, { dateFrom: '2026-09-05', dateTo: '2026-09-05' }, 'director');
    expect(result).toMatchObject({ status: 'success', counts: { requests: 1, rows: 1, resources: 3, dailyMetrics: 1 } });
    expect(runModel.create).toHaveBeenCalledWith(expect.objectContaining({
      connectionId: expect.any(Types.ObjectId),
    }));
    expect(http.get.mock.calls.slice(0, 2).map((call: any[]) => call[1])).toEqual(['/google_ads/fields', '/google_ads/options']);
    expect(http.get.mock.calls[2][3]).toMatchObject({
      date_from: '2026-09-05', date_to: '2026-09-05', include_inactive: 'true', _max_rows: '5000',
      select_accounts: '1396730688',
    });
    expect(http.get.mock.calls[2][3]).not.toHaveProperty('filter');
    expect(http.get.mock.calls[2][3].fields).not.toContain('campaign_budget_id');
    const metricOperation = metricModel.bulkWrite.mock.calls[0][0][0].updateOne;
    expect(metricOperation.filter).toEqual(expect.objectContaining({
      date: '2026-09-05', accountId: '1396730688', campaignId: '1001', adGroupId: '2001',
    }));
    expect(metricOperation.update).toEqual({ $set: expect.objectContaining({ spend: 408312, currency: 'VND' }) });
    expect(metricOperation.update).not.toHaveProperty('$inc');
  });

  it('upserts the same natural keys on a repeat instead of accumulating spend', async () => {
    await service.sync(connectionId, { dateFrom: '2026-09-05', dateTo: '2026-09-05' }, 'director');
    const firstFilter = metricModel.bulkWrite.mock.calls[0][0][0].updateOne.filter;
    http.get
      .mockResolvedValueOnce(requiredFields.map(id => ({ id })))
      .mockResolvedValueOnce([{ id: 'include_inactive' }])
      .mockResolvedValueOnce({ data: [{
        account_id: '1396730688', date: '2026-09-05', campaign_id: '1001', campaign: 'vui trần 1',
        campaign_status: 'ENABLED', ad_group_id: '2001', ad_group_name: 'Nhóm tìm kiếm',
        ad_group_status: 'ENABLED', spend: 500000, impressions: 300, clicks: 50,
        conversions: 5, conversion_value: 5, currency: 'VND',
      }] });
    await service.sync(connectionId, { dateFrom: '2026-09-05', dateTo: '2026-09-05' }, 'director');
    const second = metricModel.bulkWrite.mock.calls[1][0][0].updateOne;
    expect(second.filter).toEqual(firstFilter);
    expect(second.update.$set.spend).toBe(500000);
    expect(second.update).not.toHaveProperty('$inc');
  });

  it('fails closed when Windsor returns data from another account', async () => {
    http.get.mockReset()
      .mockResolvedValueOnce(requiredFields.map(id => ({ id })))
      .mockResolvedValueOnce([{ id: 'include_inactive' }])
      .mockResolvedValueOnce({ data: [{
        account_id: '6063859174', date: '2026-09-05', campaign_id: '1', ad_group_id: '2',
      }] });
    const result = await service.sync(connectionId, { dateFrom: '2026-09-05', dateTo: '2026-09-05' }, 'director');
    expect(result).toMatchObject({ status: 'failed', errors: [{ accountId: '1396730688', date: '2026-09-05', code: 'ACCOUNT_SCOPE_MISMATCH' }] });
    expect(metricModel.bulkWrite).not.toHaveBeenCalled();
  });

  it('rejects incomplete, future or over-30-day ranges before using provider quota', async () => {
    await expect(service.sync(connectionId, { dateFrom: '2026-01-01', dateTo: '2026-02-01' }, 'director'))
      .rejects.toThrow('1–30 ngày');
    await expect(service.sync(connectionId, { dateFrom: '2099-01-01', dateTo: '2099-01-01' }, 'director'))
      .rejects.toThrow('không vượt quá hôm qua');
    expect(http.get).not.toHaveBeenCalled();
    expect(connectionModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('does not treat action discovery as provider validation or enable writes', async () => {
    const result = await service.sync(connectionId, { dateFrom: '2026-09-05', dateTo: '2026-09-05' }, 'director');
    expect(result).not.toHaveProperty('liveWriteEnabled', true);
    expect(connectionModel.updateOne.mock.calls[0][1].$set).not.toHaveProperty('liveWriteEnabled');
  });
});
