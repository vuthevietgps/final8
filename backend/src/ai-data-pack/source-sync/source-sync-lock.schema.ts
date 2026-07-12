import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type AiDataPackSourceSyncLockDocument =
  HydratedDocument<AiDataPackSourceSyncLock>;

@Schema({
  collection: "ai_data_pack_source_sync_locks",
  timestamps: true,
})
export class AiDataPackSourceSyncLock {
  @Prop({ required: true, trim: true })
  lockKey: string;

  @Prop({ required: true, trim: true })
  owner: string;

  @Prop({ required: true, trim: true })
  ownerToken: string;

  @Prop({ required: true, trim: true, index: true })
  exportJobId: string;

  @Prop({ required: true, enum: ["google_ads"], index: true })
  sourceKey: "google_ads";

  @Prop({ required: true, trim: true, index: true })
  scopeHash: string;

  @Prop({ required: true, trim: true })
  dateFrom: string;

  @Prop({ required: true, trim: true })
  dateTo: string;

  @Prop({ required: true, type: Date, index: true })
  expiresAt: Date;

  @Prop({ required: true, type: Date })
  acquiredAt: Date;

  @Prop({ type: Date })
  releasedAt?: Date;

  @Prop({ required: true, enum: ["active", "released"], index: true })
  status: "active" | "released";
}

export const AiDataPackSourceSyncLockSchema = SchemaFactory.createForClass(
  AiDataPackSourceSyncLock,
);

AiDataPackSourceSyncLockSchema.index(
  { lockKey: 1 },
  { unique: true, name: "uq_ai_data_pack_source_sync_lock_key" },
);
AiDataPackSourceSyncLockSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: "ttl_ai_data_pack_source_sync_lock_expiry" },
);
