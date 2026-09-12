import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

const externalId = { type: String, required: true, trim: true, maxlength: 200, immutable: true };
const money = {
  type: Number, min: 0, max: 9999999999999,
  validate: { validator: (value: number) => value == null || Number.isSafeInteger(value), message: 'Amount must be whole VND' },
};
const sourceRef = { type: MongooseSchema.Types.ObjectId, ref: 'TrackingSource', required: true, immutable: true };

/** One source identifies one stable collector/database namespace, not a mutable domain. */
@Schema({ collection: 'tracking_crm_sources', timestamps: true, optimisticConcurrency: true, strict: 'throw' })
export class TrackingSource {
  @Prop(externalId) sourceKey: string;
  @Prop({ type: String, required: true, trim: true, maxlength: 200 }) name: string;
  @Prop({ type: String, enum: ['ladifinal'], default: 'ladifinal' }) kind: string;
  @Prop({ type: Boolean, default: false }) enabled: boolean;
  @Prop({ type: [String], default: [], validate: {
    validator: (values: string[]) => values.length <= 100 && values.every(value => {
      try { const url = new URL(value); return url.protocol === 'https:' && url.origin === value; } catch { return false; }
    }), message: 'Allowed origins must be exact HTTPS origins',
  } }) allowedOrigins: string[];
  // Reference only; the future authenticated connector owns encrypted credentials.
  @Prop({ type: MongooseSchema.Types.ObjectId }) credentialRef?: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true }) createdBy: Types.ObjectId;
}
export const TrackingSourceSchema = SchemaFactory.createForClass(TrackingSource);
TrackingSourceSchema.index({ sourceKey: 1 }, { unique: true, name: 'tracking_source_key_unique' });
export type TrackingSourceDocument = HydratedDocument<TrackingSource>;

/** Raw, unverified URL attribution. Never treat these values as ERP-approved Ads IDs. */
@Schema({ _id: false, strict: 'throw' })
export class TrackingAdsEvidence {
  @Prop({ type: String, enum: ['google', 'facebook', 'tiktok', 'unknown'], default: 'unknown' }) provider: string;
  @Prop({ type: String, enum: ['gclid', 'wbraid', 'gbraid', 'fbclid', 'ttclid', 'utm'] }) clickIdType?: string;
  @Prop({ type: String, maxlength: 512 }) clickId?: string;
  @Prop({ type: String, maxlength: 200 }) accountId?: string;
  @Prop({ type: String, maxlength: 255 }) campaignId?: string;
  @Prop({ type: String, maxlength: 200 }) adGroupId?: string;
  @Prop({ type: String, maxlength: 500 }) keyword?: string;
  @Prop({ type: String, maxlength: 200 }) utmSource?: string;
  @Prop({ type: String, maxlength: 200 }) utmMedium?: string;
  @Prop({ type: String, maxlength: 255 }) utmCampaign?: string;
  @Prop({ type: String, maxlength: 500 }) utmContent?: string;
  @Prop({ type: String, maxlength: 50 }) network?: string;
  @Prop({ type: String, maxlength: 50 }) device?: string;
  @Prop({ type: String, maxlength: 50 }) matchType?: string;
}
export const TrackingAdsEvidenceSchema = SchemaFactory.createForClass(TrackingAdsEvidence);

