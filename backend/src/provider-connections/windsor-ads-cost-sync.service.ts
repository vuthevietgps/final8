import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AdvertisingCost, AdvertisingCostDocument } from '../advertising-cost/schemas/advertising-cost.schema';
import { ProviderConnection, ProviderConnectionDocument } from './provider-connection.schema';
import { WindsorAdsReadSyncDto, WindsorAdsSnapshotQueryDto } from './windsor-ads-read.dto';
import { WindsorAdsReadService } from './windsor-ads-read.service';
import { WindsorAdsDailyMetric, WindsorAdsDailyMetricDocument } from './schemas/windsor-ads-daily-metric.schema';
import { AdvertisingCostRefreshService } from '../advertising-cost/advertising-cost-refresh.module';
import { estimateWindsorCosts } from './windsor-cost-estimate';
import { WindsorAdsCatalogService } from './windsor-ads-catalog.service';

export type GoogleAdsCostSource = 'windsor' | 'native';

export function configuredGoogleAdsCostSource(): GoogleAdsCostSource {
  return String(process.env.ADS_GOOGLE_COST_SOURCE || 'windsor').trim().toLowerCase() === 'native'
    ? 'native'
    : 'windsor';
}

@Injectable()
export class WindsorAdsCostSyncService {
  private readonly logger = new Logger(WindsorAdsCostSyncService.name);

  constructor(
    @InjectModel(ProviderConnection.name) private readonly connectionModel: Model<ProviderConnectionDocument>,
    @InjectModel(WindsorAdsDailyMetric.name) private readonly metricModel: Model<WindsorAdsDailyMetricDocument>,
    @InjectModel(AdvertisingCost.name) private readonly costModel: Model<AdvertisingCostDocument>,
    private readonly readService: WindsorAdsReadService,
    private readonly refresh: AdvertisingCostRefreshService,
    @Optional() private readonly catalog?: WindsorAdsCatalogService,
  ) {}

  async syncConnection(id: string, dto: WindsorAdsReadSyncDto, actor: string) {
    const read = await this.readService.sync(id, dto, actor);
    const catalog = await this.catalog?.reconcileSafely(id);
    const materialization = read.status === 'failed'
      ? { status: 'skipped', reason: 'READ_SYNC_FAILED', rows: 0, updated: 0 }
      : await this.materializeRun(id, read.runId, read.dateFrom, read.dateTo, read.completedSlices);
    const estimation = await this.estimateFailedSlices(id, read);
    const days = this.days(read.dateFrom, read.dateTo);
    const projections = [];
    for (const day of days) projections.push({ day, complete: await this.refresh.flush(day) });
    return { ...read, materialization, estimation, projections, catalog };
  }

  async syncConfiguredForDate(date: string, actor = 'system:windsor-daily') {
    this.assertDay(date);
    const rows: any[] = await this.connectionModel.find({
      kind: 'windsor-google', state: 'configured',
    }).select('_id revision checkedRevision check').lean();
    const verified = rows.filter(row => row.checkedRevision === row.revision && row.check?.readAccessConfirmed === true);
    if (!verified.length) {
      this.logger.warn(`Windsor is the primary Google cost source but no verified connection is active for ${date}.`);
      return { source: 'windsor' as const, date, status: 'not_configured' as const, connections: 0, updated: 0, results: [] };
    }

    const results: any[] = [];
    for (const row of verified) {
      try {
        // Connections are intentionally processed sequentially to keep provider quota predictable.
        // eslint-disable-next-line no-await-in-loop
        const dateFrom = new Date(+this.day(date) - 6 * 86_400_000).toISOString().slice(0, 10);
        results.push(await this.syncConnection(String(row._id), { dateFrom, dateTo: date }, actor));
      } catch (error) {
        this.logger.error(`Windsor Google cost sync failed for connection ${String(row._id)}: ${(error as Error)?.message}`);
        results.push({ connectionId: String(row._id), status: 'failed', error: 'WINDSOR_SYNC_FAILED' });
      }
    }
    const updated = results.reduce((total, result) => total + Number(result.materialization?.updated || 0), 0);
    return {
      source: 'windsor' as const,
      date,
      status: results.every(result => result.status === 'success') ? 'success' as const : 'partial' as const,
      connections: verified.length,
      updated,
      results,
    };
  }

