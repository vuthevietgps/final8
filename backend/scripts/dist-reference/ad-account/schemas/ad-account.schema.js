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
exports.AdAccountSchema = exports.AdAccount = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let AdAccount = class AdAccount {
};
exports.AdAccount = AdAccount;
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], AdAccount.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true, unique: true, index: true }),
    __metadata("design:type", String)
], AdAccount.prototype, "accountId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['facebook', 'google', 'tiktok', 'zalo', 'shopee', 'lazada'], index: true }),
    __metadata("design:type", String)
], AdAccount.prototype, "accountType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true, index: true }),
    __metadata("design:type", Boolean)
], AdAccount.prototype, "isActive", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], AdAccount.prototype, "notes", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], AdAccount.prototype, "description", void 0);
exports.AdAccount = AdAccount = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], AdAccount);
exports.AdAccountSchema = mongoose_1.SchemaFactory.createForClass(AdAccount);
exports.AdAccountSchema.index({ createdAt: -1 });
exports.AdAccountSchema.index({ accountType: 1, isActive: 1 });
//# sourceMappingURL=ad-account.schema.js.map