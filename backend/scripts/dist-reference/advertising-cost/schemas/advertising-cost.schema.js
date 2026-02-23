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
exports.AdvertisingCostSchema = exports.AdvertisingCost = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let AdvertisingCost = class AdvertisingCost {
};
exports.AdvertisingCost = AdvertisingCost;
__decorate([
    (0, mongoose_1.Prop)({ type: Date, required: true, default: () => new Date() }),
    __metadata("design:type", Date)
], AdvertisingCost.prototype, "date", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, required: false }),
    __metadata("design:type", Number)
], AdvertisingCost.prototype, "frequency", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true, index: true, trim: true }),
    __metadata("design:type", String)
], AdvertisingCost.prototype, "adGroupId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, required: false, default: 0 }),
    __metadata("design:type", Number)
], AdvertisingCost.prototype, "spentAmount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, required: false, default: 0 }),
    __metadata("design:type", Number)
], AdvertisingCost.prototype, "cpm", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, required: false, default: 0 }),
    __metadata("design:type", Number)
], AdvertisingCost.prototype, "cpc", void 0);
exports.AdvertisingCost = AdvertisingCost = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], AdvertisingCost);
exports.AdvertisingCostSchema = mongoose_1.SchemaFactory.createForClass(AdvertisingCost);
exports.AdvertisingCostSchema.index({ date: -1 });
exports.AdvertisingCostSchema.index({ createdAt: -1 });
//# sourceMappingURL=advertising-cost.schema.js.map