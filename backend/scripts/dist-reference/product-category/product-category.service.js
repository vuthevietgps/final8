"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductCategoryService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const product_category_schema_1 = require("./schemas/product-category.schema");
let ProductCategoryService = class ProductCategoryService {
    constructor(productCategoryModel) {
        this.productCategoryModel = productCategoryModel;
    }
    async create(createProductCategoryDto) {
        if (!createProductCategoryDto.order) {
            const count = await this.productCategoryModel.countDocuments();
            createProductCategoryDto.order = count + 1;
        }
        if (!createProductCategoryDto.code) {
            const count = await this.productCategoryModel.countDocuments();
            createProductCategoryDto.code = `CAT${String(count + 1).padStart(3, '0')}`;
        }
        const createdCategory = new this.productCategoryModel(createProductCategoryDto);
        return createdCategory.save();
    }
    async findAll() {
        return this.productCategoryModel
            .find()
            .sort({ order: 1, createdAt: -1 })
            .exec();
    }
    async findOne(id) {
        const category = await this.productCategoryModel.findById(id).exec();
        if (!category) {
            throw new common_1.NotFoundException(`Product Category with ID ${id} not found`);
        }
        return category;
    }
    async update(id, updateProductCategoryDto) {
        const updatedCategory = await this.productCategoryModel
            .findByIdAndUpdate(id, updateProductCategoryDto, { new: true })
            .exec();
        if (!updatedCategory) {
            throw new common_1.NotFoundException(`Product Category with ID ${id} not found`);
        }
        return updatedCategory;
    }
    async remove(id) {
        const result = await this.productCategoryModel.findByIdAndDelete(id).exec();
        if (!result) {
            throw new common_1.NotFoundException(`Product Category with ID ${id} not found`);
        }
    }
    async getActiveCategories() {
        return this.productCategoryModel
            .find({ isActive: true })
            .sort({ order: 1 })
            .exec();
    }
    async updateProductCount(id, count) {
        const updatedCategory = await this.productCategoryModel
            .findByIdAndUpdate(id, { productCount: count }, { new: true })
            .exec();
        if (!updatedCategory) {
            throw new common_1.NotFoundException(`Product Category with ID ${id} not found`);
        }
        return updatedCategory;
    }
    async updateOrder(id, newOrder) {
        const updatedCategory = await this.productCategoryModel
            .findByIdAndUpdate(id, { order: newOrder }, { new: true })
            .exec();
        if (!updatedCategory) {
            throw new common_1.NotFoundException(`Product Category with ID ${id} not found`);
        }
        return updatedCategory;
    }
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
    async getTotalProductCount() {
        const categories = await this.productCategoryModel.find({ productCount: { $exists: true, $ne: null } });
        return categories.reduce((acc, category) => acc + (category.productCount || 0), 0);
    }
    async seedSampleData() {
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
};
exports.ProductCategoryService = ProductCategoryService;
exports.ProductCategoryService = ProductCategoryService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(product_category_schema_1.ProductCategory.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], ProductCategoryService);
//# sourceMappingURL=product-category.service.js.map