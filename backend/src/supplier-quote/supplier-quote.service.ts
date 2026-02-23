import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateSupplierQuoteDto } from './dto/create-supplier-quote.dto';
import { SupplierQuote, SupplierQuoteDocument } from './schemas/supplier-quote.schema';

@Injectable()
export class SupplierQuoteService {
  private readonly logger = new Logger(SupplierQuoteService.name);
  
  constructor(@InjectModel(SupplierQuote.name) private model: Model<SupplierQuoteDocument>) {}

  async create(dto: CreateSupplierQuoteDto) {
    const effectiveAt = dto.effectiveAt ? new Date(dto.effectiveAt) : new Date();
    
    // Validate: Không cho phép tạo quote với effectiveAt trong quá khứ (chỉ cảnh báo)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (effectiveAt < today) {
      this.logger.warn(`Creating quote with past effectiveAt: ${effectiveAt.toISOString()}`);
    }

    const doc = await this.model.create({
      productId: new Types.ObjectId(dto.productId),
      supplierId: new Types.ObjectId(dto.supplierId),
      price: Number(dto.price),
      currency: dto.currency || 'VND',
      effectiveAt,
      note: dto.note,
      isReturnableOverride: dto.isReturnableOverride,
      shippingFee: dto.shippingFee ?? 0,
      returnFee: dto.returnFee ?? 0,
    });
    
    this.logger.log(`Created SupplierQuote: product=${dto.productId}, supplier=${dto.supplierId}, price=${dto.price}, effectiveAt=${effectiveAt.toISOString()}`);
    return doc.toObject();
  }

  async findAll(params: { productId?: string; supplierId?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(200, Number(params.limit) || 50));
    const query: any = {};
    if (params.productId) query.productId = new Types.ObjectId(params.productId);
    if (params.supplierId) query.supplierId = new Types.ObjectId(params.supplierId);

    const [total, data] = await Promise.all([
      this.model.countDocuments(query),
      this.model.find(query).sort({ effectiveAt: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ]);

    return { data, pagination: { page, limit, total, totalPages: total ? Math.ceil(total / limit) : 0 } };
  }

  async getLatest(productId: string, supplierId: string) {
    const doc = await this.model
      .findOne({ productId: new Types.ObjectId(productId), supplierId: new Types.ObjectId(supplierId) })
      .sort({ effectiveAt: -1, createdAt: -1 })
      .lean();
    if (!doc) throw new NotFoundException('Chưa có báo giá');
    return doc;
  }

  /**
   * Get effective quote at a specific date
   * Tìm quote có effectiveAt <= targetDate, mới nhất
   */
  async getEffectiveAt(productId: string, supplierId: string, targetDate: Date) {
    const doc = await this.model
      .findOne({ 
        productId: new Types.ObjectId(productId), 
        supplierId: new Types.ObjectId(supplierId),
        $or: [
          { effectiveAt: { $lte: targetDate } },
          { effectiveAt: { $exists: false } },
        ],
      })
      .sort({ effectiveAt: -1, createdAt: -1 })
      .lean();
    return doc; // Có thể null nếu chưa có quote
  }

  /**
   * Get price history for a product-supplier pair
   * Trả về danh sách các quote theo thời gian
   */
  async getPriceHistory(productId: string, supplierId: string): Promise<{
    history: Array<{
      _id: string;
      price: number;
      effectiveAt: Date;
      createdAt: Date;
      note?: string;
    }>;
    stats: {
      minPrice: number;
      maxPrice: number;
      avgPrice: number;
      currentPrice: number;
      quoteCount: number;
    };
  }> {
    const quotes = await this.model
      .find({ 
        productId: new Types.ObjectId(productId), 
        supplierId: new Types.ObjectId(supplierId) 
      })
      .sort({ effectiveAt: -1, createdAt: -1 })
      .lean();

    if (quotes.length === 0) {
      return {
        history: [],
        stats: {
          minPrice: 0,
          maxPrice: 0,
          avgPrice: 0,
          currentPrice: 0,
          quoteCount: 0,
        },
      };
    }

    const prices = quotes.map(q => q.price);
    const currentPrice = quotes[0].price;

    return {
      history: quotes.map(q => ({
        _id: q._id.toString(),
        price: q.price,
        effectiveAt: q.effectiveAt || (q as any).createdAt,
        createdAt: (q as any).createdAt,
        note: q.note,
      })),
      stats: {
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
        currentPrice,
        quoteCount: quotes.length,
      },
    };
  }

  /**
   * Get all active quotes for a supplier
   * Để xem tổng quan báo giá của 1 NCC
   */
  async getSupplierQuotes(supplierId: string): Promise<{
    quotes: Array<{
      productId: string;
      productName?: string;
      currentPrice: number;
      effectiveAt: Date;
      quoteCount: number;
    }>;
    totalProducts: number;
  }> {
    // Aggregate để lấy quote mới nhất cho mỗi sản phẩm
    const result = await this.model.aggregate([
      { $match: { supplierId: new Types.ObjectId(supplierId) } },
      { $sort: { productId: 1, effectiveAt: -1, createdAt: -1 } },
      {
        $group: {
          _id: '$productId',
          latestQuote: { $first: '$$ROOT' },
          quoteCount: { $sum: 1 },
        },
      },
      {
        $project: {
          productId: '$_id',
          currentPrice: '$latestQuote.price',
          effectiveAt: '$latestQuote.effectiveAt',
          quoteCount: 1,
        },
      },
    ]);

    return {
      quotes: result.map(r => ({
        productId: r.productId.toString(),
        currentPrice: r.currentPrice,
        effectiveAt: r.effectiveAt,
        quoteCount: r.quoteCount,
      })),
      totalProducts: result.length,
    };
  }
}
