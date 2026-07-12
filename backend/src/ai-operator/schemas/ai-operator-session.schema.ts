import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AiOperatorSessionDocument = AiOperatorSession & Document;

@Schema({ timestamps: true })
export class AiOperatorSession {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ trim: true, index: true })
  userRole?: string;

  @Prop({ trim: true })
  userName?: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ default: 'active', enum: ['active', 'archived'], index: true })
  status: 'active' | 'archived';

  @Prop({ default: 0 })
  messageCount: number;

  @Prop({ trim: true, index: true })
  lastIntent?: string;

  @Prop({ trim: true, index: true })
  lastScenarioId?: string;

  @Prop()
  lastMessageAt?: Date;

  @Prop({ default: 7 })
  windowDays?: number;

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop({ type: Object })
  quality?: any;

  @Prop({ type: [String], default: [], index: true })
  analysisFlags?: string[];
}

export const AiOperatorSessionSchema = SchemaFactory.createForClass(AiOperatorSession);
AiOperatorSessionSchema.index({ userId: 1, lastMessageAt: -1 });
AiOperatorSessionSchema.index({ status: 1, lastMessageAt: -1 });
AiOperatorSessionSchema.index({ 'quality.outcome': 1, lastMessageAt: -1 });
