import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MediaDocument = Media & Document;

@Schema({ timestamps: true })
export class Media {
  @Prop({ required: true, trim: true }) url: string; // public URL (e.g., /media/2025/10/uuid.jpg)
  @Prop({ required: true, trim: true }) path: string; // absolute path in container (e.g., /app/media/2025/10/uuid.jpg)
  @Prop({ required: true, trim: true }) filename: string;
  @Prop({ trim: true }) mimeType?: string;
  @Prop({ trim: true }) ext?: string;
  @Prop({ type: Number, default: 0 }) size?: number;
  @Prop({ type: Types.ObjectId, ref: 'Product' }) productId?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Fanpage' }) fanpageId?: Types.ObjectId;
  @Prop([String]) tags?: string[];
  @Prop({ default: false }) isMainImage?: boolean;
  @Prop({ trim: true }) alt?: string;
  // Optional metadata to help AI choose better images
  @Prop({ enum: ['gallery', 'feedback', 'ugc', 'marketing'], default: 'gallery' }) sourceType?: 'gallery' | 'feedback' | 'ugc' | 'marketing';
  @Prop({ type: Number }) width?: number;
  @Prop({ type: Number }) height?: number;
  // Example: "1:1", "4:5", "16:9". Best-effort from width/height if available
  @Prop({ trim: true }) aspectRatio?: string;
}

export const MediaSchema = SchemaFactory.createForClass(Media);
MediaSchema.index({ productId: 1, createdAt: -1 });
MediaSchema.index({ fanpageId: 1, createdAt: -1 });
MediaSchema.index({ tags: 1 });
