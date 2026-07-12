import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GoogleAdsExportDocument = HydratedDocument<GoogleAdsExport>;

@Schema({ collection: 'google_ads_exports', timestamps: true })
export class GoogleAdsExport {
  @Prop({ required: true, trim: true, unique: true, index: true })
  exportId: string;

  @Prop({ required: true, trim: true })
  fileName: string;

  @Prop({ required: true, trim: true })
  filePath: string;

  @Prop({ required: true, enum: ['ready', 'failed'], index: true })
  status: 'ready' | 'failed';

  @Prop({ required: true, trim: true })
  checksumSha256: string;

  @Prop({ type: Object, default: {} })
  rowCounts: Record<string, number>;

  @Prop({ type: [String], default: [] })
  dataQualityWarnings: string[];

  @Prop({ type: Object, default: {} })
  manifest: Record<string, any>;
}

export const GoogleAdsExportSchema = SchemaFactory.createForClass(GoogleAdsExport);

GoogleAdsExportSchema.index({ createdAt: -1 }, { name: 'idx_google_ads_export_created_at' });
