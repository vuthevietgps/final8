import { Injectable } from "@nestjs/common";
import { GoogleAdsReadonlySyncService } from "../../../google-ads/google-ads-readonly-sync.service";
import {
  GoogleAdsReadonlySyncPort,
  GoogleAdsReadonlySyncPortResult,
} from "./google-ads-readonly-adapter.types";

@Injectable()
export class GoogleAdsReadonlySyncPortService implements GoogleAdsReadonlySyncPort {
  constructor(
    private readonly readonlySyncService: GoogleAdsReadonlySyncService,
  ) {}

  async sync(input: {
    customerIds: string[];
    dateFrom: string;
    dateTo: string;
    absoluteDeadlineAt: string;
  }): Promise<GoogleAdsReadonlySyncPortResult> {
    return this.readonlySyncService.syncWithTelemetry(input);
  }
}
