import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChatMessageDocument = ChatMessage & Document;

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
  @Prop({ default: false, index: true }) awaitingHuman?: boolean; // AI không hiểu, cần người xử lý
  @Prop({ default: Date.now }) receivedAt: Date;
  @Prop({ type: Object }) raw?: any; // lưu raw platform payload (Messenger attachments,...)
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
ChatMessageSchema.index({ fanpageId: 1, senderPsid: 1, createdAt: -1 });
// TTL index: Automatically delete messages older than 90 days to prevent database bloat
ChatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
