import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model, Types } from 'mongoose';
import { ProviderConnection, ProviderConnectionDocument } from './provider-connection.schema';
import { ProviderConnectionsService } from './provider-connections.service';
import { ProviderReadError, ProviderReadHttpService } from './provider-read-http.service';
import { WindsorAdsReadSyncDto, WindsorAdsSnapshotQueryDto } from './windsor-ads-read.dto';
import { WindsorAdsDailyMetric, WindsorAdsDailyMetricDocument } from './schemas/windsor-ads-daily-metric.schema';
import { WindsorAdsResource, WindsorAdsResourceDocument } from './schemas/windsor-ads-resource.schema';
import { WindsorAdsSyncRun, WindsorAdsSyncRunDocument } from './schemas/windsor-ads-sync-run.schema';

const FIELD_CONTRACT_VERSION = 1;
const ROW_LIMIT = 5000;
const REQUIRED_FIELDS = [
  'account_id', 'date', 'campaign_id', 'campaign', 'campaign_status',
  'ad_group_id', 'ad_group_name', 'ad_group_status', 'spend', 'impressions',
  'clicks', 'conversions', 'conversion_value', 'currency',
] as const;
const OPTIONAL_FIELDS = [
  // campaign_budget_id has no Windsor report in common with the daily ad-group fields.
  // It must not be queried here or inferred from campaign/ad-group IDs.
  'account_name', 'account_time_zone', 'campaign_type',
  'all_conversions', 'cost_per_conversion', 'ctr', 'cpc', 'average_cpm',
] as const;

type SyncStatus = 'success' | 'partial' | 'failed';

@Injectable()
export class WindsorAdsReadService {
  constructor(
    @InjectModel(ProviderConnection.name) private readonly connectionModel: Model<ProviderConnectionDocument>,
    @InjectModel(WindsorAdsResource.name) private readonly resourceModel: Model<WindsorAdsResourceDocument>,
    @InjectModel(WindsorAdsDailyMetric.name) private readonly metricModel: Model<WindsorAdsDailyMetricDocument>,
    @InjectModel(WindsorAdsSyncRun.name) private readonly runModel: Model<WindsorAdsSyncRunDocument>,
    private readonly connections: ProviderConnectionsService,
    private readonly http: ProviderReadHttpService,
  ) {}

