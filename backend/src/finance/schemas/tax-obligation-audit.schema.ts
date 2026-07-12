import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TaxObligationAuditDocument = TaxObligationAudit & Document;

@Schema({ collection: 'tax_obligation_audit', timestamps: false, strict: 'throw' })
export class TaxObligationAudit {
  @Prop({ type: Object, default: null, immutable: true })
  previousSnapshot!: Record<string, unknown> | null;

  @Prop({ type: Object, required: true, immutable: true })
  snapshot!: Record<string, unknown>;

  @Prop({ required: true, trim: true, immutable: true })
  actor!: string;

  @Prop({ required: true, immutable: true })
  recordedAt!: Date;
}

export const TaxObligationAuditSchema = SchemaFactory.createForClass(TaxObligationAudit);
TaxObligationAuditSchema.index({ recordedAt: -1 });
TaxObligationAuditSchema.index({ actor: 1, recordedAt: -1 });

const rejectMutation = function (next: (error?: Error) => void) {
  next(new Error('Tax obligation audit records are immutable'));
};
TaxObligationAuditSchema.pre('updateOne', rejectMutation);
TaxObligationAuditSchema.pre('updateMany', rejectMutation);
TaxObligationAuditSchema.pre('findOneAndUpdate', rejectMutation);
TaxObligationAuditSchema.pre('deleteOne', rejectMutation);
TaxObligationAuditSchema.pre('deleteMany', rejectMutation);
TaxObligationAuditSchema.pre('findOneAndDelete', rejectMutation);
