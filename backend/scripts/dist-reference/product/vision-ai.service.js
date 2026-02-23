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
var VisionAIService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisionAIService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const product_schema_1 = require("./schemas/product.schema");
const openai_config_service_1 = require("../openai-config/openai-config.service");
const node_fetch_1 = require("node-fetch");
let VisionAIService = VisionAIService_1 = class VisionAIService {
    constructor(productModel, openaiConfigService) {
        this.productModel = productModel;
        this.openaiConfigService = openaiConfigService;
        this.logger = new common_1.Logger(VisionAIService_1.name);
    }
    async analyzeProductImage(imageUrl, configId) {
        var _a, _b, _c, _d;
        try {
            const config = configId
                ? await this.openaiConfigService.findOne(configId)
                : await this.openaiConfigService.pickConfig({});
            if (!config || !config.apiKey || config.apiKey === 'placeholder-key') {
                throw new Error('No valid OpenAI configuration found');
            }
            const prompt = `
      Phân tích sản phẩm trong ảnh này và trả về JSON với format chính xác sau:
      {
        "objects": ["tên_đối_tượng_1", "tên_đối_tượng_2"],
        "colors": ["màu_1", "màu_2"],
        "features": ["tính_năng_1", "tính_năng_2"],
        "keywords": ["từ_khóa_1", "từ_khóa_2"],
        "description": "Mô tả chi tiết sản phẩm bằng tiếng Việt",
        "confidence": 0.85
      }
      
      Hãy tập trung vào:
      - Nhận diện chính xác sản phẩm và thương hiệu
      - Màu sắc chủ đạo
      - Tính năng đặc biệt có thể nhìn thấy
      - Từ khóa tìm kiếm phổ biến
      - Mô tả hấp dẫn cho bán hàng
      `;
            const response = await (0, node_fetch_1.default)('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4-vision-preview',
                    messages: [{
                            role: 'user',
                            content: [
                                { type: 'text', text: prompt },
                                { type: 'image_url', image_url: { url: imageUrl } }
                            ]
                        }],
                    max_tokens: 800,
                    temperature: 0.3
                })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`OpenAI Vision API error: ${((_a = errorData.error) === null || _a === void 0 ? void 0 : _a.message) || 'Unknown error'}`);
            }
            const data = await response.json();
            const content = (_d = (_c = (_b = data.choices) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content;
            if (!content) {
                throw new Error('No content returned from OpenAI Vision API');
            }
            const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
            const analysis = JSON.parse(cleanContent);
            return {
                objects: Array.isArray(analysis.objects) ? analysis.objects : [],
                colors: Array.isArray(analysis.colors) ? analysis.colors : [],
                features: Array.isArray(analysis.features) ? analysis.features : [],
                keywords: Array.isArray(analysis.keywords) ? analysis.keywords : [],
                description: analysis.description || 'Không thể tạo mô tả',
                confidence: typeof analysis.confidence === 'number' ? analysis.confidence : 0.7
            };
        }
        catch (error) {
            this.logger.error('Vision AI analysis failed', error.message);
            return {
                objects: ['sản phẩm'],
                colors: ['đa màu'],
                features: ['chất lượng cao'],
                keywords: ['sản phẩm', 'chất lượng'],
                description: 'Sản phẩm chất lượng cao - cần cập nhật mô tả thủ công',
                confidence: 0.1
            };
        }
    }
    async findSimilarProducts(query, fanpageId, limit = 5) {
        try {
            const queryKeywords = this.extractKeywords(query.toLowerCase());
            if (queryKeywords.length === 0) {
                return [];
            }
            this.logger.debug('Finding products with keywords:', queryKeywords);
            const searchQuery = {
                'fanpageVariations.fanpageId': fanpageId,
                'fanpageVariations.isActive': true,
                status: 'Hoạt động'
            };
            const products = await this.productModel.find(searchQuery)
                .populate('categoryId', 'name')
                .lean();
            const scoredProducts = [];
            for (const product of products) {
                const matchScore = this.calculateMatchScore(product, queryKeywords);
                if (matchScore > 0) {
                    const matchReasons = this.getMatchReasons(product, queryKeywords);
                    scoredProducts.push({
                        product: product,
                        matchScore,
                        matchReasons
                    });
                }
            }
            return scoredProducts
                .sort((a, b) => {
                var _a, _b;
                const priorityA = ((_a = a.product.fanpageVariations
                    .find(v => v.fanpageId.toString() === fanpageId)) === null || _a === void 0 ? void 0 : _a.priority) || 0;
                const priorityB = ((_b = b.product.fanpageVariations
                    .find(v => v.fanpageId.toString() === fanpageId)) === null || _b === void 0 ? void 0 : _b.priority) || 0;
                if (priorityA !== priorityB)
                    return priorityB - priorityA;
                return b.matchScore - a.matchScore;
            })
                .slice(0, limit);
        }
        catch (error) {
            this.logger.error('Product search failed', error.message);
            return [];
        }
    }
    async generateProductDescription(images) {
        if (!images || images.length === 0) {
            return '';
        }
        const allKeywords = new Set();
        const allFeatures = new Set();
        const allColors = new Set();
        images.forEach(img => {
            var _a, _b, _c;
            if (img.aiAnalysis) {
                (_a = img.aiAnalysis.keywords) === null || _a === void 0 ? void 0 : _a.forEach((k) => allKeywords.add(k));
                (_b = img.aiAnalysis.features) === null || _b === void 0 ? void 0 : _b.forEach((f) => allFeatures.add(f));
                (_c = img.aiAnalysis.colors) === null || _c === void 0 ? void 0 : _c.forEach((c) => allColors.add(c));
            }
        });
        let description = '';
        if (allFeatures.size > 0) {
            description += `Tính năng: ${Array.from(allFeatures).join(', ')}. `;
        }
        if (allColors.size > 0) {
            description += `Màu sắc: ${Array.from(allColors).join(', ')}. `;
        }
        return description.trim();
    }
    extractKeywords(text) {
        const productKeywords = [
            'điện thoại', 'phone', 'iphone', 'samsung', 'oppo', 'vivo', 'xiaomi',
            'laptop', 'máy tính', 'computer', 'macbook', 'dell', 'hp', 'asus',
            'tai nghe', 'headphone', 'airpods', 'speaker', 'loa',
            'ốp lưng', 'case', 'bao da', 'miếng dán', 'cường lực',
            'sạc', 'charger', 'cable', 'cáp', 'pin', 'battery',
            'đồng hồ', 'watch', 'apple watch', 'smart watch',
            'quần áo', 'áo', 'quần', 'dress', 'shirt', 'pants',
            'giày', 'dép', 'shoes', 'sneaker', 'sandal',
            'túi', 'bag', 'backpack', 'wallet', 'ví',
            'mỹ phẩm', 'cosmetic', 'skincare', 'makeup',
            'đen', 'trắng', 'đỏ', 'xanh', 'vàng', 'hồng', 'tím', 'nâu',
            'black', 'white', 'red', 'blue', 'green', 'yellow', 'pink'
        ];
        const words = text.toLowerCase()
            .replace(/[^\w\sáàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2);
        return words.filter(word => productKeywords.some(keyword => keyword.includes(word) || word.includes(keyword)));
    }
    calculateMatchScore(product, queryKeywords) {
        var _a, _b;
        let score = 0;
        const searchFields = [
            ((_a = product.name) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '',
            ((_b = product.aiDescription) === null || _b === void 0 ? void 0 : _b.toLowerCase()) || '',
            ...(product.searchKeywords || []).map((k) => k.toLowerCase()),
            ...(product.images || []).flatMap((img) => { var _a, _b; return ((_b = (_a = img.aiAnalysis) === null || _a === void 0 ? void 0 : _a.keywords) === null || _b === void 0 ? void 0 : _b.map((k) => k.toLowerCase())) || []; })
        ];
        const allSearchText = searchFields.join(' ');
        queryKeywords.forEach(keyword => {
            var _a, _b;
            if ((_a = product.name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(keyword)) {
                score += 10;
            }
            else if ((_b = product.searchKeywords) === null || _b === void 0 ? void 0 : _b.some((k) => k.toLowerCase().includes(keyword))) {
                score += 5;
            }
            else if (allSearchText.includes(keyword)) {
                score += 2;
            }
            else if (allSearchText.includes(keyword.substring(0, Math.max(3, keyword.length - 1)))) {
                score += 1;
            }
        });
        return score;
    }
    getMatchReasons(product, queryKeywords) {
        const reasons = [];
        queryKeywords.forEach(keyword => {
            var _a, _b;
            if ((_a = product.name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(keyword)) {
                reasons.push(`Khớp tên sản phẩm: "${keyword}"`);
            }
            else if ((_b = product.searchKeywords) === null || _b === void 0 ? void 0 : _b.some((k) => k.toLowerCase().includes(keyword))) {
                reasons.push(`Khớp từ khóa: "${keyword}"`);
            }
        });
        return reasons.slice(0, 3);
    }
};
exports.VisionAIService = VisionAIService;
exports.VisionAIService = VisionAIService = VisionAIService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(product_schema_1.Product.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        openai_config_service_1.OpenAIConfigService])
], VisionAIService);
//# sourceMappingURL=vision-ai.service.js.map