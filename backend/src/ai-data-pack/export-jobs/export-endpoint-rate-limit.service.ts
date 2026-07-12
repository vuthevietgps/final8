import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Optional,
} from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { ConfigService } from "@nestjs/config";
import { Cache } from "cache-manager";
import {
  AiDataPackExportFormat,
  AiDataPackExportMode,
  CachedExportPackType,
  OFFICIAL_EXPORT_MODE,
} from "./export-job.types";

export const AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMITS = {
  windowMs: 60_000,
  createPerActor: 10,
  createPerMode: 6,
  officialCreatePerActor: 2,
  statusPollPerActorJob: 60,
  syncSummaryPerActorJob: 12,
  downloadPerActor: 30,
  downloadPerActorJob: 12,
  downloadPerArtifact: 20,
  idempotencyReplayPerActorKey: 20,
  denialPerActor: 30,
  maxDateRangeDays: 31,
  maxPackTypes: 4,
  maxFormats: 2,
  maxConcurrentOfficialPerActor: 1,
  maxConcurrentDownloadPerActor: 2,
  maxDownloadFileSizeBytes: 25 * 1024 * 1024,
} as const;

export const AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMIT_CONFIG_KEYS = {
  createPerActor: "AI_DATA_PACK_EXPORT_CREATE_PER_ACTOR",
  createPerMode: "AI_DATA_PACK_EXPORT_CREATE_PER_MODE",
  officialCreatePerActor: "AI_DATA_PACK_EXPORT_OFFICIAL_CREATE_PER_ACTOR",
  statusPollPerActorJob: "AI_DATA_PACK_EXPORT_STATUS_POLL_PER_ACTOR_JOB",
  syncSummaryPerActorJob: "AI_DATA_PACK_EXPORT_SYNC_SUMMARY_PER_ACTOR_JOB",
  downloadPerActor: "AI_DATA_PACK_EXPORT_DOWNLOAD_PER_ACTOR",
  downloadPerActorJob: "AI_DATA_PACK_EXPORT_DOWNLOAD_PER_ACTOR_JOB",
  downloadPerArtifact: "AI_DATA_PACK_EXPORT_DOWNLOAD_PER_ARTIFACT",
  idempotencyReplayPerActorKey:
    "AI_DATA_PACK_EXPORT_IDEMPOTENCY_REPLAY_PER_ACTOR_KEY",
  denialPerActor: "AI_DATA_PACK_EXPORT_DENIAL_PER_ACTOR",
  maxDateRangeDays: "AI_DATA_PACK_EXPORT_MAX_DATE_RANGE_DAYS",
  maxPackTypes: "AI_DATA_PACK_EXPORT_MAX_PACK_TYPES",
  maxFormats: "AI_DATA_PACK_EXPORT_MAX_FORMATS",
  maxConcurrentOfficialPerActor:
    "AI_DATA_PACK_EXPORT_MAX_CONCURRENT_OFFICIAL_PER_ACTOR",
  maxConcurrentDownloadPerActor:
    "AI_DATA_PACK_EXPORT_MAX_CONCURRENT_DOWNLOAD_PER_ACTOR",
  maxDownloadFileSizeBytes: "AI_DATA_PACK_EXPORT_MAX_DOWNLOAD_FILE_SIZE_BYTES",
} as const;

