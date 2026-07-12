import { Injectable } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";
import {
  CoverageResult,
  DbCoverageTarget,
  SourceRegistryEntry,
} from "./source-registry.types";

@Injectable()
export class CoverageGateService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async assess(
    source: SourceRegistryEntry,
    reportDate: string,
    hasAnyRecords: boolean,
  ): Promise<CoverageResult> {
    if (source.coverageMethod === "not_applicable") {
      return this.fixedResult("not_applicable", null);
    }
    if (
      source.coverageMethod === "unsupported" ||
      source.availability === "unsupported" ||
      source.availability === "not_configured"
    ) {
      return this.fixedResult("unsupported", null);
    }
    if (!source.coverageTargets?.length) {
      return this.fixedResult("unknown", null);
    }

    let count = 0;
    const evidence: CoverageResult["evidence"] = [];
    const warnings: string[] = [];
    let readFailed = false;

    for (const target of source.coverageTargets) {
      try {
        const filter = this.coverageFilter(target, reportDate);
        const targetCount = await this.connection
          .collection(target.collectionName)
          .countDocuments(this.combineFilters(target.filter, filter));
        count += targetCount;
        evidence.push({
          method: source.coverageMethod,
          collectionOrModel: target.collectionName,
          field:
            target.mode === "report_date"
              ? target.field
              : `${target.startField}..${target.endField}`,
          value: targetCount,
          note: `report_date=${reportDate}`,
        });
      } catch {
        readFailed = true;
        warnings.push(
          `DB-only coverage read unavailable for ${target.collectionName}.`,
        );
      }
    }

    if (readFailed) {
      return {
        ...this.fixedResult("unknown", null),
        evidence,
        warnings,
      };
    }
    if (count > 0) {
      return {
        coverageStatus: "covered",
        reportDateRecordCount: count,
        expectedRecordCount: null,
        evidence,
        warnings,
        blockingReasons: [],
      };
    }

    const coverageStatus = hasAnyRecords
      ? "no_records_for_report_date"
      : "missing";
    return {
      coverageStatus,
      reportDateRecordCount: 0,
      expectedRecordCount: null,
      evidence,
      warnings,
      blockingReasons: [`coverage_${coverageStatus}`],
    };
  }

  private coverageFilter(
    target: DbCoverageTarget,
    reportDate: string,
  ): Record<string, unknown> {
    if (target.mode === "report_date") {
      if (!target.field) throw new Error("Missing report-date coverage field.");
      if (target.valueType === "date_string") {
        return { [target.field]: reportDate };
      }
      const { start, end } = this.dayRange(reportDate);
      return { [target.field]: { $gte: start, $lt: end } };
    }

    if (!target.startField || !target.endField) {
      throw new Error("Missing date-range coverage fields.");
    }
    const { start, end } = this.dayRange(reportDate);
    return {
      [target.startField]: { $lt: end },
      [target.endField]: { $gte: start },
    };
  }

  private combineFilters(
    base: Record<string, unknown> | undefined,
    coverage: Record<string, unknown>,
  ): Record<string, unknown> {
    return base && Object.keys(base).length
      ? { $and: [base, coverage] }
      : coverage;
  }

  private dayRange(reportDate: string): { start: Date; end: Date } {
    const start = new Date(`${reportDate}T00:00:00.000+07:00`);
    if (Number.isNaN(start.getTime())) throw new Error("Invalid report date.");
    return { start, end: new Date(start.getTime() + 86_400_000) };
  }

  private fixedResult(
    coverageStatus: CoverageResult["coverageStatus"],
    reportDateRecordCount: number | null,
  ): CoverageResult {
    return {
      coverageStatus,
      reportDateRecordCount,
      expectedRecordCount: null,
      evidence: [],
      warnings: [],
      blockingReasons:
        coverageStatus === "covered" || coverageStatus === "not_applicable"
          ? []
          : [`coverage_${coverageStatus}`],
    };
  }
}
