import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false, timestamps: false })
export class StatementPayment {
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

export const StatementPaymentSchema = SchemaFactory.createForClass(StatementPayment);

@Schema({ timestamps: true })
export class SupplierStatement {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  supplierId!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  periodFrom!: Date;

  @Prop({ type: Date, required: true })
  periodTo!: Date;

  @Prop({ type: String, enum: ['open', 'closed'], default: 'open', index: true })
  status!: string;

  @Prop({ type: Number, default: 0 })
  openingBalance!: number;

  @Prop({ type: Number, default: 0 })
  periodPayables!: number;

  @Prop({ type: Number, default: 0 })
  periodPayments!: number; // payments thuộc payables (nếu có)

  @Prop({ type: Number, default: 0 })
  periodCodCollected!: number;

  @Prop({ type: Number, default: 0 })
  statementPaymentTotal!: number; // payments nhập theo kỳ

  @Prop({ type: Number, default: 0 })
  closingBalance!: number;

  @Prop({ type: Number, default: 0 })
  netAfterCod!: number; // COD thu hộ - closingBalance

  @Prop({ type: String })
  notes?: string;

  @Prop({ type: [StatementPaymentSchema], default: [] })
  payments!: StatementPayment[];
}

export type SupplierStatementDocument = SupplierStatement & Document;
export const SupplierStatementSchema = SchemaFactory.createForClass(SupplierStatement);
SupplierStatementSchema.index({ supplierId: 1, periodFrom: 1, periodTo: 1 }, { unique: true });