@Schema({ collection: 'tracking_crm_visits', timestamps: true, optimisticConcurrency: true, strict: 'throw' })
export class TrackingVisit {
  @Prop({ type: String, enum: ['collector_reported', 'unknown'], default: 'unknown', immutable: true }) ipEvidenceTrust: string;
  @Prop({ type: Date }) engagementObservedAt?: Date;
  @Prop({ type: {
    pageViews: { type: Number, min: 0 }, engagedSeconds: { type: Number, min: 0 },
    maxScroll: { type: Number, min: 0, max: 100 }, contactActions: { type: Number, min: 0 },
    formSubmits: { type: Number, min: 0 },
  }, _id: false }) engagement?: { pageViews: number; engagedSeconds: number; maxScroll: number; contactActions: number; formSubmits: number };
  @Prop(sourceRef) sourceId: Types.ObjectId;
  @Prop(externalId) externalVisitId: string;
  @Prop({ type: Date, required: true, immutable: true }) occurredAt: Date;
  @Prop({ type: Date, default: Date.now, immutable: true }) receivedAt: Date;
  @Prop({ type: String, required: true, maxlength: 255, immutable: true }) landingHost: string;
  @Prop({ type: String, required: true, maxlength: 500, immutable: true }) landingPath: string;
  @Prop({ type: String, maxlength: 200, immutable: true }) landingName?: string;
  @Prop({ type: TrackingAdsEvidenceSchema, default: () => ({}), immutable: true }) ads: TrackingAdsEvidence;
  // IP is evidence only, never a customer identifier. Excluded from normal reads.
  @Prop({ type: String, maxlength: 45, select: false, immutable: true }) ipAddress?: string;
  @Prop({ type: String, maxlength: 8, immutable: true }) country?: string;
}
export const TrackingVisitSchema = SchemaFactory.createForClass(TrackingVisit);
TrackingVisitSchema.index({ sourceId: 1, externalVisitId: 1 }, { unique: true, name: 'tracking_visit_source_unique' });
TrackingVisitSchema.index({ sourceId: 1, occurredAt: -1 });
TrackingVisitSchema.index({ occurredAt: -1, _id: -1 });
TrackingVisitSchema.index({ ipAddress: 1, occurredAt: -1 });
TrackingVisitSchema.index({ 'ads.provider': 1, occurredAt: -1 });
TrackingVisitSchema.index({ 'ads.adGroupId': 1, occurredAt: -1 });
TrackingVisitSchema.index({ 'ads.provider': 1, 'ads.accountId': 1, 'ads.adGroupId': 1, occurredAt: -1 });
export type TrackingVisitDocument = HydratedDocument<TrackingVisit>;

@Schema({ collection: 'tracking_crm_events', timestamps: true, strict: 'throw' })
export class TrackingEvent {
  @Prop(sourceRef) sourceId: Types.ObjectId;
  @Prop(externalId) externalEventId: string;
  @Prop(externalId) externalVisitId: string;
  @Prop({ type: String, required: true, immutable: true,
    enum: ['page_view', 'phone', 'zalo', 'inbox', 'contact', 'form_submit', 'heartbeat', 'scroll'] }) eventType: string;
  @Prop({ type: Date, required: true, immutable: true }) occurredAt: Date;
  @Prop({ type: Date, default: Date.now, immutable: true }) receivedAt: Date;
  @Prop({ type: Number, min: 0, max: 86400, immutable: true,
    validate: { validator: Number.isSafeInteger, message: 'Event value must be an integer' } }) value?: number;
}
export const TrackingEventSchema = SchemaFactory.createForClass(TrackingEvent);
TrackingEventSchema.index({ sourceId: 1, externalEventId: 1 }, { unique: true, name: 'tracking_event_source_unique' });
TrackingEventSchema.index({ sourceId: 1, externalVisitId: 1, occurredAt: 1 });
export type TrackingEventDocument = HydratedDocument<TrackingEvent>;

