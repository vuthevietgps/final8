/**
 * File: openai-config/schemas/openai-config.schema.ts  
 * Mục đích: Schema MongoDB cho cấu hình OpenAI chatbot
 * Chức năng: Định nghĩa cấu trúc dữ liệu, validation và indexes
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OpenAIConfigDocument = OpenAIConfig & Document;

@Schema({ timestamps: true })
export class OpenAIConfig {
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ trim: true }) description?: string;
  @Prop({ required: true, trim: true }) model: string; // e.g. gpt-4o-mini
  @Prop({ required: true, trim: true }) apiKey: string;
  @Prop({ required: true, trim: true }) systemPrompt: string;
  @Prop({ default: 0 }) maxTokens?: number;
  @Prop({ default: 0.7 }) temperature?: number;
  @Prop({ enum: ['global','fanpage','adgroup','messageScope'], default: 'global', index: true })
  scopeType: 'global' | 'fanpage' | 'adgroup' | 'messageScope';
  @Prop({ type: Types.ObjectId }) scopeRef?: Types.ObjectId; // fanpageID or adGroup ID
  @Prop({ default: 'active' }) status: 'active' | 'inactive';
  @Prop({ default: false }) isDefault: boolean;
}

export const OpenAIConfigSchema = SchemaFactory.createForClass(OpenAIConfig);
OpenAIConfigSchema.index({ scopeType: 1, scopeRef: 1, isDefault: 1 });
