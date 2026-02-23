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
exports.FanpageSchema = exports.Fanpage = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let Fanpage = class Fanpage {
};
exports.Fanpage = Fanpage;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, trim: true }),
    __metadata("design:type", String)
], Fanpage.prototype, "pageId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], Fanpage.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Fanpage.prototype, "accessToken", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['active', 'inactive'], default: 'active', index: true }),
    __metadata("design:type", String)
], Fanpage.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], Fanpage.prototype, "connectedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], Fanpage.prototype, "lastRefreshAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], Fanpage.prototype, "avatarUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Fanpage.prototype, "connectedBy", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'ProductCategory' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Fanpage.prototype, "defaultProductGroup", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], Fanpage.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], Fanpage.prototype, "greetingScript", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], Fanpage.prototype, "clarifyScript", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], Fanpage.prototype, "productSuggestScript", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], Fanpage.prototype, "fallbackScript", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], Fanpage.prototype, "closingScript", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Fanpage.prototype, "subscriberCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 10000 }),
    __metadata("design:type", Number)
], Fanpage.prototype, "messageQuota", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Fanpage.prototype, "sentThisMonth", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Fanpage.prototype, "subscribedWebhook", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Fanpage.prototype, "aiEnabled", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true, default: 'Asia/Ho_Chi_Minh' }),
    __metadata("design:type", String)
], Fanpage.prototype, "timezone", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'OpenAIConfig' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Fanpage.prototype, "openAIConfigId", void 0);
exports.Fanpage = Fanpage = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Fanpage);
exports.FanpageSchema = mongoose_1.SchemaFactory.createForClass(Fanpage);
//# sourceMappingURL=fanpage.schema.js.map