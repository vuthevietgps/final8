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
exports.OrderStatusSchema = exports.OrderStatus = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let OrderStatus = class OrderStatus {
};
exports.OrderStatus = OrderStatus;
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], OrderStatus.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, match: /^#[0-9A-F]{6}$/i }),
    __metadata("design:type", String)
], OrderStatus.prototype, "color", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], OrderStatus.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], OrderStatus.prototype, "order", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], OrderStatus.prototype, "isActive", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], OrderStatus.prototype, "isFinal", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '📦' }),
    __metadata("design:type", String)
], OrderStatus.prototype, "icon", void 0);
exports.OrderStatus = OrderStatus = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], OrderStatus);
exports.OrderStatusSchema = mongoose_1.SchemaFactory.createForClass(OrderStatus);
//# sourceMappingURL=order-status.schema.js.map