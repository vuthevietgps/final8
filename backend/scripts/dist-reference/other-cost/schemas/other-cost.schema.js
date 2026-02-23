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
exports.OtherCostSchema = exports.OtherCost = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let OtherCost = class OtherCost {
};
exports.OtherCost = OtherCost;
__decorate([
    (0, mongoose_1.Prop)({ type: Date, required: true }),
    __metadata("design:type", Date)
], OtherCost.prototype, "date", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, required: true, min: 0 }),
    __metadata("design:type", Number)
], OtherCost.prototype, "amount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, trim: true }),
    __metadata("design:type", String)
], OtherCost.prototype, "notes", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, trim: true }),
    __metadata("design:type", String)
], OtherCost.prototype, "documentLink", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], OtherCost.prototype, "createdAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], OtherCost.prototype, "updatedAt", void 0);
exports.OtherCost = OtherCost = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], OtherCost);
exports.OtherCostSchema = mongoose_1.SchemaFactory.createForClass(OtherCost);
exports.OtherCostSchema.index({ date: -1 });
exports.OtherCostSchema.index({ createdAt: -1 });
//# sourceMappingURL=other-cost.schema.js.map