  async sync(id: string, dto: WindsorAdsReadSyncDto, actor: string) {
    const access = await this.connections.getVerifiedWindsorReadAccess(id);
    const range = this.normalizeRange(dto);
    const startedAt = new Date();
    const leaseUntil = new Date(startedAt.getTime() + 45 * 60_000);
    const acquired = await this.connectionModel.findOneAndUpdate({
      _id: new Types.ObjectId(access.id), revision: access.revision, state: 'configured',
      $or: [{ syncLeaseUntil: { $exists: false } }, { syncLeaseUntil: { $lte: startedAt } }],
    }, { $set: { syncLeaseUntil: leaseUntil } }, { new: true });
    if (!acquired) throw new ConflictException('Kết nối đang được đồng bộ hoặc vừa thay đổi.');

    const runId = `windsor-google-${randomUUID()}`;
    try {
      await this.runModel.create({
        runId, connectionId: new Types.ObjectId(access.id), connector: 'google_ads', status: 'running',
        startedAt, dateFrom: range.dateFrom, dateTo: range.dateTo,
        accountIds: access.accountIds, fieldContractVersion: FIELD_CONTRACT_VERSION,
        includeInactive: true, counts: {}, syncErrors: [],
      });
    } catch {
      await this.connectionModel.updateOne({ _id: access.id, revision: access.revision }, { $unset: { syncLeaseUntil: 1 } });
      throw new BadRequestException('Không khởi tạo được lịch sử đồng bộ Windsor.');
    }

    const counts = { requests: 0, rows: 0, resources: 0, dailyMetrics: 0, skippedMetricRows: 0 };
    const errors: Array<{ accountId?: string; date?: string; code: string }> = [];
    let successfulSlices = 0;
    const completedSlices: Array<{ accountId: string; date: string }> = [];
    try {
      const fields = await this.discoverFieldContract(access.apiKey);
      const dates = this.enumerateDays(range.dateFrom, range.dateTo);
      for (const accountId of access.accountIds) {
        for (const date of dates) {
          counts.requests += 1;
          try {
            const slice = await this.readSlice(access.id, access.apiKey, accountId, date, fields, runId);
            counts.rows += slice.rows;
            counts.resources += slice.resources;
            counts.dailyMetrics += slice.dailyMetrics;
            counts.skippedMetricRows += slice.skippedMetricRows;
            successfulSlices += 1;
            completedSlices.push({ accountId, date });
          } catch (error) {
            errors.push({ accountId, date, code: this.errorCode(error) });
          }
        }
      }
    } catch (error) {
      errors.push({ code: this.errorCode(error) });
    }

    const totalSlices = access.accountIds.length * this.enumerateDays(range.dateFrom, range.dateTo).length;
    const status: SyncStatus = successfulSlices === totalSlices ? 'success'
      : successfulSlices > 0 ? 'partial' : 'failed';
    const completedAt = new Date();
    try {
      await this.runModel.updateOne({ runId }, { $set: { status, completedAt, counts, syncErrors: errors } });
      await this.connectionModel.updateOne({ _id: access.id, revision: access.revision }, {
        $set: { lastReadSyncAt: completedAt, lastReadSyncStatus: status, lastReadSyncRunId: runId },
        $unset: { syncLeaseUntil: 1 },
        $push: { audit: { $each: [{ actor: String(actor), at: completedAt, operation: 'ads-read-synced', revision: access.revision }], $slice: -50 } },
      });
    } finally {
      await this.connectionModel.updateOne({ _id: access.id, revision: access.revision }, { $unset: { syncLeaseUntil: 1 } });
    }
    return { runId, status, dateFrom: range.dateFrom, dateTo: range.dateTo, accountIds: access.accountIds, counts, errors, completedSlices };
  }

  async snapshot(id: string, query: WindsorAdsSnapshotQueryDto) {
    const access = await this.connections.getVerifiedWindsorReadAccess(id);
    const range = this.normalizeRange(query);
    if (query.accountId && !access.accountIds.includes(query.accountId)) {
      throw new BadRequestException('Tài khoản không thuộc kết nối đã chọn.');
    }
    const filter: any = {
      connectionId: new Types.ObjectId(access.id),
      date: { $gte: range.dateFrom, $lte: range.dateTo },
      ...(query.accountId ? { accountId: query.accountId } : {}),
    };
    const [rows, resources] = await Promise.all([
      this.metricModel.find(filter).sort({ date: -1, accountId: 1, campaignId: 1, adGroupId: 1 }).limit(5000).lean(),
      this.resourceModel.find({ connectionId: new Types.ObjectId(access.id),
        ...(query.accountId ? { accountId: query.accountId } : {}) })
        .sort({ resourceType: 1, accountId: 1, name: 1 }).limit(5000).lean(),
    ]);
    const summary = rows.reduce((total: any, row: any) => {
      total.spend += Number(row.spend || 0);
      total.impressions += Number(row.impressions || 0);
      total.clicks += Number(row.clicks || 0);
      total.conversions += Number(row.conversions || 0);
      total.conversionValue += Number(row.conversionValue || 0);
      if (row.currency && !total.currencies.includes(row.currency)) total.currencies.push(row.currency);
      return total;
    }, { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0, rows: rows.length, currencies: [] });
    return {
      source: 'windsor', provider: 'google', connector: 'google_ads',
      dateFrom: range.dateFrom, dateTo: range.dateTo,
      summary, truncated: rows.length === 5000 || resources.length === 5000,
      rows, resources,
      materializedToAdvertisingCost: false,
    };
  }

  async runs(id: string) {
    const access = await this.connections.getVerifiedWindsorReadAccess(id);
    return this.runModel.find({ connectionId: new Types.ObjectId(access.id) })
      .sort({ startedAt: -1 }).limit(50).lean();
  }

