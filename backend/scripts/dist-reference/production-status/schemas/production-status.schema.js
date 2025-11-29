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
exports.ProductionStatusSchema = exports.ProductionStatus = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let ProductionStatus = class ProductionStatus {
};
exports.ProductionStatus = ProductionStatus;
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], ProductionStatus.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, match: /^#[0-9A-F]{6}$/i }),
    __metadata("design:type", String)
], ProductionStatus.prototype, "color", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], ProductionStatus.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], ProductionStatus.prototype, "order", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], ProductionStatus.prototype, "isActive", void 0);
exports.ProductionStatus = ProductionStatus = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], ProductionStatus);
exports.ProductionStatusSchema = mongoose_1.SchemaFactory.createForClass(ProductionStatus);
//# sourceMappingURL=production-status.schema.js.map