  async snapshot(id: string, query: WindsorAdsSnapshotQueryDto) {
    const snapshot: any = await this.readService.snapshot(id, query);
    const costs: any[] = await this.costModel.find({
      channel: 'google', sourceSystem: 'windsor', sourceConnectionId: id,
      date: {
        $gte: this.day(snapshot.dateFrom),
        $lte: this.day(snapshot.dateTo),
      },
    }).select('customerId adGroupId date sourceSyncRunId isEstimated spentAmount estimationSampleDays').lean();
    const runByKey = new Map(costs.map(cost => [this.naturalKey(
      String(cost.customerId || ''), String(cost.adGroupId || ''), this.isoDay(cost.date),
    ), String(cost.sourceSyncRunId || '')]));
    const materializedRows = snapshot.rows.filter((row: any) => runByKey.get(
      this.naturalKey(String(row.accountId), String(row.adGroupId), String(row.date)),
    ) === String(row.lastSyncRunId || '')).length;
    return {
      ...snapshot,
      materializedRows,
      estimatedRows: costs.filter(cost => cost.isEstimated).length,
      estimatedSpend: costs.filter(cost => cost.isEstimated).reduce((sum, cost) => sum + Number(cost.spentAmount || 0), 0),
      materializedToAdvertisingCost: snapshot.rows.length > 0 && materializedRows === snapshot.rows.length,
      primaryCostSource: configuredGoogleAdsCostSource(),
    };
  }

  private async materializeRun(connectionId: string, runId: string, dateFrom: string, dateTo: string,
    completedSlices?: Array<{ accountId: string; date: string }>) {
    if (!Types.ObjectId.isValid(connectionId)) throw new BadRequestException('ID kết nối không hợp lệ.');
    const metrics: any[] = await this.metricModel.find({
      connectionId: new Types.ObjectId(connectionId), lastSyncRunId: runId,
      date: { $gte: dateFrom, $lte: dateTo },
      ...(completedSlices ? { $or: completedSlices.map(slice => ({ accountId: slice.accountId, date: slice.date })) } : {}),
    }).sort({ date: 1, accountId: 1, adGroupId: 1 }).lean();

    const baseCurrency = String(process.env.ADS_BASE_CURRENCY || 'VND').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(baseCurrency)) throw new BadRequestException('ADS_BASE_CURRENCY không hợp lệ.');
    const invalidCurrency = metrics.find(row => row.currency !== baseCurrency);
    if (invalidCurrency) {
      throw new BadRequestException(`Không thể ghi chi phí Windsor khác tiền tệ cơ sở ${baseCurrency}.`);
    }

