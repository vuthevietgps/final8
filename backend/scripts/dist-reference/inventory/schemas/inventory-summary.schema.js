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
exports.InventorySummarySchema = exports.InventorySummary = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let InventorySummary = class InventorySummary {
};
exports.InventorySummary = InventorySummary;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Product', unique: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], InventorySummary.prototype, "productId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], InventorySummary.prototype, "onHand", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], InventorySummary.prototype, "avgCost", void 0);
exports.InventorySummary = InventorySummary = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], InventorySummary);
exports.InventorySummarySchema = mongoose_1.SchemaFactory.createForClass(InventorySummary);
exports.InventorySummarySchema.index({ onHand: -1 });
//# sourceMappingURL=inventory-summary.schema.js.map