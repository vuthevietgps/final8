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
exports.ProductSchema = exports.Product = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let Product = class Product {
};
exports.Product = Product;
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], Product.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'ProductCategory', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Product.prototype, "categoryId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 0 }),
    __metadata("design:type", Number)
], Product.prototype, "importPrice", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 0 }),
    __metadata("design:type", Number)
], Product.prototype, "shippingCost", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 0 }),
    __metadata("design:type", Number)
], Product.prototype, "packagingCost", void 0);
__decorate([
    (0, mongoose_1.Prop)({ min: 0, default: 10 }),
    __metadata("design:type", Number)
], Product.prototype, "minStock", void 0);
__decorate([
    (0, mongoose_1.Prop)({ min: 0, default: 100 }),
    __metadata("design:type", Number)
], Product.prototype, "maxStock", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 0, default: 0 }),
    __metadata("design:type", Number)
], Product.prototype, "estimatedDeliveryDays", void 0);
__decorate([
    (0, mongoose_1.Prop)({ min: 1, default: 12 }),
    __metadata("design:type", Number)
], Product.prototype, "usageDurationMonths", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        required: true,
        enum: ['Hoạt động', 'Tạm dừng'],
        default: 'Hoạt động'
    }),
    __metadata("design:type", String)
], Product.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        default: '#3B82F6',
        match: /^#[0-9A-F]{6}$/i
    }),
    __metadata("design:type", String)
], Product.prototype, "color", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], Product.prototype, "notes", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], Product.prototype, "resourceLink", void 0);
__decorate([
    (0, mongoose_1.Prop)([{
            url: { type: String, required: true },
            description: { type: String, required: true },
            isMainImage: { type: Boolean, default: false },
            uploadedAt: { type: Date, default: Date.now },
            aiAnalysis: {
                objects: [String],
                colors: [String],
                features: [String],
                keywords: [String],
                confidence: { type: Number, min: 0, max: 1 }
            }
        }]),
    __metadata("design:type", Array)
], Product.prototype, "images", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], Product.prototype, "aiDescription", void 0);
__decorate([
    (0, mongoose_1.Prop)([String]),
    __metadata("design:type", Array)
], Product.prototype, "searchKeywords", void 0);
__decorate([
    (0, mongoose_1.Prop)([{
            fanpageId: { type: mongoose_2.Types.ObjectId, ref: 'Fanpage' },
            customName: String,
            customDescription: String,
            customPrice: Number,
            customImages: { type: [String], default: [] },
            imagePolicy: {
                aspectRatio: { type: String, enum: ['1:1', '4:5', '16:9', 'any'], default: 'any' },
                style: { type: String, enum: ['white', 'lifestyle', 'ugc', 'any'], default: 'any' },
                priorityTags: { type: [String], default: [] },
                forbiddenTags: { type: [String], default: [] }
            },
            variantTags: { type: [String], default: [] },
            isActive: { type: Boolean, default: true },
            priority: { type: Number, default: 0 }
        }]),
    __metadata("design:type", Array)
], Product.prototype, "fanpageVariations", void 0);
__decorate([
    (0, mongoose_1.Prop)({ unique: true, sparse: true }),
    __metadata("design:type", String)
], Product.prototype, "sku", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Product.prototype, "totalCost", void 0);
exports.Product = Product = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Product);
exports.ProductSchema = mongoose_1.SchemaFactory.createForClass(Product);
exports.ProductSchema.pre('save', function () {
    this.totalCost = this.importPrice + this.shippingCost + this.packagingCost;
});
exports.ProductSchema.pre('save', async function () {
    if (!this.sku) {
        const count = await this.constructor.countDocuments();
        this.sku = `SP${String(count + 1).padStart(4, '0')}`;
    }
});
exports.ProductSchema.index({ categoryId: 1 });
exports.ProductSchema.index({ status: 1 });
exports.ProductSchema.index({ createdAt: -1 });
//# sourceMappingURL=product.schema.js.map