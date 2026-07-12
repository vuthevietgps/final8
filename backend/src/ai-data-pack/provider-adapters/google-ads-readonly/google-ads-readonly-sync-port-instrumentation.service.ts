import { Inject, Injectable } from "@nestjs/common";
import { GOOGLE_ADS_READONLY_RAW_SYNC_PORT } from "../provider-adapter.tokens";
import {
  GoogleAdsReadonlySyncPort,
  GoogleAdsReadonlySyncPortResult,
} from "./google-ads-readonly-adapter.types";
import { summarizeGoogleAdsReadonlyWriteTelemetry } from "./google-ads-readonly-write-telemetry";

@Injectable()
export class GoogleAdsReadonlySyncPortInstrumentationService implements GoogleAdsReadonlySyncPort {
  constructor(
    @Inject(GOOGLE_ADS_READONLY_RAW_SYNC_PORT)
    private readonly rawSyncPort: GoogleAdsReadonlySyncPort,
  ) {}

  async sync(input: {
    customerIds: string[];
    dateFrom: string;
    dateTo: string;
    absoluteDeadlineAt: string;
  }): Promise<GoogleAdsReadonlySyncPortResult> {
    const result = await this.rawSyncPort.sync(input);
    const summary = summarizeGoogleAdsReadonlyWriteTelemetry(
      result.writeTelemetry || [],
    );
    return {
      ...result,
      writeTelemetry: summary.writes,
    };
  }
}
