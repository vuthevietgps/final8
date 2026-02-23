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
exports.AdGroupSchema = exports.AdGroup = exports.DiscountProgram = exports.ChatScript = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let ChatScript = class ChatScript {
};
exports.ChatScript = ChatScript;
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], ChatScript.prototype, "greeting", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], ChatScript.prototype, "upsellHint", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], ChatScript.prototype, "closing", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], ChatScript.prototype, "attributes", void 0);
exports.ChatScript = ChatScript = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], ChatScript);
let DiscountProgram = class DiscountProgram {
};
exports.DiscountProgram = DiscountProgram;
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], DiscountProgram.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, min: 0, max: 100 }),
    __metadata("design:type", Number)
], DiscountProgram.prototype, "percentage", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, min: 0 }),
    __metadata("design:type", Number)
], DiscountProgram.prototype, "fixedAmount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], DiscountProgram.prototype, "conditions", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], DiscountProgram.prototype, "startDate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], DiscountProgram.prototype, "endDate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], DiscountProgram.prototype, "isActive", void 0);
exports.DiscountProgram = DiscountProgram = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], DiscountProgram);
let AdGroup = class AdGroup {
};
exports.AdGroup = AdGroup;
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], AdGroup.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true, unique: true, index: true }),
    __metadata("design:type", String)
], AdGroup.prototype, "adGroupId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Fanpage', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], AdGroup.prototype, "fanpageId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'ProductCategory', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], AdGroup.prototype, "productCategoryId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{ type: mongoose_2.Types.ObjectId, ref: 'Product' }], default: [] }),
    __metadata("design:type", Array)
], AdGroup.prototype, "selectedProducts", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'OpenAIConfig', index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], AdGroup.prototype, "openAIConfigId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], AdGroup.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'AdAccount', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], AdGroup.prototype, "adAccountId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], AdGroup.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: ChatScript }),
    __metadata("design:type", ChatScript)
], AdGroup.prototype, "chatScript", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: DiscountProgram }),
    __metadata("design:type", DiscountProgram)
], AdGroup.prototype, "discount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['facebook', 'google', 'ticktock'], index: true }),
    __metadata("design:type", String)
], AdGroup.prototype, "platform", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true, index: true }),
    __metadata("design:type", Boolean)
], AdGroup.prototype, "isActive", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], AdGroup.prototype, "notes", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], AdGroup.prototype, "enableWebhook", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], AdGroup.prototype, "enableAIChat", void 0);
exports.AdGroup = AdGroup = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], AdGroup);
exports.AdGroupSchema = mongoose_1.SchemaFactory.createForClass(AdGroup);
exports.AdGroupSchema.index({ createdAt: -1 });
exports.AdGroupSchema.index({ fanpageId: 1, isActive: 1 });
exports.AdGroupSchema.index({ enableWebhook: 1, enableAIChat: 1 });
exports.AdGroupSchema.index({ adGroupId: 1, fanpageId: 1 });
//# sourceMappingURL=ad-group.schema.js.map