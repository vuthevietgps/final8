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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIConfigService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const openai_config_schema_1 = require("./schemas/openai-config.schema");
let OpenAIConfigService = class OpenAIConfigService {
    constructor(model) {
        this.model = model;
    }
    create(dto) {
        const doc = new this.model(dto);
        return doc.save();
    }
    findAll(filter = {}) {
        return this.model.find(filter).sort({ createdAt: -1 }).lean();
    }
    async findOne(id) {
        try {
            const doc = await this.model.findById(id).lean();
            if (!doc)
                return null;
            return doc;
        }
        catch (error) {
            return null;
        }
    }
    async update(id, dto) {
        const doc = await this.model.findByIdAndUpdate(id, dto, { new: true }).lean();
        if (!doc)
            throw new common_1.NotFoundException('Config không tồn tại');
        return doc;
    }
    async remove(id) {
        const res = await this.model.findByIdAndDelete(id);
        if (!res)
            throw new common_1.NotFoundException('Config không tồn tại');
    }
    async pickConfig(opts) {
        const { fanpageId, adGroupId } = opts;
        if (fanpageId) {
            const fp = await this.model.findOne({ scopeType: 'fanpage', scopeRef: fanpageId, status: 'active' }).sort({ updatedAt: -1 }).lean();
            if (fp)
                return fp;
        }
        if (adGroupId) {
            const ag = await this.model.findOne({ scopeType: 'adgroup', scopeRef: adGroupId, status: 'active' }).sort({ updatedAt: -1 }).lean();
            if (ag)
                return ag;
        }
        const def = await this.model.findOne({ scopeType: 'global', isDefault: true, status: 'active' }).sort({ updatedAt: -1 }).lean();
        if (def)
            return def;
        return this.model.findOne({ scopeType: 'global', status: 'active' }).sort({ updatedAt: -1 }).lean();
    }
    async testKey(dto) {
        const { apiKey, model } = dto;
        if (!apiKey || !apiKey.startsWith('sk-')) {
            return { valid: false, reason: 'API Key không hợp lệ định dạng (phải bắt đầu bằng sk-)' };
        }
        if (apiKey.length < 20) {
            return { valid: false, reason: 'API Key quá ngắn' };
        }
        return {
            valid: true,
            model: model || 'gpt-4o-mini',
            message: 'API Key hợp lệ định dạng cơ bản (chưa xác thực với OpenAI thật)'
        };
    }
};
exports.OpenAIConfigService = OpenAIConfigService;
exports.OpenAIConfigService = OpenAIConfigService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(openai_config_schema_1.OpenAIConfig.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], OpenAIConfigService);
//# sourceMappingURL=openai-config.service.js.map