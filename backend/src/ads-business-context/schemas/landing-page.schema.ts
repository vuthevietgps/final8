import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LandingPageApprovalStatus = 'pending' | 'approved' | 'rejected';
export type LandingPageDocument = HydratedDocument<LandingPage>;

@Schema({ collection: 'landing_pages', timestamps: true })
export class LandingPage {
  @Prop({ required: true, trim: true, unique: true, index: true })
  url: string;

  @Prop({ required: true, trim: true, lowercase: true, index: true })
  domain: string;

  @Prop({ trim: true })
  title?: string;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId: Types.ObjectId;

  @Prop({ trim: true })
  mainCta?: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: Date })
  lastCheckedAt?: Date;

  @Prop({ required: true, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true })
  approvalStatus: LandingPageApprovalStatus;

  // Compatibility fields consumed by GoogleAdsExportService.
  @Prop({ required: true, enum: ['pending', 'approved', 'rejected'], default: 'pending' })
  status: LandingPageApprovalStatus;

  @Prop({ type: Boolean, default: false, index: true })
  approvedForAds: boolean;

  @Prop({ trim: true })
  createdByUserId?: string;

  @Prop({ trim: true })
  createdBy?: string;

  @Prop({ trim: true })
  updatedByUserId?: string;

  @Prop({ trim: true })
  updatedBy?: string;

  @Prop({ trim: true })
  approvedByUserId?: string;

  @Prop({ trim: true })
  approvedBy?: string;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({ trim: true })
  rejectedByUserId?: string;

  @Prop({ trim: true })
  rejectedBy?: string;

  @Prop({ type: Date })
  rejectedAt?: Date;

  @Prop({ trim: true })
  rejectionReason?: string;

  @Prop({ type: Date })
  approvalResetAt?: Date;

  @Prop({ type: [Object], default: [] })
  approvalHistory: Array<{
    decision: 'approved' | 'rejected' | 'reset_to_pending';
    actorId?: string;
    actorLabel?: string;
    at: Date;
    reason?: string;
  }>;
}

export const LandingPageSchema = SchemaFactory.createForClass(LandingPage);
LandingPageSchema.index({ approvalStatus: 1, updatedAt: -1 });
LandingPageSchema.index({ productId: 1, approvalStatus: 1 });
