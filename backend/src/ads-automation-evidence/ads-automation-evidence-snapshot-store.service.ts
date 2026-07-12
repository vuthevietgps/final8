import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { createHash } from 'crypto';
import { Model } from 'mongoose';
import { redactSecretString, redactSecrets } from '../common/utils/secret-redaction.util';
import { AdsAutomationEvidenceService } from './ads-automation-evidence.service';
import {
  AdsAutomationEvidenceSnapshotRecord,
  AdsAutomationEvidenceSnapshotRecordDocument,
} from './schemas/ads-automation-evidence-snapshot.schema';

const SNAPSHOT_SCHEMA_VERSION = 'ads_automation_evidence_snapshot.v1';
const SNAPSHOT_TIME_ZONE = 'Asia/Bangkok';

type SnapshotEnvironment = 'local' | 'demo' | 'staging' | 'production';

export interface CaptureAdsAutomationEvidenceOptions {
  limit?: number;
  lookbackDays?: number;
}

@Injectable()
export class AdsAutomationEvidenceSnapshotStoreService {
  private readonly logger = new Logger(AdsAutomationEvidenceSnapshotStoreService.name);

  constructor(
    @InjectModel(AdsAutomationEvidenceSnapshotRecord.name)
    private readonly snapshotModel: Model<AdsAutomationEvidenceSnapshotRecordDocument>,
    private readonly evidenceService: AdsAutomationEvidenceService,
  ) {}

  async captureDaily(options: CaptureAdsAutomationEvidenceOptions = {}): Promise<{
    created: boolean;
    snapshot: Record<string, any>;
  }> {
    const now = new Date();
    const dateKey = bangkokDateKey(now);
    const environment = currentEnvironment();
    const identity = {
      dateKey,
      environment,
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    };

    const existing = await this.snapshotModel.findOne(identity).lean().exec();
    if (existing) return { created: false, snapshot: existing as any };

    const built = await this.evidenceService.buildSnapshot(options);
    this.assertLocalErpOnly(built);
    if (built.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
      throw new Error(`Unsupported Ads evidence schema version: ${built.schemaVersion}`);
    }
    if (built.environment !== environment) {
      throw new Error('Ads evidence environment changed during capture');
    }

    const payload = redactSecrets(built) as unknown as Record<string, unknown>;
    const record = {
      ...identity,
      payload,
      hash: this.hashPayload(payload),
      capturedAt: now,
    };

    try {
      const created = await this.snapshotModel.create(record);
      return { created: true, snapshot: this.toPlain(created) };
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const concurrentWinner = await this.snapshotModel.findOne(identity).lean().exec();
      if (!concurrentWinner) throw error;
      return { created: false, snapshot: concurrentWinner as any };
    }
  }

  async latest(environment?: string): Promise<Record<string, any> | null> {
    return this.snapshotModel
      .findOne({ environment: normalizeEnvironment(environment) })
      .sort({ capturedAt: -1 })
      .lean()
      .exec() as any;
  }

  async history(options: {
    environment?: string;
    limit?: number;
    beforeDateKey?: string;
  } = {}): Promise<Record<string, any>[]> {
    const filter: Record<string, any> = {
      environment: normalizeEnvironment(options.environment),
    };
    if (options.beforeDateKey) {
      const beforeDateKey = normalizeDateKey(options.beforeDateKey);
      if (beforeDateKey) filter.dateKey = { $lt: beforeDateKey };
    }
    const limit = clamp(options.limit, 1, 100, 30);
    return this.snapshotModel
      .find(filter)
      .sort({ dateKey: -1, capturedAt: -1 })
      .limit(limit)
      .lean()
      .exec() as any;
  }

  hashPayload(payload: unknown): string {
    return createHash('sha256').update(stableJson(payload)).digest('hex');
  }

  @Cron('0 5 0 * * *', { timeZone: SNAPSHOT_TIME_ZONE })
  async captureDailyOnSchedule(): Promise<void> {
    try {
      const result = await this.captureDaily();
      if (result.created) {
        this.logger.log(
          `Captured immutable Ads evidence snapshot dateKey=${result.snapshot.dateKey} environment=${result.snapshot.environment}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Ads evidence daily capture failed: ${redactSecretString(error instanceof Error ? error.message : String(error))}`,
      );
    }
  }

  private assertLocalErpOnly(snapshot: any): void {
    if (
      snapshot?.safety?.providerApiCalled !== false
      || snapshot?.safety?.googleAdsApiCalled !== false
      || snapshot?.safety?.liveExecutionUsed !== false
      || snapshot?.safety?.secretsRedacted !== true
    ) {
      throw new Error('Ads evidence capture accepts only redacted local ERP snapshots without provider calls');
    }
  }

  private toPlain(value: any): Record<string, any> {
    return typeof value?.toObject === 'function' ? value.toObject() : { ...value };
  }
}

export function bangkokDateKey(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SNAPSHOT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function currentEnvironment(): SnapshotEnvironment {
  const env = String(process.env.NODE_ENV || '').toLowerCase();
  if (env === 'production') return 'production';
  if (env === 'staging') return 'staging';
  if (String(process.env.DATABASE_NAME || process.env.MONGODB_URI || '').toLowerCase().includes('demo')) return 'demo';
  return 'local';
}

function normalizeEnvironment(value?: string): SnapshotEnvironment {
  const normalized = String(value || '').trim().toLowerCase();
  if (['local', 'demo', 'staging', 'production'].includes(normalized)) {
    return normalized as SnapshotEnvironment;
  }
  return currentEnvironment();
}

function normalizeDateKey(value?: string): string | undefined {
  const normalized = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : undefined;
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function isDuplicateKeyError(error: any): boolean {
  return Number(error?.code) === 11000 || /duplicate key/i.test(String(error?.message || ''));
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortForHash(value));
}

function sortForHash(value: any): any {
  if (Array.isArray(value)) return value.map((item) => sortForHash(item));
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  return Object.keys(value)
    .sort()
    .reduce((result: Record<string, unknown>, key) => {
      result[key] = sortForHash(value[key]);
      return result;
    }, {});
}
