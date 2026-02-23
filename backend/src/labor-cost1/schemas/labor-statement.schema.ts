import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * LaborStatementPayment - Chi tiết thanh toán trong phiếu lương
 */
@Schema({ _id: false, timestamps: false })
export class LaborStatementPayment {
  @Prop({ type: Number, required: true })
  amount!: number;

  @Prop({ type: Date, required: true })
  paidAt!: Date;

  @Prop()
  method?: string; // 'cash' | 'bank_transfer' | 'e_wallet'

  @Prop()
  reference?: string; // Mã giao dịch

  @Prop()
  notes?: string;

  @Prop()
  createdBy?: string;

  @Prop({ type: [String], default: [] })
  documents?: string[]; // Đường dẫn file chứng từ
}

export const LaborStatementPaymentSchema = SchemaFactory.createForClass(LaborStatementPayment);

/**
 * LaborStatement - Phiếu thanh toán lương theo kỳ
 * 
 * MÔ HÌNH:
 * ========
 * Tương tự SupplierStatement và AgentStatement
 * 
 * FLOW:
 * -----
 * 1. Nhân viên làm việc → Tạo các phiên LaborCost1
 * 2. Cuối kỳ (7 ngày / 15 ngày) → Tạo LaborStatement
 * 3. LaborStatement tự động tính tổng cost từ các phiên chưa thanh toán
 * 4. Admin thêm payment vào statement
 * 5. Khi đủ tiền → Close statement, đánh dấu tất cả phiên là paid
 * 
 * CHO COMMITTED CASH:
 * -------------------
 * - Status = 'open': Tính vào committed cash (chưa thanh toán)
 * - Status = 'closed': Không tính (đã thanh toán)
 */
@Schema({ timestamps: true })
export class LaborStatement {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  employeeId!: Types.ObjectId; // Nhân viên

  @Prop({ type: Date, required: true })
  periodFrom!: Date; // Đầu kỳ

  @Prop({ type: Date, required: true })
  periodTo!: Date; // Cuối kỳ

  @Prop({ type: String, enum: ['draft', 'open', 'closed'], default: 'draft', index: true })
  status!: string;
  // - draft: Mới tạo, chưa confirm
  // - open: Đã confirm, chưa thanh toán hết
  // - closed: Đã thanh toán hết

  @Prop({ type: Number, default: 0 })
  openingBalance!: number; // Nợ lương kỳ trước (nếu có)

  @Prop({ type: Number, default: 0 })
  periodCost!: number; // Tổng chi phí lương trong kỳ

  @Prop({ type: Number, default: 0 })
  totalWorkHours!: number; // Tổng giờ làm việc

  @Prop({ type: Number, default: 0 })
  sessionCount!: number; // Số phiên làm việc

  // ====== KPI & BONUS BREAKDOWN (CFO Spec) ======
  @Prop({ type: Number })
  kpiPercent?: number; // % hoàn thành KPI (0-100), Director nhập

  @Prop({ type: Number, default: 0 })
  attendanceBonus!: number; // Thưởng chuyên cần (từ attendanceTiers)

  @Prop({ type: Number, default: 0 })
  kpiBonus!: number; // Thưởng KPI (từ kpiBonusTiers)

  @Prop({ type: Number, default: 0 })
  punctualityBonus!: number; // Thưởng đúng giờ (onTimeBonus - latePenalty)

  @Prop({ type: Number, default: 0 })
  onTimeDays!: number; // Số ngày đúng giờ

  @Prop({ type: Number, default: 0 })
  lateDays!: number; // Số ngày trễ

  @Prop({ type: String })
  kpiUpdatedBy?: string; // Ai nhập KPI

  @Prop({ type: Date })
  kpiUpdatedAt?: Date; // Thời điểm nhập KPI
  // ===============================================

  @Prop({ type: Number, default: 0 })
  bonus!: number; // Thưởng thêm (nếu có)

  @Prop({ type: Number, default: 0 })
  deduction!: number; // Khấu trừ (phạt, bảo hiểm, v.v.)

  @Prop({ type: Number, default: 0 })
  statementPaymentTotal!: number; // Tổng tiền đã trả

  @Prop({ type: Number, default: 0 })
  closingBalance!: number; // Số tiền còn nợ

  @Prop({ type: String })
  notes?: string;

  @Prop({ type: [LaborStatementPaymentSchema], default: [] })
  payments!: LaborStatementPayment[];

  @Prop({ type: [Types.ObjectId], default: [] })
  laborCostIds!: Types.ObjectId[]; // Danh sách các phiên làm việc trong statement

  @Prop({ type: Date })
  confirmedAt?: Date; // Thời điểm confirm (draft → open)

  @Prop({ type: String })
  confirmedBy?: string;

  @Prop({ type: Date })
  closedAt?: Date; // Thời điểm đóng (open → closed)

  @Prop({ type: String })
  closedBy?: string;

  // ====== PAYMENT SCHEDULING (CFO Spec v3.2) ======
  @Prop({ type: Date, index: true })
  dueDate?: Date; // Ngày đến hạn thanh toán (tự tính từ periodTo + paymentDays)
}

export type LaborStatementDocument = LaborStatement & Document;
export const LaborStatementSchema = SchemaFactory.createForClass(LaborStatement);

// Index để tránh tạo statement trùng cho cùng employee và period
LaborStatementSchema.index({ employeeId: 1, periodFrom: 1, periodTo: 1 }, { unique: true });