interface ExportEndpointRateLimits {
  windowMs: number;
  createPerActor: number;
  createPerMode: number;
  officialCreatePerActor: number;
  statusPollPerActorJob: number;
  syncSummaryPerActorJob: number;
  downloadPerActor: number;
  downloadPerActorJob: number;
  downloadPerArtifact: number;
  idempotencyReplayPerActorKey: number;
  denialPerActor: number;
  maxDateRangeDays: number;
  maxPackTypes: number;
  maxFormats: number;
  maxConcurrentOfficialPerActor: number;
  maxConcurrentDownloadPerActor: number;
  maxDownloadFileSizeBytes: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class ExportEndpointRateLimitService {
  private readonly buckets = new Map<string, Bucket>();
  private readonly activeOfficialActors = new Set<string>();
  private readonly activeDownloadActors = new Map<string, number>();
  private readonly limits: ExportEndpointRateLimits;

  constructor(
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager?: Cache,
    @Optional()
    private readonly configService?: ConfigService,
  ) {
    this.limits = {
      ...AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMITS,
      createPerActor: this.configNumber(
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMIT_CONFIG_KEYS.createPerActor,
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMITS.createPerActor,
      ),
      createPerMode: this.configNumber(
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMIT_CONFIG_KEYS.createPerMode,
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMITS.createPerMode,
      ),
      officialCreatePerActor: this.configNumber(
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMIT_CONFIG_KEYS.officialCreatePerActor,
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMITS.officialCreatePerActor,
      ),
      statusPollPerActorJob: this.configNumber(
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMIT_CONFIG_KEYS.statusPollPerActorJob,
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMITS.statusPollPerActorJob,
      ),
      syncSummaryPerActorJob: this.configNumber(
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMIT_CONFIG_KEYS.syncSummaryPerActorJob,
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMITS.syncSummaryPerActorJob,
      ),
      downloadPerActor: this.configNumber(
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMIT_CONFIG_KEYS.downloadPerActor,
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMITS.downloadPerActor,
      ),
      downloadPerActorJob: this.configNumber(
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMIT_CONFIG_KEYS.downloadPerActorJob,
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMITS.downloadPerActorJob,
      ),
      downloadPerArtifact: this.configNumber(
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMIT_CONFIG_KEYS.downloadPerArtifact,
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMITS.downloadPerArtifact,
      ),
      idempotencyReplayPerActorKey: this.configNumber(
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMIT_CONFIG_KEYS.idempotencyReplayPerActorKey,
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMITS.idempotencyReplayPerActorKey,
      ),
      denialPerActor: this.configNumber(
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMIT_CONFIG_KEYS.denialPerActor,
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMITS.denialPerActor,
      ),
      maxDateRangeDays: this.configNumber(
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMIT_CONFIG_KEYS.maxDateRangeDays,
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMITS.maxDateRangeDays,
      ),
      maxPackTypes: this.configNumber(
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMIT_CONFIG_KEYS.maxPackTypes,
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMITS.maxPackTypes,
      ),
      maxFormats: this.configNumber(
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMIT_CONFIG_KEYS.maxFormats,
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMITS.maxFormats,
      ),
      maxConcurrentOfficialPerActor: this.configNumber(
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMIT_CONFIG_KEYS.maxConcurrentOfficialPerActor,
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMITS.maxConcurrentOfficialPerActor,
      ),
      maxConcurrentDownloadPerActor: this.configNumber(
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMIT_CONFIG_KEYS.maxConcurrentDownloadPerActor,
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMITS.maxConcurrentDownloadPerActor,
      ),
      maxDownloadFileSizeBytes: this.configNumber(
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMIT_CONFIG_KEYS.maxDownloadFileSizeBytes,
        AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMITS.maxDownloadFileSizeBytes,
      ),
    };
  }

  async assertCreateAllowed(input: {
    actorId: string;
    mode: AiDataPackExportMode;
    dateFrom: string;
    dateTo: string;
    packTypes: CachedExportPackType[];
    formats: AiDataPackExportFormat[];
  }): Promise<void> {
    this.assertPayloadLimits(input);
    await this.hit(
      `create:actor:${input.actorId}`,
      this.limits.createPerActor,
    );
    await this.hit(
      `create:mode:${input.actorId}:${input.mode}`,
      this.limits.createPerMode,
    );
    if (input.mode === OFFICIAL_EXPORT_MODE) {
      await this.hit(
        `create:official:${input.actorId}`,
        this.limits.officialCreatePerActor,
      );
    }
  }

  async assertIdempotencyReplayAllowed(
    actorId: string,
    idempotencyKey: string,
  ): Promise<void> {
    await this.hit(
      `idempotency:${actorId}:${idempotencyKey}`,
      this.limits.idempotencyReplayPerActorKey,
    );
  }

  async assertStatusPollAllowed(actorId: string, jobId: string): Promise<void> {
    await this.hit(
      `status:${actorId}:${jobId}`,
      this.limits.statusPollPerActorJob,
    );
  }

  async assertSyncSummaryAllowed(actorId: string, jobId: string): Promise<void> {
    await this.hit(
      `sync-summary:${actorId}:${jobId}`,
      this.limits.syncSummaryPerActorJob,
    );
  }

  async assertDownloadAllowed(input: {
    actorId: string;
    jobId: string;
    artifactId: string;
  }): Promise<void> {
    await this.hit(
      `download:actor:${input.actorId}`,
      this.limits.downloadPerActor,
    );
    await this.hit(
      `download:job:${input.actorId}:${input.jobId}`,
      this.limits.downloadPerActorJob,
    );
    await this.hit(
      `download:artifact:${input.artifactId}`,
      this.limits.downloadPerArtifact,
    );
  }

  assertDownloadFileSizeAllowed(fileSizeBytes: number): void {
    if (
      !Number.isFinite(fileSizeBytes) ||
      fileSizeBytes < 0 ||
      fileSizeBytes > this.limits.maxDownloadFileSizeBytes
    ) {
      throw new HttpException(
        "AI data pack artifact exceeds download limit.",
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }
  }

  async assertDenialAllowed(actorId: string): Promise<void> {
    await this.hit(
      `denial:${actorId}`,
      this.limits.denialPerActor,
    );
  }

  markOfficialInProgress(actorId: string): () => void {
    if (
      this.limits.maxConcurrentOfficialPerActor <= 0 ||
      this.activeOfficialActors.has(actorId)
    ) {
      throw new HttpException(
        "An official export request is already being accepted for this actor.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.activeOfficialActors.add(actorId);
    return () => this.activeOfficialActors.delete(actorId);
  }

  markDownloadInProgress(actorId: string): () => void {
    const active = this.activeDownloadActors.get(actorId) || 0;
    if (
      this.limits.maxConcurrentDownloadPerActor <= 0 ||
      active >= this.limits.maxConcurrentDownloadPerActor
    ) {
      throw new HttpException(
        "An artifact download is already in progress for this actor.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.activeDownloadActors.set(actorId, active + 1);
    return () => {
      const current = this.activeDownloadActors.get(actorId) || 0;
      if (current <= 1) this.activeDownloadActors.delete(actorId);
      else this.activeDownloadActors.set(actorId, current - 1);
    };
  }

  private assertPayloadLimits(input: {
    dateFrom: string;
    dateTo: string;
    packTypes: CachedExportPackType[];
    formats: AiDataPackExportFormat[];
  }): void {
    if (
      input.packTypes.length >
      this.limits.maxPackTypes
    ) {
      throw new BadRequestException("Too many packTypes requested.");
    }
    if (
      input.formats.length > this.limits.maxFormats
    ) {
      throw new BadRequestException("Too many formats requested.");
    }
    const dateFrom = new Date(`${input.dateFrom}T00:00:00.000Z`);
    const dateTo = new Date(`${input.dateTo}T00:00:00.000Z`);
    const rangeDays =
      Math.floor((dateTo.getTime() - dateFrom.getTime()) / 86_400_000) + 1;
    if (
      rangeDays < 1 ||
      rangeDays > this.limits.maxDateRangeDays
    ) {
      throw new BadRequestException("Date range is outside allowed limits.");
    }
  }

  private async hit(key: string, limit: number): Promise<void> {
    const now = Date.now();
    if (this.cacheManager) {
      const cacheKey = `ai-data-pack:export-rate-limit:${key}`;
      const cached = await this.cacheManager.get<Bucket>(cacheKey);
      const bucket =
        cached && cached.resetAt > now
          ? { count: cached.count + 1, resetAt: cached.resetAt }
          : {
              count: 1,
              resetAt: now + this.limits.windowMs,
            };
      await this.cacheManager.set(cacheKey, bucket, this.limits.windowMs);
      this.throwIfOverLimit(bucket.count, limit);
      return;
    }

    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, {
        count: 1,
        resetAt: now + this.limits.windowMs,
      });
      return;
    }
    current.count += 1;
    this.throwIfOverLimit(current.count, limit);
  }

  private throwIfOverLimit(count: number, limit: number): void {
    if (count > limit) {
      throw new HttpException(
        "AI data pack export rate limit hit.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private configNumber(key: string, fallback: number): number {
    const raw =
      this.configService?.get<string | number>(key) ?? process.env[key] ?? "";
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return fallback;
    return Math.floor(value);
  }
}
