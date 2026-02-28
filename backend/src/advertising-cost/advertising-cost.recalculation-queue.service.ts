import { Injectable, Inject, Logger, OnModuleDestroy, forwardRef } from '@nestjs/common';
import { TestOrder2Service } from '../test-order2/test-order2.service';

@Injectable()
export class AdvertisingCostRecalculationQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(AdvertisingCostRecalculationQueueService.name);
  private readonly pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly pendingReasons = new Map<string, Set<string>>();
  private readonly debounceMs: number;

  constructor(
    @Inject(forwardRef(() => TestOrder2Service))
    private readonly testOrder2Service: TestOrder2Service,
  ) {
    const configured = Number(process.env.ADS_RECALCULATE_DEBOUNCE_MS || 20 * 60 * 1000);
    this.debounceMs = Number.isFinite(configured) && configured > 0 ? configured : 20 * 60 * 1000;
  }

  private normalizeDay(dayISO: string): string | null {
    const date = new Date(dayISO);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
      .toISOString()
      .slice(0, 10);
  }

  scheduleRecalculation(dayISO: string, reason: string): void {
    const normalizedDay = this.normalizeDay(dayISO);
    if (!normalizedDay) {
      this.logger.warn(`Skip scheduling recalc due to invalid day: ${dayISO}`);
      return;
    }

    const oldTimer = this.pendingTimers.get(normalizedDay);
    if (oldTimer) {
      clearTimeout(oldTimer);
    }

    const reasons = this.pendingReasons.get(normalizedDay) || new Set<string>();
    reasons.add(reason);
    this.pendingReasons.set(normalizedDay, reasons);

    const timer = setTimeout(() => {
      void this.flush(normalizedDay);
    }, this.debounceMs);
    this.pendingTimers.set(normalizedDay, timer);

    this.logger.log(
      `Scheduled order recalculation for ${normalizedDay} in ${Math.round(this.debounceMs / 1000)}s (source: ${reason}).`,
    );
  }

  private async flush(dayISO: string): Promise<void> {
    const timer = this.pendingTimers.get(dayISO);
    if (timer) {
      clearTimeout(timer);
    }
    this.pendingTimers.delete(dayISO);

    const reasons = Array.from(this.pendingReasons.get(dayISO) || []);
    this.pendingReasons.delete(dayISO);

    try {
      const res = await this.testOrder2Service.recalculateOrdersForDate(dayISO);
      this.logger.log(
        `Recalculated orders for ${dayISO}: ${res.updated} updated (queued from: ${reasons.join(', ') || 'unknown'}).`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed queued order recalculation for ${dayISO} (sources: ${reasons.join(', ') || 'unknown'})`,
        error,
      );
    }
  }

  onModuleDestroy(): void {
    for (const timer of this.pendingTimers.values()) {
      clearTimeout(timer);
    }
    this.pendingTimers.clear();
    this.pendingReasons.clear();
  }
}