  private async discoverFieldContract(apiKey: string): Promise<string[]> {
    const [rawFields, rawOptions] = await Promise.all([
      this.http.get('windsor', '/google_ads/fields', apiKey),
      this.http.get('windsor', '/google_ads/options', apiKey),
    ]);
    const fieldRows = this.rowsFrom(rawFields);
    const available = new Set(fieldRows.map(row => typeof row?.id === 'string' ? row.id : ''));
    if (REQUIRED_FIELDS.some(field => !available.has(field))) throw new ProviderReadError('FIELD_CONTRACT_MISMATCH');
    const optionRows = this.rowsFrom(rawOptions);
    if (!optionRows.some(row => row?.id === 'include_inactive')) throw new ProviderReadError('OPTION_CONTRACT_MISMATCH');
    return [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS.filter(field => available.has(field))];
  }

  private async readSlice(
    connectionId: string,
    apiKey: string,
    accountId: string,
    date: string,
    fields: string[],
    runId: string,
  ) {
    const raw = await this.http.get('windsor', '/google_ads', apiKey, {
      fields: fields.join(','), date_from: date, date_to: date,
      select_accounts: accountId,
      include_inactive: 'true', _max_rows: String(ROW_LIMIT), _renderer: 'json',
    });
    const rows = this.rowsFrom(raw);
    if (rows.length >= ROW_LIMIT) throw new ProviderReadError('ROW_LIMIT_REACHED');
    const fetchedAt = new Date();
    const connectionObjectId = new Types.ObjectId(connectionId);
    const resources = new Map<string, Record<string, unknown>>();
    const metrics = new Map<string, Record<string, unknown>>();
    let skippedMetricRows = 0;
    for (const row of rows) {
      if (!row || typeof row !== 'object') throw new ProviderReadError('INVALID_DATA_RESPONSE');
      const returnedAccountId = this.id(row.account_id);
      if (returnedAccountId !== accountId) throw new ProviderReadError('ACCOUNT_SCOPE_MISMATCH');
      const currency = this.currency(row.currency || row.account_currency_code);
      const timezone = this.text(row.account_time_zone, 100);
      this.setResource(resources, {
        connectionId: connectionObjectId, provider: 'google', connector: 'google_ads', resourceType: 'account',
        accountId, providerId: accountId, name: this.text(row.account_name, 500),
        currency, timezone, lastSyncRunId: runId, lastSeenAt: fetchedAt,
      });
      const campaignId = this.optionalId(row.campaign_id);
      const adGroupId = this.optionalId(row.ad_group_id);
      if (campaignId) this.setResource(resources, {
        connectionId: connectionObjectId, provider: 'google', connector: 'google_ads', resourceType: 'campaign',
        accountId, providerId: campaignId, campaignId,
        name: this.text(row.campaign, 500), status: this.text(row.campaign_status, 100),
        resourceSubtype: this.text(row.campaign_type, 100), currency, timezone,
        campaignBudgetId: this.optionalId(row.campaign_budget_id), lastSyncRunId: runId, lastSeenAt: fetchedAt,
      });
      if (campaignId && adGroupId) this.setResource(resources, {
        connectionId: connectionObjectId, provider: 'google', connector: 'google_ads', resourceType: 'ad_group',
        accountId, providerId: adGroupId, campaignId,
        name: this.text(row.ad_group_name, 500), status: this.text(row.ad_group_status, 100),
        currency, timezone, lastSyncRunId: runId, lastSeenAt: fetchedAt,
      });
      if (!row.date || !campaignId || !adGroupId) {
        if (this.number(row.spend) > 0) throw new ProviderReadError('UNATTRIBUTABLE_SPEND');
        skippedMetricRows += 1; continue;
      }
      if (row.date !== date) throw new ProviderReadError('DATE_SCOPE_MISMATCH');
      const key = `${accountId}:${date}:${campaignId}:${adGroupId}`;
      if (metrics.has(key)) throw new ProviderReadError('DUPLICATE_METRIC_SCOPE');
      metrics.set(key, {
        connectionId: connectionObjectId, provider: 'google', connector: 'google_ads', date, accountId, campaignId, adGroupId,
        campaignName: this.text(row.campaign, 500), adGroupName: this.text(row.ad_group_name, 500),
        currency, timezone, spend: this.number(row.spend), impressions: this.number(row.impressions),
        clicks: this.number(row.clicks), conversions: this.number(row.conversions),
        allConversions: this.number(row.all_conversions), conversionValue: this.number(row.conversion_value, true),
        costPerConversion: this.number(row.cost_per_conversion), ctr: this.number(row.ctr),
        cpc: this.number(row.cpc), cpm: this.number(row.average_cpm),
        lastSyncRunId: runId, fetchedAt,
      });
    }
    await Promise.all([
      this.upsert(this.resourceModel, [...resources.values()], ['connectionId', 'resourceType', 'accountId', 'providerId']),
      this.upsert(this.metricModel, [...metrics.values()], ['connectionId', 'date', 'accountId', 'campaignId', 'adGroupId']),
    ]);
    return { rows: rows.length, resources: resources.size, dailyMetrics: metrics.size, skippedMetricRows };
  }

