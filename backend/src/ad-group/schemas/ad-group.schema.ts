/**
 * File: ad-group/schemas/ad-group.schema.ts
 * Má»¥c Ä‘Ã­ch: Äá»‹nh nghÄ©a schema Mongoose cho NhÃ³m Quáº£ng CÃ¡o (tá»‘i giáº£n, khÃ´ng AI/khuyáº¿n máº¡i)
 * Chá»©c nÄƒng: Quáº£n lÃ½ nhÃ³m quáº£ng cÃ¡o, sáº£n pháº©m vÃ  auto-control
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AdGroupDocument = AdGroup & Document;

@Schema({ timestamps: true })
export class AdGroup {
  @Prop({ required: true, trim: true })
  name: string; // TÃªn nhÃ³m quáº£ng cÃ¡o

  @Prop({ required: true, trim: true, unique: true, index: true })
  adGroupId: string; // ID nhÃ³m quáº£ng cÃ¡o (nháº­p tay)

  // Tham chiáº¿u cÃ¡c entity chÃ­nh
  @Prop({ type: Types.ObjectId, ref: 'Fanpage', required: true, index: true })
  fanpageId: Types.ObjectId; // Tham chiáº¿u fanpage

  @Prop({ type: Types.ObjectId, ref: 'ProductCategory', index: true })
  productCategoryId?: Types.ObjectId; // Danh muc san pham (metadata tuy chon)

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Product' }],
    default: [],
    validate: {
      validator: (products?: Types.ObjectId[]) => !products || (Array.isArray(products) && products.length <= 1),
      message: 'Moi nhom quang cao chi duoc gan toi da 1 san pham',
    },
  })
  selectedProducts?: Types.ObjectId[]; // Metadata san pham tuy chon

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  agentId: Types.ObjectId; // Tham chiáº¿u Ä‘áº¡i lÃ½ (user role: agent)

  @Prop({ type: Types.ObjectId, ref: 'AdAccount', required: true, index: true })
  adAccountId: Types.ObjectId; // Tham chiáº¿u tÃ i khoáº£n quáº£ng cÃ¡o

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  assignedEmployeeId?: Types.ObjectId; // NhÃ¢n viÃªn phá»¥ trÃ¡ch nhÃ³m quáº£ng cÃ¡o nÃ y

  @Prop({ type: Date })
  lastOperatorActivityAt?: Date; // Moc thao tac ERP gan nhat cua nguoi phu trach ads

  // ThÃ´ng tin mÃ´ táº£ vÃ  ná»™i dung
  @Prop({ trim: true })
  description?: string; // MÃ´ táº£ nhÃ³m quáº£ng cÃ¡o

  // ThÃ´ng tin quáº£ng cÃ¡o
  @Prop({ required: true, enum: ['facebook', 'google', 'tiktok'], index: true })
  platform: 'facebook' | 'google' | 'tiktok'; // Ná»n táº£ng quáº£ng cÃ¡o

  @Prop({ default: true, index: true })
  isActive: boolean; // Tráº¡ng thÃ¡i hoáº¡t Ä‘á»™ng

  @Prop({ trim: true })
  notes?: string; // Ghi chÃº (khÃ´ng báº¯t buá»™c)

  // Webhook vÃ  AI processing
  @Prop({ default: false })
  enableWebhook?: boolean; // Báº­t webhook cho nhÃ³m nÃ y

  // Tá»± Ä‘á»™ng kiá»ƒm soÃ¡t chi tiÃªu/hiá»‡u quáº£
  @Prop({ default: false })
  autoControlEnabled?: boolean; // Báº­t theo dÃµi tá»± Ä‘á»™ng vÃ  táº¡m dá»«ng náº¿u vÆ°á»£t ngÆ°á»¡ng

  @Prop({ type: Number, min: 0 })
  spendThresholdDaily?: number; // NgÆ°á»¡ng chi tiÃªu/ngÃ y (VND). VÆ°á»£t sáº½ táº¡m dá»«ng

  @Prop({ type: Number, min: 0 })
  cprThresholdDaily?: number; // NgÆ°á»¡ng chi phÃ­ trÃªn má»—i há»™i thoáº¡i/ngÃ y (VND)

  @Prop({ type: Number, min: 0, default: 3 })
  minConversations?: number; // Sá»‘ há»™i thoáº¡i tá»‘i thiá»ƒu Ä‘á»ƒ tÃ­nh CPR (trÃ¡nh pause vÃ¬ máº«u quÃ¡ nhá»)

  @Prop({ type: Date })
  lastAutoControlAt?: Date; // Láº§n cuá»‘i há»‡ thá»‘ng tá»± Ä‘á»™ng can thiá»‡p

  @Prop({ trim: true })
  autoPausedReason?: string; // LÃ½ do tá»± dá»«ng gáº§n nháº¥t

  // Metadata Ä‘á»“ng bá»™ tá»« provider
  @Prop({ trim: true })
  remoteStatus?: string;

  @Prop({ trim: true })
  effectiveStatus?: string;

  @Prop({ type: Number })
  dailyBudget?: number;

  @Prop({ type: Number })
  bidAmount?: number;

  @Prop({ trim: true })
  campaignId?: string;

  @Prop({ trim: true })
  campaignBudgetId?: string;

  @Prop({ trim: true })
  campaignBudgetResourceName?: string;

  // Nháº­t kÃ½ Ä‘á»“ng bá»™
  @Prop() lastSyncAt?: Date;

  @Prop({ trim: true }) lastSyncStatus?: 'ok' | 'error';

  @Prop({ trim: true }) lastSyncError?: string;

  @Prop({ type: Number }) lastSyncDurationMs?: number;

  // =============================================
  // ðŸš€ AUTO-SCALE TESTING PHASE & HORIZONTAL SCALING
  // =============================================

  @Prop({ 
    type: String, 
    enum: ['TESTING', 'GROWTH', 'MATURE', 'STABLE'], 
    default: 'TESTING',
    index: true 
  })
  testingPhase?: 'TESTING' | 'GROWTH' | 'MATURE' | 'STABLE'; // Testing phase cho auto-scale

  @Prop({ type: Date })
  testingStartDate?: Date; // NgÃ y báº¯t Ä‘áº§u testing phase

  @Prop({ type: Number, default: 0 })
  daysSinceLaunch?: number; // Sá»‘ ngÃ y ká»ƒ tá»« khi launch (auto-calculated)

  @Prop({ default: false })
  isManualOverride?: boolean; // Náº¿u true, khÃ´ng Ã¡p dá»¥ng auto-scale

  @Prop({ type: String })
  manualOverrideReason?: string; // LÃ½ do manual override

  // Frequency metrics (sync tá»« Facebook API)
  @Prop({ type: Number })
  frequency?: number; // Sá»‘ láº§n trung bÃ¬nh 1 ngÆ°á»i tháº¥y ad

  @Prop({ type: Number })
  reach?: number; // Sá»‘ ngÆ°á»i unique Ä‘Ã£ tháº¥y ad

  @Prop({ type: Number })
  audienceSize?: number; // KÃ­ch thÆ°á»›c audience targeting

  @Prop({ type: Date })
  lastFrequencyUpdateAt?: Date; // Láº§n cuá»‘i update frequency metrics

  // Horizontal scaling metadata
  @Prop({ type: String })
  basedOnAdGroup?: string; // Náº¿u ad group nÃ y lÃ  horizontal scale tá»« ad group khÃ¡c

  @Prop({ default: false })
  autoCreated?: boolean; // ÄÆ°á»£c táº¡o tá»± Ä‘á»™ng bá»Ÿi horizontal scaling

  @Prop({ type: String })
  autoCreatedReason?: string; // LÃ½ do táº¡o tá»± Ä‘á»™ng

  @Prop({ 
    type: String, 
    enum: ['LOOKALIKE_1', 'LOOKALIKE_2_3', 'INTEREST_TARGETING', 'BROAD_TARGETING'] 
  })
  targetingStrategy?: string; // Chiáº¿n lÆ°á»£c targeting (cho horizontal scaling)

  @Prop({ default: false })
  preferHorizontalScaling?: boolean; // Æ¯u tiÃªn horizontal scaling thay vÃ¬ vertical

  @Prop({ type: Number })
  maxDailyScaleRate?: number; // Max scale rate cho ad group nÃ y (override global)

  // Gradual scaling tracking
  @Prop({ type: Number })
  pendingBudgetIncrease?: number; // Budget cÃ²n láº¡i cáº§n scale (cho multi-day gradual scale)

  @Prop({ type: Date })
  nextScheduledScaleDate?: Date; // NgÃ y scale tiáº¿p theo (cho gradual scale)

  @Prop({ type: Number })
  targetBudget?: number; // Budget má»¥c tiÃªu cuá»‘i cÃ¹ng (cho gradual scale)
}

export const AdGroupSchema = SchemaFactory.createForClass(AdGroup);

// Indexes phá»¥c vá»¥ truy váº¥n phá»• biáº¿n vÃ  chatbot
AdGroupSchema.index({ createdAt: -1 });
AdGroupSchema.index({ fanpageId: 1, isActive: 1 });
AdGroupSchema.index({ enableWebhook: 1 });
AdGroupSchema.index({ adGroupId: 1, fanpageId: 1 }); // Composite index cho webhook lookup