/** One working CRM profile per visit in MVP; a contact signal does not create an order. */
@Schema({ collection: 'tracking_crm_leads', timestamps: true, optimisticConcurrency: true, strict: 'throw' })
export class TrackingLead {
  @Prop({ type: Date }) contactedAt?: Date;
  @Prop({ type: String, enum: ['phone', 'zalo', 'inbox', 'form_submit', 'contact'] }) contactChannel?: string;
  @Prop({ type: Date }) nextFollowUpAt?: Date;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'TrackingEvent' }) matchedEventId?: Types.ObjectId;
  @Prop({ type: String, enum: ['unknown', 'approximate', 'verified'], default: 'unknown' }) matchConfidence?: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' }) agentId?: Types.ObjectId;
  @Prop({ type: String, maxlength: 200 }) agentNameSnapshot?: string;
  @Prop({ type: String, enum: ['internal_agent', 'external_agent'] }) agentRoleSnapshot?: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' }) supplierId?: Types.ObjectId;
  @Prop({ type: String, maxlength: 200 }) adSelectionKey?: string;
  @Prop({ type: String, enum: ['google', 'facebook', 'tiktok'] }) adsProvider?: string;
  @Prop({ type: String, maxlength: 200 }) adAccountProviderId?: string;
  @Prop({ type: String, maxlength: 200 }) adCampaignId?: string;
  @Prop({ type: String, maxlength: 200 }) adGroupId?: string;
  @Prop({ type: String, maxlength: 500 }) adGroupNameSnapshot?: string;
  @Prop({ type: Date }) orderDate?: Date;
  @Prop({ type: String, select: false }) operationLock?: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'TrackingVisit', required: true, immutable: true }) visitId: Types.ObjectId;
  @Prop({ type: String, trim: true, maxlength: 200 }) customerName?: string;
  @Prop({ type: String, trim: true, maxlength: 200 }) recipientName?: string;
  @Prop({ type: String, trim: true, maxlength: 40 }) phone?: string;
  @Prop({ type: String, trim: true, maxlength: 1000 }) shippingAddress?: string;
  @Prop({ type: String, trim: true, maxlength: 2000 }) notes?: string;
  @Prop({ type: String, enum: ['noted', 'confirmed', 'cancelled'], default: 'noted' }) status: string;
  @Prop(money) saleTotal?: number;
  @Prop(money) deposit?: number;
  @Prop(money) codAmount?: number;
  // A staff estimate, not an ERP supplier price snapshot or recognized cost.
  @Prop(money) supplierCostNote?: number;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product' }) productId?: Types.ObjectId;
  @Prop({ type: Number, min: 1, validate: { validator: Number.isSafeInteger, message: 'Quantity must be an integer' } }) quantity?: number;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' }) assignedTo?: Types.ObjectId;
  @Prop({ type: String, enum: ['unverified', 'manual', 'form_identity'], default: 'unverified' }) matchMethod: string;
  @Prop({ type: String, trim: true, maxlength: 1000 }) matchEvidence?: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' }) matchedBy?: Types.ObjectId;
  @Prop({ type: Date }) matchedAt?: Date;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true }) createdBy: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true }) updatedBy: Types.ObjectId;
}
export const TrackingLeadSchema = SchemaFactory.createForClass(TrackingLead);
TrackingLeadSchema.index({ visitId: 1 }, { unique: true, name: 'tracking_lead_visit_unique' });
TrackingLeadSchema.index({ status: 1, updatedAt: -1 });
TrackingLeadSchema.index({ nextFollowUpAt: 1, status: 1 });
TrackingLeadSchema.index({ agentId: 1, adGroupId: 1, updatedAt: -1 });
TrackingLeadSchema.index({ assignedTo: 1, status: 1, updatedAt: -1 });
TrackingLeadSchema.pre('validate', function () {
  if (this.matchMethod !== 'unverified') {
    for (const field of ['matchedBy', 'matchedAt', 'matchEvidence']) {
      if (!this.get(field)) this.invalidate(field, 'Verified matching requires actor, time and evidence');
    }
  }
  if (this.status === 'confirmed' && this.matchMethod === 'unverified') {
    this.invalidate('status', 'Confirm the contact-to-visit match before confirming the lead');
  }
});
export type TrackingLeadDocument = HydratedDocument<TrackingLead>;

/** ERP-managed link, never accepted from a public landing payload. */
@Schema({ collection: 'tracking_crm_order_links', timestamps: true, optimisticConcurrency: true, strict: 'throw' })
export class TrackingOrderLink {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'TrackingLead', required: true, immutable: true }) leadId: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'TestOrder2', required: true, immutable: true }) orderId: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, immutable: true }) linkedBy: Types.ObjectId;
  @Prop({ type: Date, required: true, default: Date.now, immutable: true }) linkedAt: Date;
  @Prop({ type: Number, required: true, min: -1, validate: Number.isSafeInteger }) lastSyncedLeadVersion: number;
  @Prop({ type: Date }) lastSyncedAt?: Date;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' }) lastSyncedBy?: Types.ObjectId;
}
export const TrackingOrderLinkSchema = SchemaFactory.createForClass(TrackingOrderLink);
TrackingOrderLinkSchema.index({ leadId: 1 }, { unique: true, name: 'tracking_order_link_lead_unique' });
TrackingOrderLinkSchema.index({ orderId: 1 }, { unique: true, name: 'tracking_order_link_order_unique' });
export type TrackingOrderLinkDocument = HydratedDocument<TrackingOrderLink>;
