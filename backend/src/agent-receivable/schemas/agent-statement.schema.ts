import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * AgentStatement Schema
 * 
 * TERMINOLOGY CLARIFICATION:
 * ==========================
 * Tên collection "agent-receivable" nhưng thực tế là:
 * ✅ ĐÚNG: User NỢ agent (user phải TRẢ agent commission)
 * 
 * MÔ HÌNH:
 * --------
 * 1. Agent tạo đơn hàng cho user
 * 2. User nhận tiền từ supplier (sau khi supplier reconcile)
 * 3. User PHẢI TRẢ agent commission
 * 
 * VÍ DỤ:
 * ------
 * Agent tạo order, netProfit = 300,000 đ
 * Agent commission = 50,000 đ (từ netProfit)
 * 
 * - periodReceivables: 50,000 đ (user nợ agent)
 * - statementPaymentTotal: 0 đ (user chưa trả)
 * - closingBalance: 50,000 đ (user còn nợ)
 * 
 * FLOW THANH TOÁN:
 * ----------------
 * Day 10: Supplier trả user 300,000 đ
 * Day 11: User trả agent 50,000 đ
 * Day 12: User phân bổ 250,000 đ còn lại vào quỹ
 * 
 * ĐỀ XUẤT TÊN CHÍNH XÁC HƠN:
 * "AgentPayable" (user phải trả agent)
 * (Nhưng giữ tên cũ để tránh breaking change)
 */

@Schema({ _id: false, timestamps: false })
export class AgentStatementPayment {
  @Prop({ type: Number, required: true })
  amount!: number;

  @Prop({ type: Date, required: true })
  paidAt!: Date;

  @Prop()
  method?: string;

  @Prop()
  reference?: string;

  @Prop()
  notes?: string;

  @Prop()
  createdBy?: string;

  @Prop({ type: [String], default: [] })
  documents?: string[];
}

export const AgentStatementPaymentSchema = SchemaFactory.createForClass(AgentStatementPayment);

@Schema({ timestamps: true })
export class AgentStatement {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  agentId!: Types.ObjectId;  // Agent mà user NỢ tiền

  @Prop({ type: Date, required: true })
  periodFrom!: Date;  // Đầu kỳ sao kê

  @Prop({ type: Date, required: true })
  periodTo!: Date;  // Cuối kỳ sao kê

  @Prop({ type: String, enum: ['open', 'closed'], default: 'open', index: true })
  status!: string;  // open = chưa thanh toán xong, closed = đã thanh toán

  @Prop({ type: Number, default: 0 })
  openingBalance!: number;  // Số nợ đầu kỳ

  @Prop({ type: Number, default: 0 })
  periodReceivables!: number;  // Commission phát sinh trong kỳ (user nợ agent)

  @Prop({ type: Number, default: 0 })
  periodCollected!: number;  // Tiền agent thu được từ khách (tham khảo)

  @Prop({ type: Number, default: 0 })
  statementPaymentTotal!: number;  // Tổng tiền user đã TRẢ agent

  @Prop({ type: Number, default: 0 })
  closingBalance!: number;  // Số nợ cuối kỳ (user còn nợ agent)

  @Prop({ type: Number, default: 0 })
  netAfterDelivery!: number;

  @Prop({ type: String })
  notes?: string;

  @Prop({ type: [AgentStatementPaymentSchema], default: [] })
  payments!: AgentStatementPayment[];
}

export type AgentStatementDocument = AgentStatement & Document;
export const AgentStatementSchema = SchemaFactory.createForClass(AgentStatement);
AgentStatementSchema.index({ agentId: 1, periodFrom: 1, periodTo: 1 }, { unique: true });