  private async upsert(model: Model<any>, documents: Record<string, unknown>[], keys: string[]) {
    if (!documents.length) return;
    await model.bulkWrite(documents.map(document => ({ updateOne: {
      filter: Object.fromEntries(keys.map(key => [key, document[key]])),
      update: { $set: document }, upsert: true,
    } })), { ordered: false });
  }

  private setResource(target: Map<string, Record<string, unknown>>, value: Record<string, unknown>) {
    target.set(`${value.resourceType}:${value.accountId}:${value.providerId}`, value);
  }

  private rowsFrom(raw: any): any[] {
    const rows = Array.isArray(raw) ? raw : raw?.data;
    if (!Array.isArray(rows)) throw new ProviderReadError('INVALID_DATA_RESPONSE');
    return rows;
  }

  private id(value: unknown): string {
    const clean = String(value ?? '').replace(/[^0-9]/g, '');
    if (!/^\d{1,30}$/.test(clean)) throw new ProviderReadError('INVALID_PROVIDER_ID');
    return clean;
  }

  private optionalId(value: unknown): string | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    return this.id(value);
  }

  private text(value: unknown, max: number): string | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    return String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) || undefined;
  }

  private currency(value: unknown): string | undefined {
    const currency = String(value || '').toUpperCase();
    return /^[A-Z]{3}$/.test(currency) ? currency : undefined;
  }

  private number(value: unknown, allowSigned = false): number {
    if (value === undefined || value === null || value === '') return 0;
    const number = Number(value);
    if (!Number.isFinite(number) || (!allowSigned && number < 0) || Math.abs(number) > 1_000_000_000_000_000) {
      throw new ProviderReadError('INVALID_METRIC_VALUE');
    }
    return number;
  }

  private normalizeRange(input: { dateFrom?: string; dateTo?: string }) {
    const yesterday = this.shiftDay(this.businessToday(), -1);
    const dateTo = input.dateTo || yesterday;
    const dateFrom = input.dateFrom || this.shiftDay(dateTo, -6);
    const from = this.parseDay(dateFrom);
    const to = this.parseDay(dateTo);
    const latest = this.parseDay(yesterday);
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
    if (days < 1 || days > 30 || to > latest) {
      throw new BadRequestException('Khoảng đồng bộ phải gồm 1–30 ngày trọn vẹn và không vượt quá hôm qua.');
    }
    return { dateFrom, dateTo };
  }

  private parseDay(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Ngày phải có định dạng YYYY-MM-DD.');
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException('Ngày không hợp lệ.');
    }
    return date;
  }

  private enumerateDays(dateFrom: string, dateTo: string): string[] {
    const days: string[] = [];
    for (let day = this.parseDay(dateFrom); day <= this.parseDay(dateTo); day = new Date(day.getTime() + 86_400_000)) {
      days.push(day.toISOString().slice(0, 10));
    }
    return days;
  }

  private shiftDay(value: string, amount: number): string {
    const date = this.parseDay(value);
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
  }

  private businessToday(): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  }

  private errorCode(error: unknown): string {
    return error instanceof ProviderReadError ? error.code : 'SYNC_STORAGE_FAILED';
  }
}
