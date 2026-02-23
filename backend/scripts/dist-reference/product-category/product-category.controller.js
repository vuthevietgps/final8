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
exports.ProductCategoryController = void 0;
const common_1 = require("@nestjs/common");
const product_category_service_1 = require("./product-category.service");
const create_product_category_dto_1 = require("./dto/create-product-category.dto");
const update_product_category_dto_1 = require("./dto/update-product-category.dto");
let ProductCategoryController = class ProductCategoryController {
    constructor(productCategoryService) {
        this.productCategoryService = productCategoryService;
    }
    create(createProductCategoryDto) {
        return this.productCategoryService.create(createProductCategoryDto);
    }
    findAll() {
        return this.productCategoryService.findAll();
    }
    getActiveCategories() {
        return this.productCategoryService.getActiveCategories();
    }
    getStatsSummary() {
        return this.productCategoryService.getStatsSummary();
    }
    seedSampleData() {
        return this.productCategoryService.seedSampleData();
    }
    findOne(id) {
        return this.productCategoryService.findOne(id);
    }
    update(id, updateProductCategoryDto) {
        return this.productCategoryService.update(id, updateProductCategoryDto);
    }
    updateProductCount(id, count) {
        return this.productCategoryService.updateProductCount(id, count);
    }
    updateOrder(id, order) {
        return this.productCategoryService.updateOrder(id, order);
    }
    remove(id) {
        return this.productCategoryService.remove(id);
    }
};
exports.ProductCategoryController = ProductCategoryController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_product_category_dto_1.CreateProductCategoryDto]),
    __metadata("design:returntype", void 0)
], ProductCategoryController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductCategoryController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('active'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductCategoryController.prototype, "getActiveCategories", null);
__decorate([
    (0, common_1.Get)('stats/summary'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductCategoryController.prototype, "getStatsSummary", null);
__decorate([
    (0, common_1.Post)('seed'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductCategoryController.prototype, "seedSampleData", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProductCategoryController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_product_category_dto_1.UpdateProductCategoryDto]),
    __metadata("design:returntype", void 0)
], ProductCategoryController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/product-count'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('count')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", void 0)
], ProductCategoryController.prototype, "updateProductCount", null);
__decorate([
    (0, common_1.Patch)(':id/order'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('order')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", void 0)
], ProductCategoryController.prototype, "updateOrder", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProductCategoryController.prototype, "remove", null);
exports.ProductCategoryController = ProductCategoryController = __decorate([
    (0, common_1.Controller)('product-category'),
    __metadata("design:paramtypes", [product_category_service_1.ProductCategoryService])
], ProductCategoryController);
//# sourceMappingURL=product-category.controller.js.map