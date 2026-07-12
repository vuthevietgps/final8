import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MarketingLeadDocument = HydratedDocument<MarketingLead>;

export const MARKETING_LEAD_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'quoted',
  'won',
  'lost',
  'no_response',
  'not_qualified',
] as const;

export type MarketingLeadStatus = (typeof MARKETING_LEAD_STATUSES)[number];

@Schema({ collection: 'marketing_leads', timestamps: true })
export class MarketingLead {
  @Prop({ trim: true, index: true })
  sourceLeadKey?: string;

  @Prop({ type: String, required: true, enum: ['facebook', 'google', 'tiktok', 'zalo', 'other'], index: true })
  sourcePlatform: 'facebook' | 'google' | 'tiktok' | 'zalo' | 'other';

  @Prop({ type: Date, default: Date.now, index: true })
  leadCreatedAt: Date;

  @Prop({ trim: true, index: true })
  fanpageId?: string;

  @Prop({ trim: true, index: true })
  adAccountId?: string;

  @Prop({ trim: true, index: true })
  campaignId?: string;

  @Prop({ trim: true, index: true })
  adSetId?: string;

  @Prop({ trim: true, index: true })
  adId?: string;

  @Prop({ trim: true, index: true })
  adGroupId?: string;

  @Prop({ trim: true, index: true })
  creativeId?: string;

  @Prop({ type: Types.ObjectId, ref: 'Customer', index: true })
  customerId?: Types.ObjectId;

  @Prop({ trim: true, index: true })
  customerName?: string;

  @Prop({ trim: true, index: true })
  phone?: string;

  @Prop({ trim: true, index: true })
  conversationId?: string;

  @Prop({ trim: true, index: true })
  senderPsid?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  assignedSaleId?: Types.ObjectId;

  @Prop({ type: String, enum: MARKETING_LEAD_STATUSES, default: 'new', index: true })
  status: MarketingLeadStatus;

  @Prop({ type: Date })
  firstResponseAt?: Date;

  @Prop({ type: Date })
  lastFollowUpAt?: Date;

  @Prop({ type: Number, min: 0 })
  responseSlaSeconds?: number;

  @Prop({ trim: true })
  qualificationReason?: string;

  @Prop({ trim: true })
  lostReason?: string;

  @Prop({ type: Types.ObjectId, ref: 'TestOrder2', index: true })
  orderId?: Types.ObjectId;

  @Prop({ type: Number, default: 0 })
  revenue?: number;

  @Prop({ type: Number, default: 0 })
  grossProfit?: number;

  @Prop({ type: Number, default: 0 })
  netProfit?: number;

  @Prop({ type: Object })
  raw?: Record<string, any>;
}

export const MarketingLeadSchema = SchemaFactory.createForClass(MarketingLead);

MarketingLeadSchema.index({ adGroupId: 1, leadCreatedAt: -1 });
MarketingLeadSchema.index({ assignedSaleId: 1, status: 1, leadCreatedAt: -1 });
MarketingLeadSchema.index({ sourcePlatform: 1, campaignId: 1, adSetId: 1, adId: 1 });
MarketingLeadSchema.index(
  { sourceLeadKey: 1 },
  {
    unique: true,
    name: 'uniq_source_lead_key',
    partialFilterExpression: { sourceLeadKey: { $type: 'string' } },
  },
);
MarketingLeadSchema.index(
  { sourcePlatform: 1, conversationId: 1, adGroupId: 1 },
  { name: 'idx_source_conversation_adgroup' },
);
