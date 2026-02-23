/**
 * File: product-category.service.ts
 * Mục đích: Nghiệp vụ Nhóm Sản phẩm và truy cập dữ liệu.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { ProductCategory, ProductCategoryDocument } from './schemas/product-category.schema';

@Injectable()
export class ProductCategoryService {
  constructor(
    @InjectModel(ProductCategory.name) 
    private productCategoryModel: Model<ProductCategoryDocument>
  ) {}

  async create(createProductCategoryDto: CreateProductCategoryDto): Promise<ProductCategory> {
    // Tự động set order nếu không được cung cấp
    if (!createProductCategoryDto.order) {
      const count = await this.productCategoryModel.countDocuments();
      createProductCategoryDto.order = count + 1;
    }

    // Tự động tạo code nếu không được cung cấp
    if (!createProductCategoryDto.code) {
      const count = await this.productCategoryModel.countDocuments();
      createProductCategoryDto.code = `CAT${String(count + 1).padStart(3, '0')}`;
    }

    const createdCategory = new this.productCategoryModel(createProductCategoryDto);
    return createdCategory.save();
  }

  async findAll(): Promise<ProductCategory[]> {
    return this.productCategoryModel
      .find()
      .sort({ order: 1, createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<ProductCategory> {
    const category = await this.productCategoryModel.findById(id).exec();
    if (!category) {
      throw new NotFoundException(`Product Category with ID ${id} not found`);
    }
    return category;
  }

  async update(id: string, updateProductCategoryDto: UpdateProductCategoryDto): Promise<ProductCategory> {
    const updatedCategory = await this.productCategoryModel
      .findByIdAndUpdate(id, updateProductCategoryDto, { new: true })
      .exec();
    
    if (!updatedCategory) {
      throw new NotFoundException(`Product Category with ID ${id} not found`);
    }
    return updatedCategory;
  }

  async remove(id: string): Promise<void> {
    const result = await this.productCategoryModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Product Category with ID ${id} not found`);
    }
  }

  // Lấy các nhóm sản phẩm đang hoạt động
  async getActiveCategories(): Promise<ProductCategory[]> {
    return this.productCategoryModel
      .find({ isActive: true })
      .sort({ order: 1 })
      .exec();
  }

  // Cập nhật số lượng sản phẩm trong nhóm
  async updateProductCount(id: string, count: number): Promise<ProductCategory> {
    const updatedCategory = await this.productCategoryModel
      .findByIdAndUpdate(id, { productCount: count }, { new: true })
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
    const categories = await this.productCategoryModel.find({ productCount: { $exists: true, $ne: null } });
    return categories.reduce((acc, category) => acc + (category.productCount || 0), 0);
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
