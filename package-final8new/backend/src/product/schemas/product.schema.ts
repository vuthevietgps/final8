/**
 * File: schemas/product.schema.ts
 * Mục đích: Định nghĩa schema Mongoose cho Sản phẩm.
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProductDocument = Product & Document;

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'ProductCategory', required: true })
  categoryId: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  importPrice: number; // Giá nhập

  @Prop({ required: true, min: 0 })
  shippingCost: number; // Chi phí nhập

  @Prop({ required: true, min: 0 })
  packagingCost: number; // Chi phí đóng hàng

  @Prop({ min: 0, default: 10 })
  minStock: number; // Mức tồn kho tối thiểu

  @Prop({ min: 0, default: 100 })
  maxStock: number; // Mức tồn kho tối đa

  @Prop({ required: true, min: 0, default: 0 })
  estimatedDeliveryDays: number; // Dự kiến thời gian chờ nhập (ngày)

  @Prop({ min: 1, default: 12 })
  usageDurationMonths: number; // Thời gian sử dụng của sản phẩm (tháng)

  @Prop({ 
    required: true, 
    enum: ['Hoạt động', 'Tạm dừng'], 
    default: 'Hoạt động' 
  })
  status: string; // Trạng thái

  @Prop({ 
    type: String, 
    default: '#3B82F6',
    match: /^#[0-9A-F]{6}$/i 
  })
  color: string; // Màu sắc sản phẩm (hex color)

  @Prop({ trim: true })
  notes: string; // Lưu ý

  @Prop({ trim: true })
  resourceLink: string; // Link tài nguyên

  // AI-Enhanced Product Images
  @Prop([{
    url: { type: String, required: true },
    description: { type: String, required: true },
    isMainImage: { type: Boolean, default: false },
    uploadedAt: { type: Date, default: Date.now },
    aiAnalysis: {
      objects: [String], // ["phone", "case", "screen"]
      colors: [String],  // ["black", "blue", "silver"]
      features: [String], // ["waterproof", "wireless charging"]
      keywords: [String], // Auto-generated search keywords
      confidence: { type: Number, min: 0, max: 1 } // AI confidence score
    }
  }])
  images: Array<{
    url: string;
    description: string;
    isMainImage: boolean;
    uploadedAt: Date;
    aiAnalysis: {
      objects: string[];
      colors: string[];
      features: string[];
      keywords: string[];
      confidence: number;
    };
  }>;

  @Prop({ trim: true })
  aiDescription: string; // AI-generated comprehensive description

  @Prop([String])
  searchKeywords: string[]; // Aggregated keywords from all images + manual

  // Fanpage-specific product variations
  @Prop([{
    fanpageId: { type: Types.ObjectId, ref: 'Fanpage' },
    customName: String,
    customDescription: String,
    customPrice: Number,
    // New: allow linking uploaded media URLs per fanpage-specific variation
    customImages: { type: [String], default: [] },
    imagePolicy: {
      aspectRatio: { type: String, enum: ['1:1','4:5','16:9','any'], default: 'any' },
      style: { type: String, enum: ['white','lifestyle','ugc','any'], default: 'any' },
      priorityTags: { type: [String], default: [] },
      forbiddenTags: { type: [String], default: [] }
    },
    variantTags: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 } // For sorting recommendations
  }])
  fanpageVariations: Array<{
    fanpageId: Types.ObjectId;
    customName?: string;
    customDescription?: string;
    customPrice?: number;
    customImages?: string[];
    imagePolicy?: {
      aspectRatio?: '1:1'|'4:5'|'16:9'|'any';
      style?: 'white'|'lifestyle'|'ugc'|'any';
      priorityTags?: string[];
      forbiddenTags?: string[];
    };
    variantTags?: string[];
    isActive: boolean;
    priority: number;
  }>;

  // Auto-generated fields
  @Prop({ unique: true, sparse: true })
  sku: string; // Mã sản phẩm tự động

  @Prop({ default: 0 })
  totalCost: number; // Tổng chi phí (tự động tính)
}

export const ProductSchema = SchemaFactory.createForClass(Product);

// Middleware to calculate totalCost before saving
ProductSchema.pre('save', function() {
  this.totalCost = this.importPrice + this.shippingCost + this.packagingCost;
});

// Auto-generate SKU before saving
ProductSchema.pre('save', async function() {
  if (!this.sku) {
    const count = await (this.constructor as any).countDocuments();
    this.sku = `SP${String(count + 1).padStart(4, '0')}`;
  }
});

// Create indexes for better performance
ProductSchema.index({ categoryId: 1 });
ProductSchema.index({ status: 1 });
ProductSchema.index({ createdAt: -1 });
