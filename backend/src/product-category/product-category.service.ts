/**
 * File: product-category.service.ts
 * Mục đích: Nghiệp vụ Nhóm Sản phẩm và truy cập dữ liệu.
 */
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { ProductCategory, ProductCategoryDocument } from './schemas/product-category.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FINANCIAL_INPUT_CHANGED } from '../advertising-cost/advertising-cost-refresh.module';

@Injectable()
export class ProductCategoryService {
  constructor(
    @InjectModel(ProductCategory.name) 
    private productCategoryModel: Model<ProductCategoryDocument>,
    private readonly events?: EventEmitter2,
  ) {}

  private async attachActualProductCounts(categories: ProductCategoryDocument[]): Promise<ProductCategoryDocument[]> {
    if (!categories.length) return categories;
    const ids = categories.map(category => category._id);
    const counts = await this.productCategoryModel.db.collection('products').aggregate([
      { $match: { categoryId: { $in: ids } } },
      { $group: { _id: '$categoryId', count: { $sum: 1 } } },
    ]).toArray();
    const byCategory = new Map(counts.map(row => [String(row._id), Number(row.count || 0)]));
    for (const category of categories) {
      category.productCount = byCategory.get(String(category._id)) || 0;
    }
    return categories;
  }

  async create(createProductCategoryDto: CreateProductCategoryDto): Promise<ProductCategory> {
    createProductCategoryDto.productCount = 0;
    // Tự động set order nếu không được cung cấp
    if (!createProductCategoryDto.order) {
      const count = await this.productCategoryModel.countDocuments();
      createProductCategoryDto.order = count + 1;
    }

    // Tự động tạo code nếu không được cung cấp
    if (!createProductCategoryDto.code) {
      const lastCategory = await this.productCategoryModel
        .findOne({ code: /^CAT\d+$/ })
        .sort({ code: -1 })
        .select('code')
        .lean();
      const lastCode = lastCategory?.code;
      const nextNumber = lastCode ? Number(String(lastCode).replace(/^CAT/, '')) + 1 : 1;
      createProductCategoryDto.code = `CAT${String(nextNumber).padStart(3, '0')}`;
    }

    const createdCategory = new this.productCategoryModel(createProductCategoryDto);
    try {
      return await createdCategory.save();
    } catch (error) {
      const duplicateKeyCode = (error as { code?: number } | null)?.code;
      if (duplicateKeyCode === 11000) {
        throw new ConflictException('Product category already exists');
      }
      throw error;
    }
  }

  async findAll(): Promise<ProductCategory[]> {
    const categories = await this.productCategoryModel
      .find()
      .sort({ order: 1, createdAt: -1 })
      .exec();
    return this.attachActualProductCounts(categories);
  }

  async findOne(id: string): Promise<ProductCategory> {
    const category = await this.productCategoryModel.findById(id).exec();
    if (!category) {
      throw new NotFoundException(`Product Category with ID ${id} not found`);
    }
    category.productCount = await this.productCategoryModel.db
      .collection('products')
      .countDocuments({ categoryId: category._id });
    return category;
  }

  async update(id: string, updateProductCategoryDto: UpdateProductCategoryDto): Promise<ProductCategory> {
    const update = { ...updateProductCategoryDto };
    delete update.productCount;
    const updatedCategory = await this.productCategoryModel
      .findByIdAndUpdate(id, update, { new: true })
      .exec();
    
    if (!updatedCategory) {
      throw new NotFoundException(`Product Category with ID ${id} not found`);
    }
    updatedCategory.productCount = await this.productCategoryModel.db.collection('products')
      .countDocuments({ categoryId: updatedCategory._id });
    if (this.events) {
      const products = await this.productCategoryModel.db.collection('products').find({ categoryId: { $in: [id, updatedCategory._id] } }, { projection: { _id: 1 } }).toArray();
      await this.events.emitAsync(FINANCIAL_INPUT_CHANGED, { productIds: products.map(product => String(product._id)) });
    }
    return updatedCategory;
  }

