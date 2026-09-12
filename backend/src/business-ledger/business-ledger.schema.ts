import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongoSchema } from "mongoose";
import {
  Effects,
  ENTRY_KINDS,
  OrderContext,
  Posting,
} from "./business-ledger.rules";

@Schema({ timestamps: true, collection: "businessledgeraccounts" })
export class LedgerAccount {
  @Prop({ required: true, unique: true }) code!: string;
  @Prop({ required: true }) name!: string;
  @Prop({ required: true }) openingBalance!: number;
  @Prop({ required: true }) openingAt!: Date;
  @Prop({ required: true }) evidence!: string;
  @Prop({ required: true }) createdBy!: string;
}
export type LedgerAccountDocument = HydratedDocument<LedgerAccount>;
export const LedgerAccountSchema = SchemaFactory.createForClass(LedgerAccount);

@Schema({ timestamps: true, collection: "businessledgerprofiles" })
export class LedgerOrderProfile {
  @Prop({ required: true, unique: true }) orderId!: string;
  @Prop({ type: MongoSchema.Types.Mixed, required: true })
  context!: OrderContext;
  @Prop({ required: true }) productName!: string;
  @Prop({ required: true }) evidence!: string;
  @Prop({ required: true }) createdBy!: string;
}
export const LedgerOrderProfileSchema =
  SchemaFactory.createForClass(LedgerOrderProfile);

@Schema({ timestamps: true, collection: "businessledgerentries" })
export class LedgerEntry {
  @Prop({ index: true }) settlementId?: string;
  @Prop({ required: true, unique: true }) idempotencyKey!: string;
  @Prop({ required: true }) requestHash!: string;
  @Prop({ type: String, required: true, enum: ENTRY_KINDS })
  kind!: Posting["kind"];
  @Prop({ required: true }) amount!: number;
  @Prop({
    type: String,
    enum: ["draft", "confirmed", "rejected"],
    default: "draft",
  })
  status!: string;
  @Prop({ required: true }) occurredAt!: Date;
  @Prop({ required: true }) evidence!: string;
  @Prop({ required: true }) description!: string;
  @Prop({ type: MongoSchema.Types.Mixed, required: true }) posting!: Posting;
  @Prop({ type: MongoSchema.Types.Mixed, required: true }) effects!: Effects;
  @Prop({ index: true }) orderId?: string;
  @Prop({ type: MongoSchema.Types.Mixed }) context?: OrderContext;
  @Prop() productName?: string;
  @Prop() reversalOf?: string;
  @Prop({ required: true }) createdBy!: string;
  @Prop() confirmedBy?: string;
  @Prop() confirmedAt?: Date;
  @Prop() rejectedBy?: string;
  @Prop() rejectedAt?: Date;
  @Prop() rejectionReason?: string;
}
export type LedgerEntryDocument = HydratedDocument<LedgerEntry>;
export const LedgerEntrySchema = SchemaFactory.createForClass(LedgerEntry);
LedgerEntrySchema.index({ status: 1, occurredAt: 1 });
LedgerEntrySchema.index({ orderId: 1, status: 1 });
LedgerEntrySchema.index(
  { reversalOf: 1 },
  {
    unique: true,
    partialFilterExpression: {
      reversalOf: { $type: "string" },
      status: "confirmed",
    },
  },
);
