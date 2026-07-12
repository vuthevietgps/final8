import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChatMessageDocument = ChatMessage & Document;

const normalizeOptionalString = (value: any): string | undefined => {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : undefined;
};

/**
 * ChatMessage: Append-only storage for analytics and order extraction
 * - Used for webhook processing, AI context, and order data extraction
 * - NOT for individual message CRUD operations
 * - Auto-deleted after 90 days to prevent database bloat
 * - Use Conversation model for management operations
 */
@Schema({ timestamps: true })
export class ChatMessage {
  @Prop({ type: Types.ObjectId, ref: 'Fanpage', index: true }) fanpageId: Types.ObjectId;
  @Prop({ required: true, trim: true, index: true }) senderPsid: string; // Facebook PSID
  @Prop({ required: true, trim: true }) direction: 'in' | 'out'; // in = from user, out = from page/AI
  @Prop({ required: true, trim: true }) content: string;
  @Prop({ trim: true }) messageType?: string; // text, image, etc.
  @Prop({ trim: true }) adGroupId?: string; // resolved ad group (if determined)
  @Prop({ trim: true }) aiModelUsed?: string; // which openai model responded
  @Prop({ default: false, index: true }) isAI?: boolean; // outbound do AI sinh ra
  @Prop({ default: false }) isClarify?: boolean; // whether this is a clarify attempt
  @Prop({ default: false }) isSuggestion?: boolean; // product suggestion
  @Prop({ default: false }) isClosing?: boolean;
  @Prop({ default: false, index: true }) awaitingHuman?: boolean; // AI khÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´ng hiÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€ Ã¢â‚¬â„¢u, cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â§n ngÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°ÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Âi xÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â­ lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â½
  @Prop({ trim: true, index: true }) sourcePlatform?: string; // facebook, zalo, ...
  @Prop({ trim: true, set: normalizeOptionalString }) platformMessageId?: string; // Messenger mid / Graph message_id
  @Prop({ trim: true, set: normalizeOptionalString }) platformEventKey?: string; // Stable idempotency key for non-message events
  @Prop({ trim: true, default: 'sent' }) deliveryStatus?: 'sent' | 'failed' | 'skipped';
  @Prop({ default: Date.now }) receivedAt: Date;
  @Prop({ type: Object }) raw?: any; // lÃƒÆ’Ã¢â‚¬Â Ãƒâ€šÃ‚Â°u raw platform payload (Messenger attachments,...)
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
ChatMessageSchema.index({ fanpageId: 1, senderPsid: 1, createdAt: -1 });
ChatMessageSchema.index(
  { sourcePlatform: 1, fanpageId: 1, platformMessageId: 1 },
  {
    name: 'sourcePlatform_1_fanpageId_1_platformMessageId_1',
    unique: true,
    partialFilterExpression: { platformMessageId: { $type: 'string' } },
  },
);
ChatMessageSchema.index(
  { sourcePlatform: 1, fanpageId: 1, platformEventKey: 1 },
  {
    name: 'sourcePlatform_1_fanpageId_1_platformEventKey_1',
    unique: true,
    partialFilterExpression: { platformEventKey: { $type: 'string' } },
  },
);
// TTL index: Automatically delete messages older than 90 days to prevent database bloat
ChatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
