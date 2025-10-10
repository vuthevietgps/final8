import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConversationDocument = Conversation & Document;

/**
 * Conversation: Primary working model for chat management
 * - Aggregated data from ChatMessage collection
 * - Used for conversation list, order processing, AI management
 * - Contains denormalized summary fields for performance
 * - Main interface for customer service operations
 */
@Schema({ timestamps: true })
export class Conversation {
  @Prop({ type: Types.ObjectId, ref: 'Fanpage', index: true }) fanpageId: Types.ObjectId;
  @Prop({ required: true, trim: true, index: true }) senderPsid: string;
  // denormalized summary fields
  @Prop({ default: 0 }) totalMessages: number;
  @Prop({ default: 0 }) inboundCount: number; // direction=in
  @Prop({ default: 0 }) outboundCount: number; // direction=out
  @Prop({ default: 0 }) awaitingCount: number; // awaitingHuman messages
  @Prop({ trim: true }) lastMessageSnippet?: string;
  @Prop({ trim: true }) lastDirection?: 'in' | 'out';
  @Prop() lastMessageAt?: Date;
  @Prop({ trim: true }) lastAdGroupId?: string; // Last Ad Group ID from messages
  @Prop({ default: false }) hasAwaitingHuman?: boolean; // derived convenience
  // resolution markers
  @Prop() firstAwaitingAt?: Date;
  @Prop() lastResolvedAt?: Date; // when last awaiting backlog cleared
  @Prop({ default: false, index: true }) needsHuman?: boolean; // alias semantic to hasAwaitingHuman
  @Prop({ default: false }) archived?: boolean;
  // Per-conversation auto AI toggle
  @Prop({ default: true, index: true }) autoAiEnabled?: boolean; // cho phép auto AI trả lời đầu cuộc trò chuyện
  // Order draft / approval linkage
  @Prop({ type: Types.ObjectId, ref: 'PendingOrder' }) pendingOrderId?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'TestOrder2' }) orderId?: Types.ObjectId;
  @Prop({ default: 'none', enum: ['none','draft','awaiting','approved'] }) orderDraftStatus?: 'none'|'draft'|'awaiting'|'approved';
  // Denormalized customer fields for search after approve
  @Prop({ trim: true }) orderCustomerName?: string;
  @Prop({ trim: true }) orderPhone?: string;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
ConversationSchema.index({ fanpageId: 1, senderPsid: 1 }, { unique: true });
ConversationSchema.index({ needsHuman: 1, lastMessageAt: -1 });
// Search indexes for customer lookup
ConversationSchema.index({ orderPhone: 1 });
ConversationSchema.index({ orderCustomerName: 'text' });