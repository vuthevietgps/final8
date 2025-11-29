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
exports.QuoteService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const quote_schema_1 = require("./schemas/quote.schema");
const product_schema_1 = require("../product/schemas/product.schema");
const google_sync_service_1 = require("../google-sync/google-sync.service");
let QuoteService = class QuoteService {
    constructor(quoteModel, productModel, googleSync) {
        this.quoteModel = quoteModel;
        this.productModel = productModel;
        this.googleSync = googleSync;
    }
    async create(createQuoteDto) {
        const { applyToAllAgents, productId, unitPrice, status, validFrom, validUntil, notes } = createQuoteDto;
        const productDoc = await this.productModel.findById(productId).exec();
        if (!productDoc) {
            throw new common_1.NotFoundException(`Product with ID ${productId} not found`);
        }
        if (applyToAllAgents) {
            const userModel = this.quoteModel.db.models.User || this.quoteModel.db.model('User');
            const agents = await userModel.find({
                role: {
                    $in: [
                        'external_agent',
                        'internal_agent',
                        'external_supplier',
                        'internal_supplier'
                    ]
                },
                isActive: { $ne: false }
            }).exec();
            if (!agents || agents.length === 0) {
                throw new common_1.NotFoundException('No agents found to apply quotes');
            }
            const quotes = [];
            const createdQuotes = [];
            for (const agent of agents) {
                const existingQuote = await this.quoteModel.findOne({
                    productId: productId,
                    agentId: agent._id,
                    isActive: { $ne: false }
                }).exec();
                if (!existingQuote) {
                    const quoteData = {
                        productId,
                        agentId: agent._id,
                        product: productDoc.name,
                        agentName: agent.fullName,
                        unitPrice,
                        status: status || 'Chờ duyệt',
                        validFrom: new Date(validFrom),
                        validUntil: new Date(validUntil),
                        notes: notes || `Báo giá áp dụng cho tất cả đại lý - ${productDoc.name}`,
                        isActive: true
                    };
                    const createdQuote = new this.quoteModel(quoteData);
                    const saved = await createdQuote.save();
                    quotes.push(saved);
                    createdQuotes.push(saved);
                }
            }
            for (const quote of createdQuotes) {
                const agentId = String(quote.agentId);
                const prodId = String(quote.productId);
            }
            return quotes;
        }
        else {
            if (!createQuoteDto.agentId) {
                throw new Error('Agent ID is required when not applying to all agents');
            }
            let { product, agentName } = createQuoteDto;
            if (!product || !agentName) {
                const userModel = this.quoteModel.db.models.User || this.quoteModel.db.model('User');
                const userDoc = await userModel.findById(createQuoteDto.agentId).exec();
                product = product || (productDoc === null || productDoc === void 0 ? void 0 : productDoc.name) || 'Unknown Product';
                agentName = agentName || (userDoc === null || userDoc === void 0 ? void 0 : userDoc.fullName) || 'Unknown Agent';
            }
            const quoteData = {
                productId: createQuoteDto.productId,
                agentId: createQuoteDto.agentId,
                product,
                agentName,
                unitPrice: createQuoteDto.unitPrice,
                status: createQuoteDto.status || 'Chờ duyệt',
                validFrom: new Date(createQuoteDto.validFrom),
                validUntil: new Date(createQuoteDto.validUntil),
                notes: createQuoteDto.notes
            };
            const createdQuote = new this.quoteModel(quoteData);
            const saved = await createdQuote.save();
            const agentId = String(saved.agentId);
            return saved;
        }
    }
    async findAll(query) {
        const filter = {};
        if (query) {
            const { agentId, productId, status, isActive } = query;
            if (agentId)
                filter.agentId = agentId;
            if (productId)
                filter.productId = productId;
            if (status)
                filter.status = status;
            if (isActive === 'false')
                filter.isActive = false;
            else if (isActive === 'true')
                filter.isActive = true;
        }
        if (filter.isActive === undefined) {
            filter.$or = [{ isActive: true }, { isActive: { $exists: false } }];
        }
        return this.quoteModel
            .find(filter)
            .populate('productId', 'name sku price')
            .populate('agentId', 'fullName email role')
            .sort({ createdAt: -1 })
            .exec();
    }
    async findOne(id) {
        const quote = await this.quoteModel
            .findById(id)
            .populate('productId', 'name sku price')
            .populate('agentId', 'fullName email role')
            .exec();
        if (!quote) {
            throw new common_1.NotFoundException(`Quote with ID ${id} not found`);
        }
        return quote;
    }
    async update(id, updateQuoteDto) {
        var _a, _b;
        const updatedQuote = await this.quoteModel
            .findByIdAndUpdate(id, updateQuoteDto, { new: true })
            .populate('productId', 'name sku price')
            .populate('agentId', 'fullName email role')
            .exec();
        if (!updatedQuote) {
            throw new common_1.NotFoundException(`Quote with ID ${id} not found`);
        }
        const agentId = String(((_a = updatedQuote.agentId) === null || _a === void 0 ? void 0 : _a._id) || updatedQuote.agentId);
        const productId = String(((_b = updatedQuote.productId) === null || _b === void 0 ? void 0 : _b._id) || updatedQuote.productId);
        if (agentId && productId) {
        }
        else if (agentId) {
        }
        return updatedQuote;
    }
    async remove(id) {
        const deletedQuote = await this.quoteModel
            .findByIdAndUpdate(id, { isActive: false }, { new: true })
            .exec();
        if (!deletedQuote) {
            throw new common_1.NotFoundException(`Quote with ID ${id} not found`);
        }
        const agentId = String(deletedQuote.agentId);
        const productId = String(deletedQuote.productId || '');
        if (agentId && productId) {
        }
        else if (agentId) {
        }
        return deletedQuote;
    }
    async findByAgent(agentId) {
        return this.quoteModel
            .find({ agentId, isActive: true })
            .populate('productId', 'name sku price')
            .populate('agentId', 'fullName email role')
            .sort({ createdAt: -1 })
            .exec();
    }
    async findByProduct(productId) {
        return this.quoteModel
            .find({ productId, isActive: true })
            .populate('productId', 'name sku price')
            .populate('agentId', 'fullName email role')
            .sort({ createdAt: -1 })
            .exec();
    }
    async getStats() {
        const total = await this.quoteModel.countDocuments({ isActive: true });
        const pending = await this.quoteModel.countDocuments({ status: 'Chờ duyệt', isActive: true });
        const approved = await this.quoteModel.countDocuments({ status: 'Đã duyệt', isActive: true });
        const rejected = await this.quoteModel.countDocuments({ status: 'Từ chối', isActive: true });
        const expired = await this.quoteModel.countDocuments({ status: 'Hết hiệu lực', isActive: true });
        return {
            total,
            pending,
            approved,
            rejected,
            expired,
            approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0
        };
    }
    async diagnostics() {
        var _a, _b, _c;
        const conn = (_a = this.quoteModel.db) === null || _a === void 0 ? void 0 : _a.db;
        let collections = [];
        try {
            collections = ((_c = (await ((_b = conn === null || conn === void 0 ? void 0 : conn.listCollections()) === null || _b === void 0 ? void 0 : _b.toArray()))) === null || _c === void 0 ? void 0 : _c.map((c) => c.name)) || [];
        }
        catch (e) {
            collections = [];
        }
        const totalAll = await this.quoteModel.countDocuments({}).exec();
        const totalVisible = await this.quoteModel.countDocuments({ $or: [{ isActive: true }, { isActive: { $exists: false } }] }).exec();
        const totalInactive = await this.quoteModel.countDocuments({ isActive: false }).exec();
        const statusAgg = await this.quoteModel.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]).exec();
        const sampleAll = await this.quoteModel.find({}).sort({ createdAt: -1 }).limit(5).lean();
        const sampleVisible = await this.quoteModel
            .find({ $or: [{ isActive: true }, { isActive: { $exists: false } }] })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();
        return {
            mongo: {
                collections,
            },
            quotes: {
                counts: {
                    totalAll,
                    totalVisible,
                    totalInactive,
                    byStatus: statusAgg,
                },
                samples: {
                    recentAll: sampleAll,
                    recentVisible: sampleVisible,
                },
                defaultFilter: { $or: [{ isActive: true }, { isActive: { $exists: false } }] },
            },
        };
    }
    async migrateProductAndAgentNames() {
        var _a, _b;
        const result = { processed: 0, updated: 0, errors: [] };
        try {
            const quotes = await this.quoteModel.find({
                $or: [
                    { product: { $exists: false } },
                    { agentName: { $exists: false } },
                    { product: null },
                    { agentName: null },
                    { product: '' },
                    { agentName: '' }
                ]
            })
                .populate('productId', 'name')
                .populate('agentId', 'fullName')
                .exec();
            console.log(`Found ${quotes.length} quotes need migration`);
            for (const quote of quotes) {
                result.processed++;
                try {
                    const product = ((_a = quote.productId) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown Product';
                    const agentName = ((_b = quote.agentId) === null || _b === void 0 ? void 0 : _b.fullName) || 'Unknown Agent';
                    if (product !== quote.product || agentName !== quote.agentName) {
                        await this.quoteModel.findByIdAndUpdate(quote._id, {
                            product,
                            agentName
                        });
                        result.updated++;
                        console.log(`Updated quote ${quote._id}: ${product} - ${agentName}`);
                    }
                }
                catch (error) {
                    result.errors.push(`Quote ${quote._id}: ${error.message}`);
                }
            }
            return result;
        }
        catch (error) {
            result.errors.push(`Migration failed: ${error.message}`);
            return result;
        }
    }
};
exports.QuoteService = QuoteService;
exports.QuoteService = QuoteService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(quote_schema_1.Quote.name)),
    __param(1, (0, mongoose_1.InjectModel)(product_schema_1.Product.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        google_sync_service_1.GoogleSyncService])
], QuoteService);
//# sourceMappingURL=quote.service.js.map