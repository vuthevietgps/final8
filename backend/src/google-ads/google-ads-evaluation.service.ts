import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { redactSecretString } from '../common/utils/secret-redaction.util';
import { GoogleAdsReadonlySyncService } from './google-ads-readonly-sync.service';
import {
  GoogleAdsActionEvaluation,
  GoogleAdsActionEvaluationDocument,
  GoogleAdsEvaluationResult,
} from './schemas/google-ads-action-evaluation.schema';
import { GoogleAdsDailyMetric, GoogleAdsDailyMetricDocument } from './schemas/google-ads-daily-metric.schema';

type ComparedMetrics = {
  spend: number;
  revenue: number;
  grossProfit: number;
  netProfit: number;
  conversions: number;
  CPA: number | null;
  ROAS: number | null;
  profitPerSpend: number | null;
  rowCount: number;
  profitDataStatus: 'fresh' | 'missing' | 'stale';
  profitUpdatedAt: string | null;
};

type ComparableMetricName =
  | 'spend'
  | 'revenue'
  | 'grossProfit'
  | 'netProfit'
  | 'conversions'
  | 'CPA'
  | 'ROAS'
  | 'profitPerSpend';

@Injectable()
export class GoogleAdsEvaluationService {
  private readonly logger = new Logger(GoogleAdsEvaluationService.name);

  constructor(
    @InjectModel(GoogleAdsActionEvaluation.name)
    private readonly evaluationModel: Model<GoogleAdsActionEvaluationDocument>,
    @InjectModel(GoogleAdsDailyMetric.name)
    private readonly dailyMetricModel: Model<GoogleAdsDailyMetricDocument>,
    private readonly readonlySyncService: GoogleAdsReadonlySyncService,
  ) {}

  @Cron('0 20 * * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async runEvaluationCron() {
    try {
      const result = await this.evaluateDueActions(false);
      if (result.evaluated || result.failed) {
        this.logger.log(`Google Ads evaluations completed=${result.evaluated} failed=${result.failed}`);
      }
    } catch (error: any) {
      this.logger.warn(`Google Ads evaluation cron failed: ${redactSecretString(error?.message || String(error))}`);
    }
  }

  async evaluateDueActions(force = false) {
    const filter: any = { status: 'pending' };
    if (!force) filter.dueAt = { $lte: new Date() };
    const limit = Math.max(1, Math.min(100, Number(process.env.GOOGLE_ADS_EVALUATION_BATCH_SIZE || 20)));
    const jobs: any[] = await this.evaluationModel.find(filter).sort({ dueAt: 1 }).limit(limit).lean();
    let evaluated = 0;
    let failed = 0;

    for (const job of jobs) {
      const claimed: any = await this.evaluationModel.findOneAndUpdate(
        { _id: job._id, status: 'pending' },
        { $set: { status: 'evaluating', failureMessage: undefined } },
        { new: true },
      ).lean();
      if (!claimed) continue;
      try {
        await this.evaluateJob(claimed);
        evaluated += 1;
      } catch (error: any) {
        failed += 1;
        await this.evaluationModel.updateOne(
          { _id: claimed._id },
          {
            $set: {
              status: 'failed',
              failureMessage: redactSecretString(error?.message || String(error)),
              evaluatedAt: new Date(),
            },
          },
        );
      }
    }
    return { selected: jobs.length, evaluated, failed };
  }

  private async evaluateJob(job: any) {
    let syncResult: any;
    try {
      syncResult = await this.readonlySyncService.sync({
        customerIds: [job.customerId],
        dateFrom: job.baselineWindow.from,
        dateTo: job.evaluationWindow.to,
      });
    } catch (error: any) {
      syncResult = {
        status: 'failed',
        errors: [{ step: 'evaluation_sync', message: redactSecretString(error?.message || String(error)) }],
      };
    }

    const scope = this.scopeFilter(job);
    let beforeRows: any[] = [];
    let afterRows: any[] = [];
    if (scope) {
      [beforeRows, afterRows] = await Promise.all([
        this.dailyMetricModel.find({
          ...scope,
          date: { $gte: job.baselineWindow.from, $lte: job.baselineWindow.to },
        }).lean(),
        this.dailyMetricModel.find({
          ...scope,
          date: { $gte: job.evaluationWindow.from, $lte: job.evaluationWindow.to },
        }).lean(),
      ]);
    }

    const beforeMetrics = this.aggregate(beforeRows);
    const afterMetrics = this.aggregate(afterRows);
    if ((syncResult?.errors || []).some((error: any) => error?.step === 'erp_profit_enrichment')) {
      beforeMetrics.profitDataStatus = 'missing';
      afterMetrics.profitDataStatus = 'missing';
    }
    const delta = this.compare(beforeMetrics, afterMetrics);
    const { result, insight } = this.classify(beforeMetrics, afterMetrics);
    await this.evaluationModel.updateOne(
      { _id: job._id },
      {
        $set: {
          status: 'completed',
          result,
          beforeMetrics,
          afterMetrics,
          delta,
          syncResult,
          insight,
          failureMessage: undefined,
          evaluatedAt: new Date(),
        },
      },
    );
  }

