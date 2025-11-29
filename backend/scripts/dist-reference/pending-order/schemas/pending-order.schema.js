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
exports.PendingOrderSchema = exports.PendingOrder = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let PendingOrder = class PendingOrder {
};
exports.PendingOrder = PendingOrder;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Fanpage', index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], PendingOrder.prototype, "fanpageId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], PendingOrder.prototype, "senderPsid", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Product', required: false }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], PendingOrder.prototype, "productId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: false }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], PendingOrder.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], PendingOrder.prototype, "adGroupId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], PendingOrder.prototype, "customerName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], PendingOrder.prototype, "phone", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], PendingOrder.prototype, "address", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 1 }),
    __metadata("design:type", Number)
], PendingOrder.prototype, "quantity", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'draft', enum: ['draft', 'awaiting', 'approved', 'rejected'] }),
    __metadata("design:type", String)
], PendingOrder.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], PendingOrder.prototype, "notes", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, default: Date.now }),
    __metadata("design:type", Date)
], PendingOrder.prototype, "capturedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, required: false }),
    __metadata("design:type", Date)
], PendingOrder.prototype, "orderDate", void 0);
exports.PendingOrder = PendingOrder = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], PendingOrder);
exports.PendingOrderSchema = mongoose_1.SchemaFactory.createForClass(PendingOrder);
exports.PendingOrderSchema.index({ fanpageId: 1, status: 1, createdAt: -1 });
//# sourceMappingURL=pending-order.schema.js.map