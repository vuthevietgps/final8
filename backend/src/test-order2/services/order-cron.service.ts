import { Injectable, Logger } from '@nestjs/common';
import { OrderCalculationService } from './order-calculation.service';

@Injectable()
export class OrderCronService {
  private readonly logger = new Logger(OrderCronService.name);

  constructor(private readonly calculationService: OrderCalculationService) {}

  /**
   * Manual fallback only.
   * Nightly recalculation is orchestrated centrally by DataCollectionService.
   */
  async recalculateYesterdayCosts(): Promise<void> {
    this.logger.log('🚀 Bắt đầu tiến trình phân bổ chi phí ngầm (Nightly Cost Allocation)...');
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const result = await this.calculationService.recalculateOrdersForDate(yesterday);

      this.logger.log(
        `✅ Hoàn tất phân bổ chi phí cho ${result.updated} đơn hàng ngày ${result.date}.`,
      );
    } catch (error) {
      this.logger.error('❌ Lỗi tiến trình phân bổ chi phí ngầm:', error);
    }
  }
}
