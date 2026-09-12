import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongoSchema } from 'mongoose';

export const AD_GROUP_REVIEW_DECISIONS = [
  'observe',
  'keep_budget',
  'propose_increase',
  'propose_decrease',
  'pause_candidate',
] as const;
export type AdGroupReviewDecision = (typeof AD_GROUP_REVIEW_DECISIONS)[number];

@Schema({ timestamps: true, collection: 'adgroupmanagementreviews' })
export class AdGroupManagementReview {
  @Prop({ required: true, unique: true, immutable: true }) requestKey!: string;
  @Prop({ required: true, immutable: true }) requestHash!: string;
  @Prop({ required: true, index: true, immutable: true }) adGroupId!: string;
  @Prop({ required: true, immutable: true }) periodFrom!: string;
  @Prop({ required: true, immutable: true }) periodTo!: string;
  @Prop({ required: true, enum: AD_GROUP_REVIEW_DECISIONS, immutable: true })
  decision!: AdGroupReviewDecision;
  @Prop({ required: true, immutable: true }) rationale!: string;
  @Prop({ required: true, immutable: true }) evidence!: string;
  @Prop({ type: MongoSchema.Types.Mixed, required: true, immutable: true }) metricsSnapshot!: any;
  @Prop({ required: true, immutable: true }) createdBy!: string;
}
export type AdGroupManagementReviewDocument = HydratedDocument<AdGroupManagementReview>;
export const AdGroupManagementReviewSchema = SchemaFactory.createForClass(AdGroupManagementReview);
AdGroupManagementReviewSchema.index({ adGroupId: 1, createdAt: -1 });

