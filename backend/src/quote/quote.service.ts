/**
 * File: quote.service.ts
 * Mục đích: Chứa logic nghiệp vụ cho báo giá (tạo/sửa/xoá/lấy danh sách, thống kê),
 *   truy cập MongoDB qua Mongoose Model và populate các liên kết (product, agent).
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Quote, QuoteDocument } from './schemas/quote.schema';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import { GoogleSyncService } from '../google-sync/google-sync.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';

@Injectable()
export class QuoteService {
  constructor(
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private readonly googleSync: GoogleSyncService,
  ) {}

  async create(createQuoteDto: CreateQuoteDto): Promise<Quote | Quote[]> {
    const { applyToAllAgents, productId, unitPrice, status, validFrom, validUntil, notes } = createQuoteDto;
    
    // Lấy thông tin sản phẩm
    const productDoc = await this.productModel.findById(productId).exec();
    if (!productDoc) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }
    
    if (applyToAllAgents) {
      // Tạo báo giá cho tất cả đại lý
      const userModel = this.quoteModel.db.models.User || this.quoteModel.db.model('User');
      
      // Lấy tất cả đại lý (có thể filter theo role nếu cần)
      const agents = await userModel.find({
        role: { 
          $in: [
            'external_agent', 
            'internal_agent', 
            'external_supplier', 
            'internal_supplier'
          ] 
        },
        isActive: { $ne: false }
      }).exec();
      
      if (!agents || agents.length === 0) {
        throw new NotFoundException('No agents found to apply quotes');
      }
      
      // Tạo báo giá cho từng đại lý
      const quotes: Quote[] = [];
      const createdQuotes = [];
      
      for (const agent of agents) {
        // Kiểm tra xem đã có báo giá cho agent+product này chưa
        const existingQuote = await this.quoteModel.findOne({
          productId: productId,
          agentId: agent._id,
          isActive: { $ne: false }
        }).exec();
        
        if (!existingQuote) {
          const quoteData = {
            productId,
            agentId: agent._id,
            product: productDoc.name,
            agentName: agent.fullName,
            unitPrice,
            status: status || 'Chờ duyệt', // Sử dụng status từ DTO
            validFrom: new Date(validFrom),
            validUntil: new Date(validUntil),
            notes: notes || `Báo giá áp dụng cho tất cả đại lý - ${productDoc.name}`,
            isActive: true
          };
          
          const createdQuote = new this.quoteModel(quoteData);
          const saved = await createdQuote.save();
          quotes.push(saved);
          createdQuotes.push(saved);
        }
      }
      
      // Cập nhật Google Sync cho tất cả agents được tạo báo giá
      for (const quote of createdQuotes) {
        const agentId = String(quote.agentId);
        const prodId = String(quote.productId);
        // Google sync removed - using Summary4 sync instead
        // TODO: Integrate with Summary4GoogleSyncService if needed
      }
      
      return quotes;
    } else {
      // Tạo báo giá cho đại lý cụ thể (logic cũ)
      if (!createQuoteDto.agentId) {
        throw new Error('Agent ID is required when not applying to all agents');
      }
      
      let { product, agentName } = createQuoteDto;
      
      if (!product || !agentName) {
        const userModel = this.quoteModel.db.models.User || this.quoteModel.db.model('User');
        const userDoc = await userModel.findById(createQuoteDto.agentId).exec();
        
        product = product || productDoc?.name || 'Unknown Product';
        agentName = agentName || userDoc?.fullName || 'Unknown Agent';
      }

      const quoteData = {
        productId: createQuoteDto.productId,
        agentId: createQuoteDto.agentId,
        product,
        agentName,
        unitPrice: createQuoteDto.unitPrice,
        status: createQuoteDto.status || 'Chờ duyệt', // Sử dụng status từ DTO
        validFrom: new Date(createQuoteDto.validFrom),
        validUntil: new Date(createQuoteDto.validUntil),
        notes: createQuoteDto.notes
      };
      
      const createdQuote = new this.quoteModel(quoteData);
      const saved = await createdQuote.save();
      const agentId = String(saved.agentId);
      
      // Google sync removed - using Summary4 sync instead
      // TODO: Integrate with Summary4GoogleSyncService if needed
      
      return saved;
    }
  }

  async findAll(query?: any): Promise<Quote[]> {
    // Xây filter rõ ràng để tránh nhận raw query gây sai lệch
    const filter: any = {};
    if (query) {
      const { agentId, productId, status, isActive } = query;
      if (agentId) filter.agentId = agentId;
      if (productId) filter.productId = productId;
      if (status) filter.status = status;
      if (isActive === 'false') filter.isActive = false; 
      else if (isActive === 'true') filter.isActive = true;
    }
    // Mặc định: hiển thị cả bản ghi chưa có trường isActive (tương thích dữ liệu cũ) và isActive=true
    if (filter.isActive === undefined) {
      filter.$or = [{ isActive: true }, { isActive: { $exists: false } }];
    }
    return this.quoteModel
      .find(filter)
      .populate('productId', 'name sku price')
      .populate('agentId', 'fullName email role')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<Quote> {
    const quote = await this.quoteModel
      .findById(id)
      .populate('productId', 'name sku price')
      .populate('agentId', 'fullName email role')
      .exec();
    
    if (!quote) {
      throw new NotFoundException(`Quote with ID ${id} not found`);
    }
    return quote;
  }

  async update(id: string, updateQuoteDto: UpdateQuoteDto): Promise<Quote> {
    const updatedQuote = await this.quoteModel
      .findByIdAndUpdate(id, updateQuoteDto, { new: true })
      .populate('productId', 'name sku price')
      .populate('agentId', 'fullName email role')
      .exec();
    
    if (!updatedQuote) {
      throw new NotFoundException(`Quote with ID ${id} not found`);
  }
    const agentId = String((updatedQuote as any).agentId?._id || (updatedQuote as any).agentId);
    const productId = String((updatedQuote as any).productId?._id || (updatedQuote as any).productId);
    if (agentId && productId) {
      // Google sync removed - using Summary4 sync instead
      // TODO: Integrate with Summary4GoogleSyncService if needed
    } else if (agentId) {
      // TODO: Integrate with Summary4GoogleSyncService if needed
    }
    return updatedQuote;
  }

  async remove(id: string): Promise<Quote> {
    const deletedQuote = await this.quoteModel
      .findByIdAndUpdate(id, { isActive: false }, { new: true })
      .exec();
    
    if (!deletedQuote) {
      throw new NotFoundException(`Quote with ID ${id} not found`);
  }
    const agentId = String((deletedQuote as any).agentId);
    const productId = String((deletedQuote as any).productId || '');
    if (agentId && productId) {
      // Google sync removed - using Summary4 sync instead
      // TODO: Integrate with Summary4GoogleSyncService if needed
    } else if (agentId) {
      // TODO: Integrate with Summary4GoogleSyncService if needed
    }
    return deletedQuote;
  }

  async findByAgent(agentId: string): Promise<Quote[]> {
    return this.quoteModel
      .find({ agentId, isActive: true })
      .populate('productId', 'name sku price')
      .populate('agentId', 'fullName email role')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByProduct(productId: string): Promise<Quote[]> {
    return this.quoteModel
      .find({ productId, isActive: true })
      .populate('productId', 'name sku price')
      .populate('agentId', 'fullName email role')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getStats(): Promise<any> {
    const total = await this.quoteModel.countDocuments({ isActive: true });
    const pending = await this.quoteModel.countDocuments({ status: 'Chờ duyệt', isActive: true });
    const approved = await this.quoteModel.countDocuments({ status: 'Đã duyệt', isActive: true });
    const rejected = await this.quoteModel.countDocuments({ status: 'Từ chối', isActive: true });
    const expired = await this.quoteModel.countDocuments({ status: 'Hết hiệu lực', isActive: true });

    return {
      total,
      pending,
      approved,
      rejected,
      expired,
      approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0
    };
  }

  // Diagnostics helper: liệt kê collections và thống kê chi tiết cho Quote
  async diagnostics(): Promise<any> {
    // Access underlying connection via model
    const conn = (this.quoteModel as any).db?.db;
    let collections: string[] = [];
    try {
      collections = (await conn?.listCollections()?.toArray())?.map((c: any) => c.name) || [];
    } catch (e) {
      collections = [];
    }

    // Counts
    const totalAll = await this.quoteModel.countDocuments({}).exec();
    const totalVisible = await this.quoteModel.countDocuments({ $or: [{ isActive: true }, { isActive: { $exists: false } }] }).exec();
    const totalInactive = await this.quoteModel.countDocuments({ isActive: false }).exec();
    const statusAgg = await this.quoteModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).exec();

    const sampleAll = await this.quoteModel.find({}).sort({ createdAt: -1 }).limit(5).lean();
    const sampleVisible = await this.quoteModel
      .find({ $or: [{ isActive: true }, { isActive: { $exists: false } }] })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    return {
      mongo: {
        collections,
      },
      quotes: {
        counts: {
          totalAll,
          totalVisible,
          totalInactive,
          byStatus: statusAgg,
        },
        samples: {
          recentAll: sampleAll,
          recentVisible: sampleVisible,
        },
        defaultFilter: { $or: [{ isActive: true }, { isActive: { $exists: false } }] },
      },
    };
  }

  /**
   * Migration: Cập nhật tất cả quotes hiện có để có trường product và agentName
   */
  async migrateProductAndAgentNames(): Promise<{
    processed: number;
    updated: number;
    errors: string[];
  }> {
    const result = { processed: 0, updated: 0, errors: [] };
    
    try {
      // Lấy tất cả quotes với populate để có tên
      const quotes = await this.quoteModel.find({
        $or: [
          { product: { $exists: false } },
          { agentName: { $exists: false } },
          { product: null },
          { agentName: null },
          { product: '' },
          { agentName: '' }
        ]
      })
      .populate('productId', 'name')
      .populate('agentId', 'fullName')
      .exec();

      console.log(`Found ${quotes.length} quotes need migration`);

      for (const quote of quotes) {
        result.processed++;
        
        try {
          const product = (quote.productId as any)?.name || 'Unknown Product';
          const agentName = (quote.agentId as any)?.fullName || 'Unknown Agent';
          
          if (product !== quote.product || agentName !== quote.agentName) {
            await this.quoteModel.findByIdAndUpdate(quote._id, {
              product,
              agentName
            });
            result.updated++;
            console.log(`Updated quote ${quote._id}: ${product} - ${agentName}`);
          }
          
        } catch (error) {
          result.errors.push(`Quote ${quote._id}: ${error.message}`);
        }
      }
      
      return result;
      
    } catch (error) {
      result.errors.push(`Migration failed: ${error.message}`);
      return result;
    }
  }
}
