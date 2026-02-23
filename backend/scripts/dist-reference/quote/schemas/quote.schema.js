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
exports.QuoteSchema = exports.Quote = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const quote_enum_1 = require("../quote.enum");
let Quote = class Quote {
};
exports.Quote = Quote;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Product', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Quote.prototype, "productId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Quote.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Quote.prototype, "product", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Quote.prototype, "agentName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 0 }),
    __metadata("design:type", Number)
], Quote.prototype, "unitPrice", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        required: true,
        enum: quote_enum_1.QUOTE_STATUS_VALUES,
        default: quote_enum_1.QuoteStatus.PENDING
    }),
    __metadata("design:type", String)
], Quote.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, required: true }),
    __metadata("design:type", Date)
], Quote.prototype, "validFrom", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, required: true }),
    __metadata("design:type", Date)
], Quote.prototype, "validUntil", void 0);
__decorate([
    (0, mongoose_1.Prop)({ maxlength: 500 }),
    __metadata("design:type", String)
], Quote.prototype, "notes", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], Quote.prototype, "isActive", void 0);
exports.Quote = Quote = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Quote);
exports.QuoteSchema = mongoose_1.SchemaFactory.createForClass(Quote);
exports.QuoteSchema.index({ agentId: 1, status: 1 });
exports.QuoteSchema.index({ productId: 1 });
exports.QuoteSchema.index({ validUntil: 1 });
exports.QuoteSchema.index({ agentName: 1, product: 1 });
exports.QuoteSchema.index({ product: 1 });
exports.QuoteSchema.index({ agentName: 1 });
//# sourceMappingURL=quote.schema.js.map