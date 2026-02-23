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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductCategorySchema = exports.ProductCategory = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let ProductCategory = class ProductCategory {
};
exports.ProductCategory = ProductCategory;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, trim: true }),
    __metadata("design:type", String)
], ProductCategory.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], ProductCategory.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '#3498db' }),
    __metadata("design:type", String)
], ProductCategory.prototype, "color", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '📦' }),
    __metadata("design:type", String)
], ProductCategory.prototype, "icon", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], ProductCategory.prototype, "isActive", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 1 }),
    __metadata("design:type", Number)
], ProductCategory.prototype, "order", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], ProductCategory.prototype, "code", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], ProductCategory.prototype, "productCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], ProductCategory.prototype, "notes", void 0);
exports.ProductCategory = ProductCategory = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], ProductCategory);
exports.ProductCategorySchema = mongoose_1.SchemaFactory.createForClass(ProductCategory);
exports.ProductCategorySchema.index({ isActive: 1 });
exports.ProductCategorySchema.index({ order: 1 });
//# sourceMappingURL=product-category.schema.js.map