import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AvailableFundSnapshotDocument = HydratedDocument<AvailableFundSnapshot>;

@Schema({ collection: 'available_fund_snapshots', timestamps: true })
export class AvailableFundSnapshot {
  @Prop({ type: Date, default: Date.now, index: true })
  capturedAt: Date;

  @Prop({ type: Number, default: 0 })
  available: number;

  @Prop({ type: Number, default: 0 })
  collectedRevenue: number;

  @Prop({ type: Number, default: 0 })
  loanAvailable: number;

  @Prop({ type: Number, default: 0 })
  actualSpent: number;

  @Prop({ type: Number, default: 0 })
  reservedPayroll: number;

  @Prop({ type: Number, default: 0 })
  reservedInterest: number;

  @Prop({ type: Number, default: 0 })
  reservedPayables: number;

  @Prop({ type: Number, default: 0 })
  reservedSuppliers: number;

  @Prop({ type: Number, default: 0 })
  reservedAgents: number;

  @Prop({ type: Number, default: 0 })
  reservedOther: number;

  @Prop({ type: String })
  note?: string;
}

export const AvailableFundSnapshotSchema = SchemaFactory.createForClass(AvailableFundSnapshot);

AvailableFundSnapshotSchema.index({ capturedAt: -1 });
