import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AiOperatorMessageDocument = AiOperatorMessage & Document;

@Schema({ timestamps: true })
export class AiOperatorMessage {
  @Prop({ type: Types.ObjectId, ref: 'AiOperatorSession', required: true, index: true })
  sessionId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: ['user', 'assistant', 'system'], index: true })
  role: 'user' | 'assistant' | 'system';

  @Prop({ required: true, trim: true })
  content: string;

  @Prop({ trim: true })
  modelUsed?: string;

  @Prop({ trim: true, index: true })
  intent?: string;

  @Prop({ trim: true, index: true })
  scenarioId?: string;

  @Prop({ type: Object })
  route?: any;

  @Prop({ type: Object })
  authSnapshot?: any;

  @Prop({ type: Object })
  contextSummary?: any;

  @Prop({ type: Object })
  recommendations?: any;

  @Prop({ type: Object })
  qualitySignals?: any;

  @Prop({ type: Object })
  agentTrace?: any;

  @Prop({ type: Object })
  feedback?: any;
}

export const AiOperatorMessageSchema = SchemaFactory.createForClass(AiOperatorMessage);
AiOperatorMessageSchema.index({ sessionId: 1, createdAt: 1 });
AiOperatorMessageSchema.index({ userId: 1, createdAt: -1 });
AiOperatorMessageSchema.index({ role: 1, intent: 1, createdAt: -1 });
AiOperatorMessageSchema.index({ 'feedback.rating': 1, createdAt: -1 });
