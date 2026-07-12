import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CashflowSummarySnapshotDocument = CashflowSummarySnapshot & Document;

/**
 * CASHFLOW SUMMARY SNAPSHOT — Phase 3 Aggregate Store
 * =====================================================
 * Lưu các summary đã tính sẵn từ domain modules.
 * FinancialControlService đọc từ đây thay vì gọi trực tiếp cross-domain services.
 * FinanceEventListenerService refresh khi nhận events.
 *
 * Keyed by: domain + windowDays
 * e.g. domain='labor', windowDays=14
 */
@Schema({ collection: 'cashflow_summary_snapshots', timestamps: false })
export class CashflowSummarySnapshot {
  /**
   * Tên domain: 'labor' | 'ops' | 'agent' | 'debt' | 'supplier'
   * - labor: tổng hợp từ LaborStatementService.getCashflowSummary()
   * - ops: từ OtherCostService.getCashflowSummary()
   * - agent: từ AgentReceivableService.getCashflowSummary()
   * - debt: từ FinanceService.getDebtCashflowSummary()
   * - supplier: từ SupplierPayableService.getCashflowSummary() (inflow)
   */
  @Prop({ required: true })
  domain: string;

  /**
   * Số ngày cửa sổ (7, 14, 30). -1 = không phân biệt window (ví dụ supplier inflow).
   */
  @Prop({ required: true, default: -1 })
  windowDays: number;

  /**
   * Dữ liệu tổng hợp (JSON tự do, tương ứng với return type của getCashflowSummary).
   */
  @Prop({ type: Object, required: true })
  data: Record<string, unknown>;

  @Prop({ required: true, default: () => new Date() })
  updatedAt: Date;
}

export const CashflowSummarySnapshotSchema = SchemaFactory.createForClass(CashflowSummarySnapshot);

// Compound unique index — 1 document per domain+window
CashflowSummarySnapshotSchema.index({ domain: 1, windowDays: 1 }, { unique: true });