  async remove(id: string): Promise<void> {
    const productCount = await this.productCategoryModel.db
      .collection('products')
      .countDocuments({ categoryId: new Types.ObjectId(id) });
    if (productCount > 0) {
      throw new ConflictException('Cannot delete product category while products still reference it');
    }

    const result = await this.productCategoryModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Product Category with ID ${id} not found`);
    }
  }

  // Lấy các nhóm sản phẩm đang hoạt động
  async getActiveCategories(): Promise<ProductCategory[]> {
    const categories = await this.productCategoryModel
      .find({ isActive: true })
      .sort({ order: 1 })
      .exec();
    return this.attachActualProductCounts(categories);
  }

  // Cập nhật số lượng sản phẩm trong nhóm
  async updateProductCount(id: string, _count: number): Promise<ProductCategory> {
    const actualCount = await this.productCategoryModel.db.collection('products')
      .countDocuments({ categoryId: new Types.ObjectId(id) });
    const updatedCategory = await this.productCategoryModel
      .findByIdAndUpdate(id, { productCount: actualCount }, { new: true })
      .exec();
    
    if (!updatedCategory) {
      throw new NotFoundException(`Product Category with ID ${id} not found`);
    }
    return updatedCategory;
  }

  // Cập nhật thứ tự hiển thị
  async updateOrder(id: string, newOrder: number): Promise<ProductCategory> {
    const updatedCategory = await this.productCategoryModel
      .findByIdAndUpdate(id, { order: newOrder }, { new: true })
      .exec();
    
    if (!updatedCategory) {
      throw new NotFoundException(`Product Category with ID ${id} not found`);
    }
    return updatedCategory;
  }

  // Thống kê tổng quan
  async getStatsSummary() {
    const total = await this.productCategoryModel.countDocuments();
    const active = await this.productCategoryModel.countDocuments({ isActive: true });
    const totalProducts = await this.getTotalProductCount();
    
    return {
      total,
      active,
      inactive: total - active,
      totalProducts,
      averageProductsPerCategory: total > 0 ? Math.round(totalProducts / total) : 0
    };
  }

  private async getTotalProductCount(): Promise<number> {
    return this.productCategoryModel.db.collection('products').countDocuments({});
  }

  // Method để seed dữ liệu mẫu với encoding UTF-8 đúng
  async seedSampleData(): Promise<ProductCategory[]> {
    // Xóa tất cả dữ liệu cũ
    await this.productCategoryModel.deleteMany({});
    
    const sampleData = [
      {
        name: 'Điện tử',
        description: 'Các sản phẩm điện tử và thiết bị công nghệ',
        color: '#3498db',
        icon: '📱',
        isActive: true,
        order: 1,
        code: 'CAT001',
        productCount: 25,
        notes: 'Bao gồm điện thoại, laptop, tablet và phụ kiện'
      },
      {
        name: 'Thời trang',
        description: 'Quần áo, giày dép và phụ kiện thời trang',
        color: '#e74c3c',
        icon: '👕',
        isActive: true,
        order: 2,
        code: 'CAT002',
        productCount: 150,
        notes: 'Thời trang nam, nữ và trẻ em'
      },
      {
        name: 'Gia dụng',
        description: 'Đồ dùng gia đình và thiết bị nhà bếp',
        color: '#f39c12',
        icon: '🏠',
        isActive: true,
        order: 3,
        code: 'CAT003',
        productCount: 80,
        notes: 'Đồ nội thất, đồ trang trí và dụng cụ nhà bếp'
      },
      {
        name: 'Sách & Văn phòng phẩm',
        description: 'Sách, tạp chí và đồ dùng văn phòng',
        color: '#27ae60',
        icon: '📚',
        isActive: true,
        order: 4,
        code: 'CAT004',
        productCount: 45,
        notes: 'Sách giáo khoa, sách tham khảo và văn phòng phẩm'
      },
      {
        name: 'Thể thao & Giải trí',
        description: 'Dụng cụ thể thao và đồ chơi giải trí',
        color: '#9b59b6',
        icon: '⚽',
        isActive: false,
        order: 5,
        code: 'CAT005',
        productCount: 12,
        notes: 'Tạm ngừng kinh doanh'
      }
    ];

    const createdRecords = [];
    for (const data of sampleData) {
      const created = new this.productCategoryModel(data);
      createdRecords.push(await created.save());
    }

    return createdRecords;
  }
}