  private scopeFilter(job: any) {
    const filter: Record<string, any> = { customerId: job.customerId, level: job.scopeLevel };
    if (job.scopeLevel === 'campaign' && job.campaignId) filter.campaignId = job.campaignId;
    else if (job.scopeLevel === 'ad_group' && job.adGroupId) filter.adGroupId = job.adGroupId;
    else if (job.scopeLevel === 'keyword' && job.adGroupId && job.criterionId) {
      filter.adGroupId = job.adGroupId;
      filter.criterionId = job.criterionId;
    } else if (job.scopeLevel === 'ad' && job.adGroupId && job.adId) {
      filter.adGroupId = job.adGroupId;
      filter.adId = job.adId;
    }
    else return null;
    return filter;
  }

  private aggregate(rows: any[]): ComparedMetrics {
    const totals = rows.reduce((result, row) => ({
      spend: result.spend + Number(row.costVnd || 0),
      revenue: result.revenue + Number(row.revenue || 0),
      grossProfit: result.grossProfit + Number(row.grossProfit || 0),
      netProfit: result.netProfit + Number(row.netProfit || 0),
      conversions: result.conversions + Number(row.conversions || 0),
    }), { spend: 0, revenue: 0, grossProfit: 0, netProfit: 0, conversions: 0 });
    const provenance = this.profitProvenance(rows);
    return {
      ...totals,
      CPA: totals.conversions > 0 ? totals.spend / totals.conversions : null,
      ROAS: totals.spend > 0 ? totals.revenue / totals.spend : null,
      profitPerSpend: totals.spend > 0 ? totals.netProfit / totals.spend : null,
      rowCount: rows.length,
      ...provenance,
    };
  }

  private compare(before: ComparedMetrics, after: ComparedMetrics) {
    const fields: ComparableMetricName[] = [
      'spend', 'revenue', 'grossProfit', 'netProfit', 'conversions', 'CPA', 'ROAS', 'profitPerSpend',
    ];
    return Object.fromEntries(fields.map((field) => {
      const beforeValue = Number(before[field] || 0);
      const afterValue = Number(after[field] || 0);
      return [field, {
        absolute: afterValue - beforeValue,
        percent: beforeValue === 0 ? null : ((afterValue - beforeValue) / Math.abs(beforeValue)) * 100,
      }];
    }));
  }

  private classify(before: ComparedMetrics, after: ComparedMetrics): {
    result: GoogleAdsEvaluationResult;
    insight: string;
  } {
    if (before.profitDataStatus !== 'fresh' || after.profitDataStatus !== 'fresh') {
      return {
        result: 'insufficient_data',
        insight: 'ERP profit enrichment is missing or stale; evaluation is on hold.',
      };
    }
    if (!before.rowCount || !after.rowCount) {
      return { result: 'insufficient_data', insight: 'Baseline or evaluation window has no synced metrics.' };
    }
    const netProfitChange = this.percentChange(before.netProfit, after.netProfit);
    const roasChange = this.percentChange(before.ROAS, after.ROAS);
    const profitPerSpendChange = this.percentChange(before.profitPerSpend, after.profitPerSpend);
    const cpaChange = this.percentChange(before.CPA, after.CPA);
    const conversionsChange = this.percentChange(before.conversions, after.conversions);

    if (
      (netProfitChange !== null && netProfitChange <= -25 && after.spend >= before.spend)
      || (after.netProfit < 0 && after.spend > 0 && profitPerSpendChange !== null && profitPerSpendChange <= -30)
    ) {
      return { result: 'rollback_recommended', insight: 'Net profit and spend efficiency materially regressed.' };
    }
    if (
      (netProfitChange !== null && netProfitChange <= -10)
      || (roasChange !== null && roasChange <= -20)
      || (cpaChange !== null && cpaChange >= 20 && (conversionsChange === null || conversionsChange <= 0))
    ) {
      return { result: 'failed', insight: 'Profit or acquisition efficiency regressed beyond the evaluation threshold.' };
    }
    if (
      (netProfitChange !== null && netProfitChange >= 10 && (profitPerSpendChange === null || profitPerSpendChange >= 0))
      || (conversionsChange !== null && conversionsChange >= 10 && (cpaChange === null || cpaChange <= 0))
    ) {
      return { result: 'success', insight: 'Profit or conversion efficiency improved beyond the evaluation threshold.' };
    }
    return { result: 'neutral', insight: 'Observed changes did not cross success or failure thresholds.' };
  }

  private percentChange(before: number | null, after: number | null) {
    if (before === null || after === null || before === 0) return null;
    return ((after - before) / Math.abs(before)) * 100;
  }

  private profitProvenance(rows: any[]): Pick<ComparedMetrics, 'profitDataStatus' | 'profitUpdatedAt'> {
    if (!rows.length || rows.some((row) => !row.erpEnrichedAt || !row.profitUpdatedAt)) {
      return { profitDataStatus: 'missing', profitUpdatedAt: null };
    }
    const dates = rows
      .map((row) => new Date(row.profitUpdatedAt))
      .filter((date) => !Number.isNaN(date.getTime()));
    if (dates.length !== rows.length) {
      return { profitDataStatus: 'missing', profitUpdatedAt: null };
    }
    const latest = dates.sort((left, right) => right.getTime() - left.getTime())[0];
    const maxAgeHours = Math.max(1, Number(process.env.GOOGLE_ADS_PROFIT_FRESHNESS_HOURS || 48));
    const stale = dates.some((date) => Date.now() - date.getTime() > maxAgeHours * 60 * 60 * 1000);
    return {
      profitDataStatus: stale ? 'stale' : 'fresh',
      profitUpdatedAt: latest.toISOString(),
    };
  }
}
