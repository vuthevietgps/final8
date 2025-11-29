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
exports.OpenAIConfigSchema = exports.OpenAIConfig = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let OpenAIConfig = class OpenAIConfig {
};
exports.OpenAIConfig = OpenAIConfig;
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], OpenAIConfig.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], OpenAIConfig.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], OpenAIConfig.prototype, "model", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], OpenAIConfig.prototype, "apiKey", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], OpenAIConfig.prototype, "systemPrompt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], OpenAIConfig.prototype, "maxTokens", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0.7 }),
    __metadata("design:type", Number)
], OpenAIConfig.prototype, "temperature", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['global', 'fanpage', 'adgroup', 'messageScope'], default: 'global', index: true }),
    __metadata("design:type", String)
], OpenAIConfig.prototype, "scopeType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], OpenAIConfig.prototype, "scopeRef", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'active' }),
    __metadata("design:type", String)
], OpenAIConfig.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], OpenAIConfig.prototype, "isDefault", void 0);
exports.OpenAIConfig = OpenAIConfig = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], OpenAIConfig);
exports.OpenAIConfigSchema = mongoose_1.SchemaFactory.createForClass(OpenAIConfig);
exports.OpenAIConfigSchema.index({ scopeType: 1, scopeRef: 1, isDefault: 1 });
//# sourceMappingURL=openai-config.schema.js.map