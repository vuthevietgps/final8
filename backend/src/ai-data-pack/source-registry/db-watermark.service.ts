import { Injectable } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";
import {
  DbWatermarkField,
  DbWatermarkResult,
  SourceEvidence,
  SourceRegistryEntry,
} from "./source-registry.types";

interface WatermarkCandidate {
  at: Date;
  rawValue: string;
  field: DbWatermarkField;
  collectionName: string;
}

@Injectable()
export class DbWatermarkService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async assess(
    source: SourceRegistryEntry,
    now: Date = new Date(),
  ): Promise<DbWatermarkResult> {
    if (source.availability === "unsupported") {
      return this.fixedResult("unsupported", source.defaultMaxStalenessMinutes);
    }
    if (source.availability === "not_configured") {
      return this.fixedResult(
        "not_configured",
        source.defaultMaxStalenessMinutes,
      );
    }

    const evidence: SourceEvidence[] = [];
    const warnings: string[] = [];
    const candidates: WatermarkCandidate[] = [];
    let hasAnyRecords = false;
    let readFailed = false;

    for (const target of source.watermarkTargets || []) {
      try {
        const collection = this.connection.collection(target.collectionName);
        const anyRecord = await collection.findOne(target.filter || {}, {
          projection: { _id: 1 },
        });
        hasAnyRecords ||= Boolean(anyRecord);

        for (const field of target.fields) {
          const row = await collection.findOne(
            {
              ...(target.filter || {}),
              [field.field]: { $exists: true, $ne: null },
            },
            {
              projection: { [field.field]: 1 },
              sort: { [field.field]: -1 },
            },
          );
          const candidate = this.toCandidate(
            row?.[field.field],
            field,
            target.collectionName,
          );
          if (!candidate) continue;
          candidates.push(candidate);
          evidence.push({
            method: source.freshnessMethod,
            collectionOrModel: target.collectionName,
            field: field.field,
            value: candidate.rawValue,
            note: field.kind,
          });
        }
      } catch {
        readFailed = true;
        warnings.push(
          `DB-only watermark read unavailable for ${target.collectionName}.`,
        );
      }
    }

    if (
      source.freshnessMethod === "static_config" &&
      !hasAnyRecords &&
      !readFailed
    ) {
      return {
        ...this.fixedResult(
          "not_configured",
          source.defaultMaxStalenessMinutes,
        ),
        warnings,
      };
    }

    if (!candidates.length) {
      const freshnessStatus = readFailed ? "unknown" : "missing";
      return {
        ...this.fixedResult(freshnessStatus, source.defaultMaxStalenessMinutes),
        hasAnyRecords,
        evidence,
        warnings,
        blockingReasons: [`freshness_${freshnessStatus}`],
      };
    }

    const lastSuccessful = this.latestOfKind(
      candidates,
      "last_successful_sync",
    );
    const latestUpdated = this.latestOfKind(candidates, "record_updated");
    const latestRecordDate = this.latestOfKind(candidates, "record_date");
    const anchor = lastSuccessful || latestUpdated || latestRecordDate;
    const freshnessMinutes = Math.max(
      0,
      Math.floor((now.getTime() - anchor.at.getTime()) / 60_000),
    );
    const threshold = source.defaultMaxStalenessMinutes;
    const freshnessStatus =
      threshold === null
        ? "unknown"
        : freshnessMinutes <= threshold
          ? "fresh"
          : "stale";
    const staleByMinutes =
      threshold === null ? null : Math.max(0, freshnessMinutes - threshold);

    return {
      freshnessStatus,
      lastSuccessfulSyncAt: lastSuccessful?.at.toISOString() || null,
      latestRecordUpdatedAt: latestUpdated?.at.toISOString() || null,
      latestRecordDate: latestRecordDate?.rawValue || null,
      maxStalenessMinutes: threshold,
      freshnessMinutes,
      staleByMinutes,
      hasAnyRecords,
      evidence,
      warnings,
      blockingReasons:
        freshnessStatus === "fresh" ? [] : [`freshness_${freshnessStatus}`],
    };
  }

  private fixedResult(
    freshnessStatus: DbWatermarkResult["freshnessStatus"],
    maxStalenessMinutes: number | null,
  ): DbWatermarkResult {
    return {
      freshnessStatus,
      lastSuccessfulSyncAt: null,
      latestRecordUpdatedAt: null,
      latestRecordDate: null,
      maxStalenessMinutes,
      freshnessMinutes: null,
      staleByMinutes: null,
      hasAnyRecords: false,
      evidence: [],
      warnings: [],
      blockingReasons:
        freshnessStatus === "fresh" ? [] : [`freshness_${freshnessStatus}`],
    };
  }

  private toCandidate(
    value: unknown,
    field: DbWatermarkField,
    collectionName: string,
  ): WatermarkCandidate | null {
    if (value === null || value === undefined) return null;
    const rawValue =
      field.valueType === "date_string"
        ? String(value)
        : new Date(value as string | number | Date).toISOString();
    const at =
      field.valueType === "date_string"
        ? new Date(`${rawValue}T00:00:00.000Z`)
        : new Date(value as string | number | Date);
    if (Number.isNaN(at.getTime())) return null;
    return { at, rawValue, field, collectionName };
  }

  private latestOfKind(
    candidates: WatermarkCandidate[],
    kind: DbWatermarkField["kind"],
  ): WatermarkCandidate | undefined {
    return candidates
      .filter((candidate) => candidate.field.kind === kind)
      .sort((left, right) => right.at.getTime() - left.at.getTime())[0];
  }
}