    const seen = new Set<string>();
    const operations = metrics.map(row => {
      const date = this.day(row.date);
      const key = this.naturalKey(String(row.accountId), String(row.adGroupId), String(row.date));
      if (seen.has(key)) throw new BadRequestException('Windsor trả nhiều dòng cho cùng tài khoản, nhóm quảng cáo và ngày.');
      seen.add(key);
      const filter = { channel: 'google', customerId: String(row.accountId), adGroupId: String(row.adGroupId), date };
      return { updateOne: {
        filter,
        update: { $set: {
          ...filter,
          spentAmount: Number(row.spend || 0),
          impressions: Number(row.impressions || 0),
          clicks: Number(row.clicks || 0),
          conversions: Number(row.conversions || 0),
          allConversions: Number(row.allConversions || 0),
          conversionValue: Number(row.conversionValue || 0),
          costPerConversion: Number(row.costPerConversion || 0),
          cpc: Number(row.cpc || 0),
          cpm: Number(row.cpm || 0),
          sourceSystem: 'windsor',
          isEstimated: false,
          sourceConnectionId: connectionId,
          sourceSyncRunId: runId,
          campaignId: String(row.campaignId),
          campaignName: row.campaignName,
          adGroupName: row.adGroupName,
          currency: row.currency,
          providerFetchedAt: row.fetchedAt,
        }, $unset: { estimationMethod: 1, estimationSampleDays: 1, estimatedAt: 1 } },
        upsert: true,
      } };
    });
    // A complete successful account/day supersedes placeholders even if a group now has no rows/spend.
    for (const slice of completedSlices || []) {
      operations.push({ updateMany: {
        filter: { channel: 'google', customerId: slice.accountId, date: this.day(slice.date),
          sourceConnectionId: connectionId, isEstimated: true,
          adGroupId: { $nin: metrics.filter(row => row.accountId === slice.accountId && row.date === slice.date).map(row => row.adGroupId) },
        }, update: { $set: { spentAmount: 0, isEstimated: false, sourceSyncRunId: runId, providerFetchedAt: new Date() },
          $unset: { estimationMethod: 1, estimationSampleDays: 1, estimatedAt: 1 } },
      } } as any);
    }
    if (!operations.length) return { status: 'success', rows: 0, updated: 0, upserted: 0, modified: 0 };
    const days = [...new Set([...metrics.map(row => String(row.date)), ...(completedSlices || []).map(slice => slice.date)])];
    const result: any = await this.persistCosts(operations, days);
    return {
      status: 'success', rows: metrics.length, updated: metrics.length,
      upserted: Number(result.upsertedCount || 0), modified: Number(result.modifiedCount || 0),
    };
  }

  private async persistCosts(operations: any[], days: string[]) {
    const session = await this.costModel.db.startSession();
    let result: any;
    try {
      await session.withTransaction(async () => {
        await this.refresh.mark(days, session);
        result = await this.costModel.bulkWrite(operations, { ordered: true, session });
      });
      return result;
    } finally { await session.endSession(); }
  }

  private days(from: string, to: string) {
    const days: string[] = [];
    for (let cursor = +this.day(from); cursor <= +this.day(to); cursor += 86_400_000) days.push(new Date(cursor).toISOString().slice(0, 10));
    return days;
  }

  private async estimateFailedSlices(connectionId: string, read: any) {
    const result = { rows: 0, unresolved: [] as Array<{ accountId: string; date: string }>, method: 'mean_last_7_actual_days_within_28' };
    if (read.status === 'success') return result;
    // Only transport outages/quota failures justify estimates. Contract/security errors remain blocked.
    const eligible = new Set(['PROVIDER_TIMEOUT', 'PROVIDER_UNAVAILABLE', 'RATE_LIMITED']);
    for (const accountId of read.accountIds || []) for (const date of this.days(read.dateFrom, read.dateTo)) {
      const errors = (read.errors || []).filter(error => (!error.accountId || error.accountId === accountId) && (!error.date || error.date === date));
      if (!errors.length) continue;
      if (errors.some(error => !eligible.has(error.code))) { result.unresolved.push({ accountId, date }); continue; }
      const history = await this.costModel.find({ channel: 'google', customerId: accountId,
        sourceConnectionId: connectionId, sourceSystem: 'windsor', isEstimated: { $ne: true },
        currency: String(process.env.ADS_BASE_CURRENCY || 'VND').toUpperCase(),
        date: { $gte: new Date(+this.day(date) - 28 * 86_400_000), $lt: this.day(date) },
      }).lean();
      const estimates = estimateWindsorCosts(history, date);
      if (!estimates.length) { result.unresolved.push({ accountId, date }); continue; }
      if (new Set(history.map(row => row.adGroupId)).size > estimates.length) result.unresolved.push({ accountId, date });
      // Insert-only by natural key: a failed read never downgrades an existing actual cost.
      const operations = estimates.map(row => ({ updateOne: {
        filter: { channel: 'google', customerId: accountId, adGroupId: row.adGroupId, date: this.day(date) },
        update: { $setOnInsert: {
          spentAmount: row.spentAmount, sourceSystem: 'windsor', sourceConnectionId: connectionId,
          campaignId: row.campaignId, campaignName: row.campaignName, adGroupName: row.adGroupName, currency: row.currency,
          isEstimated: true, estimationMethod: result.method, estimationSampleDays: row.estimationSampleDays,
          estimatedAt: new Date(),
        } }, upsert: true,
      } }));
      const written = await this.persistCosts(operations, [date]);
      result.rows += Number(written.upsertedCount || 0);
    }
    return result;
  }

  private assertDay(value: string) { this.day(value); }

  private day(value: unknown): Date {
    const text = typeof value === 'string' ? value : this.isoDay(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new BadRequestException('Ngày phải có định dạng YYYY-MM-DD.');
    const date = new Date(`${text}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
      throw new BadRequestException('Ngày không hợp lệ.');
    }
    return date;
  }

  private isoDay(value: unknown): string {
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  }

  private naturalKey(accountId: string, adGroupId: string, date: string) {
    return `${accountId}:${adGroupId}:${date}`;
  }
}
