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
exports.FanpageService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const fanpage_schema_1 = require("./schemas/fanpage.schema");
const openai_config_service_1 = require("../openai-config/openai-config.service");
let FanpageService = class FanpageService {
    constructor(model, openaiConfigService) {
        this.model = model;
        this.openaiConfigService = openaiConfigService;
    }
    async create(dto) {
        const exists = await this.model.exists({ pageId: dto.pageId });
        if (exists)
            throw new common_1.BadRequestException('Page ID đã tồn tại');
        const fanpage = new this.model(Object.assign(Object.assign({}, dto), { connectedAt: dto.connectedAt ? new Date(dto.connectedAt) : new Date(), messageQuota: dto.messageQuota || 10000, aiEnabled: dto.openAIConfigId ? true : dto.aiEnabled || false }));
        const savedFanpage = await fanpage.save();
        if (!dto.openAIConfigId) {
            try {
                const description = dto.description || 'fanpage kinh doanh';
                const greetingScript = dto.greetingScript || '';
                const productSuggestScript = dto.productSuggestScript || '';
                let systemPrompt = `Bạn là trợ lý AI thân thiện của fanpage "${dto.name}". `;
                systemPrompt += `Lĩnh vực kinh doanh: ${description}. `;
                if (greetingScript) {
                    systemPrompt += `Lời chào mẫu: "${greetingScript}". `;
                }
                if (productSuggestScript) {
                    systemPrompt += `Hướng dẫn tư vấn: "${productSuggestScript}". `;
                }
                systemPrompt += `Hãy trả lời ngắn gọn (1-2 câu), thân thiện bằng tiếng Việt. `;
                systemPrompt += `Nếu khách hỏi chi tiết cần tư vấn thêm, hãy nói: "Mình đã ghi nhận, nhân viên sẽ hỗ trợ chi tiết sớm nhất!". `;
                systemPrompt += `Không bịa đặt thông tin không có trong mô tả.`;
                const newConfig = await this.openaiConfigService.create({
                    name: `AI Config - ${dto.name}`,
                    model: 'gpt-4o-mini',
                    temperature: 0.7,
                    maxTokens: 256,
                    isDefault: true,
                    scopeType: 'fanpage',
                    scopeRef: savedFanpage._id.toString(),
                    systemPrompt,
                    apiKey: 'placeholder-key'
                });
                await this.model.findByIdAndUpdate(savedFanpage._id, {
                    openAIConfigId: newConfig._id,
                    aiEnabled: true
                });
                savedFanpage.openAIConfigId = newConfig._id;
                savedFanpage.aiEnabled = true;
            }
            catch (error) {
                console.warn('Không thể tạo cấu hình OpenAI mặc định:', error.message);
            }
        }
        return savedFanpage;
    }
    async findAll() {
        const fanpages = await this.model.find().sort({ createdAt: -1 }).lean();
        return fanpages.map(fanpage => (Object.assign(Object.assign({}, fanpage), { accessToken: this.maskAccessToken(fanpage.accessToken), aiEnabled: fanpage.openAIConfigId ? true : (fanpage.aiEnabled || false) })));
    }
    async findOne(id) {
        const doc = await this.model.findById(id).lean();
        if (!doc)
            throw new common_1.NotFoundException('Fanpage không tồn tại');
        return Object.assign(Object.assign({}, doc), { accessToken: this.maskAccessToken(doc.accessToken), aiEnabled: doc.openAIConfigId ? true : (doc.aiEnabled || false) });
    }
    async update(id, dto) {
        const update = Object.assign({}, dto);
        if (dto.connectedAt)
            update.connectedAt = new Date(dto.connectedAt);
        if (dto.lastRefreshAt)
            update.lastRefreshAt = new Date(dto.lastRefreshAt);
        if (dto.openAIConfigId && update.aiEnabled === undefined) {
            update.aiEnabled = true;
        }
        const doc = await this.model.findByIdAndUpdate(id, update, { new: true }).lean();
        if (!doc)
            throw new common_1.NotFoundException('Fanpage không tồn tại');
        return Object.assign(Object.assign({}, doc), { accessToken: this.maskAccessToken(doc.accessToken), aiEnabled: doc.openAIConfigId ? true : (doc.aiEnabled || false) });
    }
    async remove(id) {
        const res = await this.model.findByIdAndDelete(id);
        if (!res)
            throw new common_1.NotFoundException('Fanpage không tồn tại');
    }
    async createAIConfigForExisting(id) {
        const fanpage = await this.model.findById(id);
        if (!fanpage)
            throw new common_1.NotFoundException('Fanpage không tồn tại');
        if (fanpage.openAIConfigId) {
            throw new common_1.BadRequestException('Fanpage đã có config AI');
        }
        try {
            const description = fanpage.description || 'fanpage kinh doanh';
            const greetingScript = fanpage.greetingScript || '';
            const productSuggestScript = fanpage.productSuggestScript || '';
            let systemPrompt = `Bạn là trợ lý AI thân thiện của fanpage "${fanpage.name}". `;
            systemPrompt += `Lĩnh vực kinh doanh: ${description}. `;
            if (greetingScript) {
                systemPrompt += `Lời chào mẫu: "${greetingScript}". `;
            }
            if (productSuggestScript) {
                systemPrompt += `Hướng dẫn tư vấn: "${productSuggestScript}". `;
            }
            systemPrompt += `Hãy trả lời ngắn gọn (1-2 câu), thân thiện bằng tiếng Việt. `;
            systemPrompt += `Nếu khách hỏi chi tiết cần tư vấn thêm, hãy nói: "Mình đã ghi nhận, nhân viên sẽ hỗ trợ chi tiết sớm nhất!". `;
            systemPrompt += `Không bịa đặt thông tin không có trong mô tả.`;
            const config = await this.openaiConfigService.create({
                name: `AI Config - ${fanpage.name}`,
                model: 'gpt-4o-mini',
                temperature: 0.7,
                maxTokens: 256,
                isDefault: true,
                scopeType: 'fanpage',
                scopeRef: fanpage._id.toString(),
                systemPrompt,
                apiKey: 'placeholder-key'
            });
            await this.model.findByIdAndUpdate(id, {
                openAIConfigId: config._id,
                aiEnabled: true
            });
            return config;
        }
        catch (error) {
            throw new common_1.BadRequestException('Không thể tạo config AI: ' + error.message);
        }
    }
    maskAccessToken(token) {
        if (!token || token.length < 8)
            return '****';
        return '*'.repeat(token.length - 4) + token.slice(-4);
    }
    async validateAccessToken(id) {
        const fanpage = await this.model.findById(id).lean();
        if (!fanpage)
            throw new common_1.NotFoundException('Fanpage không tồn tại');
        try {
            const response = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${encodeURIComponent(fanpage.accessToken)}`);
            const result = await response.json();
            if (result.error) {
                return {
                    valid: false,
                    error: `${result.error.message} (Code: ${result.error.code})`
                };
            }
            return {
                valid: true,
                pageInfo: {
                    id: result.id,
                    name: result.name,
                    category: result.category
                }
            };
        }
        catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }
    async refreshAccessToken(id, newAccessToken) {
        if (!(newAccessToken === null || newAccessToken === void 0 ? void 0 : newAccessToken.trim())) {
            throw new common_1.BadRequestException('Access token không được để trống');
        }
        try {
            const response = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${encodeURIComponent(newAccessToken)}`);
            const result = await response.json();
            if (result.error) {
                throw new common_1.BadRequestException(`Token không hợp lệ: ${result.error.message}`);
            }
            await this.model.findByIdAndUpdate(id, {
                accessToken: newAccessToken,
                lastRefreshAt: new Date()
            });
            return {
                success: true,
                message: `Access token đã được cập nhật thành công cho page: ${result.name}`
            };
        }
        catch (error) {
            if (error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException(`Lỗi khi validate token: ${error.message}`);
        }
    }
};
exports.FanpageService = FanpageService;
exports.FanpageService = FanpageService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(fanpage_schema_1.Fanpage.name)),
    __param(1, (0, common_1.Inject)(openai_config_service_1.OpenAIConfigService)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        openai_config_service_1.OpenAIConfigService])
], FanpageService);
//# sourceMappingURL=fanpage.service.js.map