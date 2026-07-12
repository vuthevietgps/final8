import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { DataPackMetadataService } from './data-pack-metadata.service';
import { findRows } from './queries/query.util';
import { redactDataPack } from './utils/redaction.util';
import { JsonExporterService } from './export/json-exporter.service';

@Injectable()
export class DecisionHistoryExportService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly metadata: DataPackMetadataService,
    private readonly json: JsonExporterService,
  ) {}

  async build(from: string, to: string, format: 'json' | 'xlsx' = 'json', generatedBy?: unknown) {
    const start = new Date(`${from}T00:00:00.000+07:00`);
    const end = new Date(new Date(`${to}T00:00:00.000+07:00`).getTime() + 86_400_000);
    const [googleChanges, googleEvaluations, legacyEvaluations] = await Promise.all([
      findRows(this.connection, 'google_ads_change_logs', { executedAt: { $gte: start, $lt: end } }, {
        planId: 1, actionId: 1, provider: 1, customerId: 1, actionType: 1, resourceType: 1,
        campaignId: 1, adGroupId: 1, criterionId: 1, adId: 1, beforeValue: 1, afterValue: 1,
        reason: 1, providerRequestId: 1, syncResult: 1, evaluationDueAt: 1, executedAt: 1,
      }),
      findRows(this.connection, 'google_ads_action_evaluations', { executedAt: { $gte: start, $lt: end } }, {
        planId: 1, actionId: 1, evaluationDays: 1, status: 1, result: 1, beforeMetrics: 1, afterMetrics: 1, insight: 1, executedAt: 1,
      }),
      findRows(this.connection, 'ads_action_evaluations', { executedAt: { $gte: start, $lt: end } }, {
        planId: 1, itemId: 1, provider: 1, actionType: 1, status: 1, result: 1, beforeMetrics: 1, afterMetrics: 1, executedAt: 1,
      }),
    ]);
    return this.json.attachChecksums(redactDataPack({
      metadata: { ...this.metadata.create('decision_history', to, format, generatedBy), date_range: { from, to } },
      decisions: googleChanges,
      evaluations: [...googleEvaluations, ...legacyEvaluations],
      quality: {
        source: 'Google Ads and legacy ads read-only decision/evaluation logs',
        data_quality_status: googleChanges.length || googleEvaluations.length || legacyEvaluations.length ? 'partial' : 'missing',
        confidence: googleChanges.length ? 'high' : 'low',
        warning: ['Google decision history is stronger than other domains.'],
        missing_fields: ['unified_cross_domain_decision_history'],
        can_use_for_decision: googleChanges.length ? 'cautious' : 'no',
      },
    }));
  }
}
