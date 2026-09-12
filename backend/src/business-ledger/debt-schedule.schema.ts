import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/** Append-only revisions. The direction prevents a refund/overpayment inheriting a sales deadline. */
@Schema({ collection: 'businessledgerdebtschedules', timestamps: true })
export class DebtScheduleRevision {
  @Prop({ required: true }) partyKey!: string;
  @Prop({ required: true }) orderId!: string;
  @Prop({ required: true, enum: ['receivable', 'payable'] }) direction!: string;
  @Prop({ required: true }) revision!: number;
  @Prop({ type: String, default: null }) dueDate!: string | null;
  @Prop({ type: String, default: null }) promisedDate!: string | null;
  @Prop({ required: true }) evidence!: string;
  @Prop({ required: true }) reason!: string;
  @Prop({ required: true }) createdBy!: string;
  @Prop({ required: true }) recordedAt!: Date;
  @Prop({ required: true }) balanceAtRevision!: number;
  @Prop({ required: true }) sourceHash!: string;
  @Prop({ required: true }) requestKey!: string;
  @Prop({ required: true }) requestHash!: string;
}
export const DebtScheduleRevisionSchema = SchemaFactory.createForClass(DebtScheduleRevision);
DebtScheduleRevisionSchema.index({ partyKey: 1, orderId: 1, direction: 1, revision: 1 }, { unique: true });
DebtScheduleRevisionSchema.index({ requestKey: 1 }, { unique: true });
