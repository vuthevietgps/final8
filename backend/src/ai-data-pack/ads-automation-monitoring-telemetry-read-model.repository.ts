import { Injectable } from '@nestjs/common';
import type {
  AdsAutomationMonitoringTelemetryRecordInput,
} from './contracts/ads-automation-monitoring-telemetry-read-model.contract';

@Injectable()
export class AdsAutomationMonitoringTelemetryReadModelRepository {
  private records: AdsAutomationMonitoringTelemetryRecordInput[] = [];

  replaceAll(records: AdsAutomationMonitoringTelemetryRecordInput[]): AdsAutomationMonitoringTelemetryRecordInput[] {
    this.records = this.cloneJson(Array.isArray(records) ? records : []);
    return this.list();
  }

  append(records: AdsAutomationMonitoringTelemetryRecordInput[]): AdsAutomationMonitoringTelemetryRecordInput[] {
    this.records = [
      ...this.records,
      ...this.cloneJson(Array.isArray(records) ? records : []),
    ];
    return this.list();
  }

  list(): AdsAutomationMonitoringTelemetryRecordInput[] {
    return this.cloneJson(this.records);
  }

  clear(): void {
    this.records = [];
  }

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
