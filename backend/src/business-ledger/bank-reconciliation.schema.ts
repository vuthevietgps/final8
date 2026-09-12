import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongoSchema } from 'mongoose';

@Schema({ timestamps: true, collection: 'businessledgerbankstatements' })
export class BankStatement {
  @Prop({ required: true, unique: true, immutable: true }) requestKey!: string;
  @Prop({ required: true, immutable: true }) requestHash!: string;
  @Prop({ required: true, index: true, immutable: true }) accountId!: string;
  @Prop({ required: true, immutable: true }) statementKey!: string;
  @Prop({ required: true, immutable: true }) from!: string;
  @Prop({ required: true, immutable: true }) to!: string;
  @Prop({ required: true, immutable: true }) openingBalance!: number;
  @Prop({ required: true, immutable: true }) closingBalance!: number;
  @Prop({ required: true, immutable: true }) bankMovement!: number;
  @Prop({ required: true, immutable: true }) lineCount!: number;
  @Prop({ required: true, enum: ['VND'], default: 'VND', immutable: true }) currency!: 'VND';
  @Prop({ required: true, immutable: true }) evidence!: string;
  @Prop({ required: true, immutable: true }) createdBy!: string;
}
export type BankStatementDocument = HydratedDocument<BankStatement>;
export const BankStatementSchema = SchemaFactory.createForClass(BankStatement);
BankStatementSchema.index({ accountId: 1, statementKey: 1 }, { unique: true });
BankStatementSchema.index({ accountId: 1, from: 1, to: 1 });

@Schema({ timestamps: true, collection: 'businessledgerbankstatementlines' })
export class BankStatementLine {
  @Prop({ required: true, index: true, immutable: true }) statementId!: string;
  @Prop({ required: true, index: true, immutable: true }) accountId!: string;
  @Prop({ required: true, immutable: true }) externalId!: string;
  @Prop({ required: true, immutable: true }) occurredAt!: Date;
  /** Positive means money into the company account; negative means money out. */
  @Prop({ required: true, immutable: true }) amount!: number;
  @Prop({ immutable: true }) reference?: string;
  @Prop({ required: true, immutable: true }) description!: string;
  @Prop({ required: true, enum: ['unmatched', 'matched'], default: 'unmatched', index: true })
  status!: 'unmatched' | 'matched';
  @Prop() matchedEntryId?: string;
  @Prop() matchedBy?: string;
  @Prop() matchedAt?: Date;
  @Prop() matchEvidence?: string;
  @Prop({ type: [MongoSchema.Types.Mixed], default: [] }) matchHistory!: any[];
}
export type BankStatementLineDocument = HydratedDocument<BankStatementLine>;
export const BankStatementLineSchema = SchemaFactory.createForClass(BankStatementLine);
BankStatementLineSchema.index({ accountId: 1, externalId: 1 }, { unique: true });
BankStatementLineSchema.index(
  { accountId: 1, matchedEntryId: 1 },
  {
    unique: true,
    partialFilterExpression: { matchedEntryId: { $type: 'string' }, status: 'matched' },
  },
);

