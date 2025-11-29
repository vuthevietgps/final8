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
exports.ApiTokenSchema = exports.ApiToken = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let ApiToken = class ApiToken {
};
exports.ApiToken = ApiToken;
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], ApiToken.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], ApiToken.prototype, "token", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true, required: false }),
    __metadata("design:type", String)
], ApiToken.prototype, "tokenEnc", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true, index: true }),
    __metadata("design:type", String)
], ApiToken.prototype, "tokenHash", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['facebook', 'zalo', 'other'], default: 'facebook', index: true }),
    __metadata("design:type", String)
], ApiToken.prototype, "provider", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['active', 'inactive'], default: 'active' }),
    __metadata("design:type", String)
], ApiToken.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Fanpage' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], ApiToken.prototype, "fanpageId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], ApiToken.prototype, "notes", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false, index: true }),
    __metadata("design:type", Boolean)
], ApiToken.prototype, "isPrimary", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], ApiToken.prototype, "expireAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], ApiToken.prototype, "lastCheckedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['valid', 'invalid', 'expired'], required: false }),
    __metadata("design:type", String)
], ApiToken.prototype, "lastCheckStatus", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], ApiToken.prototype, "lastCheckMessage", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], ApiToken.prototype, "consecutiveFail", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], ApiToken.prototype, "degraded", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'ApiToken' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], ApiToken.prototype, "rotatedFrom", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'ApiToken' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], ApiToken.prototype, "rotatedTo", void 0);
__decorate([
    (0, mongoose_1.Prop)([String]),
    __metadata("design:type", Array)
], ApiToken.prototype, "scopes", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], ApiToken.prototype, "nextCheckAt", void 0);
exports.ApiToken = ApiToken = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], ApiToken);
exports.ApiTokenSchema = mongoose_1.SchemaFactory.createForClass(ApiToken);
exports.ApiTokenSchema.index({ provider: 1, status: 1 });
exports.ApiTokenSchema.index({ fanpageId: 1, isPrimary: 1 });
exports.ApiTokenSchema.index({ nextCheckAt: 1 });
//# sourceMappingURL=api-token.schema.js.map