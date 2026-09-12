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
var SupplierQuoteService_1;
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplierQuoteService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const event_emitter_1 = require("@nestjs/event-emitter");
const advertising_cost_refresh_module_1 = require("../advertising-cost/advertising-cost-refresh.module");
const supplier_quote_schema_1 = require("./schemas/supplier-quote.schema");
let SupplierQuoteService = SupplierQuoteService_1 = class SupplierQuoteService {
    constructor(model, events) {
        this.model = model;
        this.events = events;
        this.logger = new common_1.Logger(SupplierQuoteService_1.name);
    }
    async create(dto, currentUser) {
        var _a, _b, _c;
        const actor = this.actor(currentUser);
        const effectiveAt = dto.effectiveAt ? new Date(dto.effectiveAt) : new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (effectiveAt < today) {
            this.logger.warn(`Creating quote with past effectiveAt: ${effectiveAt.toISOString()}`);
        }
        const doc = await this.model.create({
            productId: new mongoose_2.Types.ObjectId(dto.productId),
            supplierId: new mongoose_2.Types.ObjectId(dto.supplierId),
            price: Number(dto.price),
            currency: dto.currency || 'VND',
            effectiveAt,
            note: dto.note,
            isReturnableOverride: dto.isReturnableOverride,
            shippingFee: (_a = dto.shippingFee) !== null && _a !== void 0 ? _a : 0,
            returnFee: (_b = dto.returnFee) !== null && _b !== void 0 ? _b : 0,
            approvalStatus: 'pending',
            createdBy: actor.id,
            lastCommercialEditedBy: actor.id,
            approvalHistory: [{
                    decision: 'created',
                    actorId: actor.id,
                    actorLabel: actor.label,
                    at: new Date(),
                    reason: 'Quote created and submitted for independent approval.',
                    priceSnapshot: Number(dto.price),
                }],
        });
        this.logger.log(`Created pending SupplierQuote ${String(doc._id)}`);
        await ((_c = this.events) === null || _c === void 0 ? void 0 : _c.emitAsync(advertising_cost_refresh_module_1.FINANCIAL_INPUT_CHANGED, { productIds: [String(doc.productId)] }));
        return this.normalizeQuote(doc.toObject());
    }
    async update(id, dto, currentUser) {
        var _a;
        const doc = await this.loadQuote(id);
        const previousProductId = String(doc.productId);
        const approvalRelevantChanged = (dto.productId !== undefined && String(dto.productId) !== String(doc.productId))
            || (dto.supplierId !== undefined && String(dto.supplierId) !== String(doc.supplierId))
            || (dto.price !== undefined && Number(dto.price) !== Number(doc.price))
            || (dto.currency !== undefined && String(dto.currency).trim().toUpperCase() !== String(doc.currency).trim().toUpperCase())
            || (dto.effectiveAt !== undefined && new Date(dto.effectiveAt).getTime() !== new Date(doc.effectiveAt || 0).getTime())
            || (dto.isReturnableOverride !== undefined && dto.isReturnableOverride !== doc.isReturnableOverride)
            || (dto.shippingFee !== undefined && Number(dto.shippingFee) !== Number(doc.shippingFee || 0))
            || (dto.returnFee !== undefined && Number(dto.returnFee) !== Number(doc.returnFee || 0));
        if (dto.productId !== undefined)
            doc.productId = this.objectId(dto.productId, 'productId');
        if (dto.supplierId !== undefined)
            doc.supplierId = this.objectId(dto.supplierId, 'supplierId');
        if (dto.price !== undefined)
            doc.price = Number(dto.price);
        if (dto.currency !== undefined)
            doc.currency = String(dto.currency || 'VND').trim().toUpperCase();
        if (dto.effectiveAt !== undefined)
            doc.effectiveAt = new Date(dto.effectiveAt);
        if (dto.note !== undefined)
            doc.note = dto.note;
        if (dto.isReturnableOverride !== undefined)
            doc.isReturnableOverride = dto.isReturnableOverride;
        if (dto.shippingFee !== undefined)
            doc.shippingFee = Number(dto.shippingFee);
        if (dto.returnFee !== undefined)
            doc.returnFee = Number(dto.returnFee);
        if (approvalRelevantChanged) {
            const actor = this.actor(currentUser);
            if (!this.validActorId(doc.createdBy))
                doc.createdBy = actor.id;
            doc.lastCommercialEditedBy = actor.id;
            this.appendAudit(doc, {
                decision: 'reset_to_pending',
                actorId: actor.id,
                actorLabel: actor.label,
                at: new Date(),
                reason: 'Quote commercial terms changed; prior approval is no longer valid.',
                priceSnapshot: Number(doc.price),
            });
            doc.approvalStatus = 'pending';
            doc.approvedBy = undefined;
            doc.approvedAt = undefined;
            doc.rejectedBy = undefined;
            doc.rejectedAt = undefined;
            doc.rejectionReason = undefined;
        }
        await this.saveWithConcurrency(doc);
        this.logger.log(`Updated SupplierQuote ${String(doc._id)}${approvalRelevantChanged ? ' and reset approval to pending' : ''}`);
        await ((_a = this.events) === null || _a === void 0 ? void 0 : _a.emitAsync(advertising_cost_refresh_module_1.FINANCIAL_INPUT_CHANGED, { productIds: [previousProductId, String(doc.productId)] }));
        return this.normalizeQuote(doc.toObject());
    }
    async approve(id, currentUser) {
        var _a;
        const doc = await this.loadQuote(id);
        const actor = this.actor(currentUser);
        const selfApproval = String(actor.id) === String(doc.createdBy)
            || String(actor.id) === String(doc.lastCommercialEditedBy);
        const directorApproval = selfApproval && !!await this.model.db.collection('users').findOne({ _id: actor.id, role: 'director', isActive: true }, { projection: { _id: 1 } });
        this.assertIndependentDecisionActor(doc, actor, directorApproval);
        if (this.normalizedStatus(doc.approvalStatus) === 'approved') {
            return this.normalizeQuote(doc.toObject());
        }
        const at = new Date();
        doc.approvalStatus = 'approved';
        doc.approvedBy = actor.id;
        doc.approvedAt = at;
        doc.rejectedBy = undefined;
        doc.rejectedAt = undefined;
        doc.rejectionReason = undefined;
        this.appendAudit(doc, Object.assign(Object.assign({ decision: 'approved', actorId: actor.id, actorLabel: actor.label, at }, (directorApproval ? { reason: 'Director approval of own quote; active director role verified from database.' } : {})), { priceSnapshot: Number(doc.price) }));
        await this.saveWithConcurrency(doc);
        this.logger.log(`Approved SupplierQuote ${String(doc._id)} by user ${String(actor.id)}`);
        await ((_a = this.events) === null || _a === void 0 ? void 0 : _a.emitAsync(advertising_cost_refresh_module_1.FINANCIAL_INPUT_CHANGED, { productIds: [String(doc.productId)] }));
        return this.normalizeQuote(doc.toObject());
    }
    async reject(id, currentUser, reason) {
        var _a;
        const normalizedReason = String(reason || '').trim();
        if (!normalizedReason)
            throw new common_1.BadRequestException('Lý do từ chối là bắt buộc');
        const doc = await this.loadQuote(id);
        const actor = this.actor(currentUser);
        this.assertIndependentDecisionActor(doc, actor);
        const at = new Date();
        doc.approvalStatus = 'rejected';
        doc.rejectedBy = actor.id;
        doc.rejectedAt = at;
        doc.rejectionReason = normalizedReason;
        doc.approvedBy = undefined;
        doc.approvedAt = undefined;
        this.appendAudit(doc, {
            decision: 'rejected',
            actorId: actor.id,
            actorLabel: actor.label,
            at,
            reason: normalizedReason,
            priceSnapshot: Number(doc.price),
        });
        await this.saveWithConcurrency(doc);
        this.logger.log(`Rejected SupplierQuote ${String(doc._id)} by user ${String(actor.id)}`);
        await ((_a = this.events) === null || _a === void 0 ? void 0 : _a.emitAsync(advertising_cost_refresh_module_1.FINANCIAL_INPUT_CHANGED, { productIds: [String(doc.productId)] }));
        return this.normalizeQuote(doc.toObject());
    }
    async claimProvenance(id, currentUser) {
        var _a;
        const doc = await this.loadQuote(id);
        const hasCreator = this.validActorId(doc.createdBy);
        const hasEditor = this.validActorId(doc.lastCommercialEditedBy);
        if (hasCreator && hasEditor) {
            throw new common_1.ConflictException('Quote provenance is already complete');
        }
        const actor = this.actor(currentUser);
        if (!hasCreator)
            doc.createdBy = actor.id;
        if (!hasEditor)
            doc.lastCommercialEditedBy = actor.id;
        doc.approvalStatus = 'pending';
        doc.approvedBy = undefined;
        doc.approvedAt = undefined;
        doc.rejectedBy = undefined;
        doc.rejectedAt = undefined;
        doc.rejectionReason = undefined;
        this.appendAudit(doc, {
            decision: 'provenance_claimed',
            actorId: actor.id,
            actorLabel: actor.label,
            at: new Date(),
            reason: 'Legacy quote provenance claimed; an independent actor must approve or reject.',
            priceSnapshot: Number(doc.price),
        });
        await this.saveWithConcurrency(doc);
        this.logger.log(`Claimed SupplierQuote provenance ${String(doc._id)} by user ${String(actor.id)}`);
        await ((_a = this.events) === null || _a === void 0 ? void 0 : _a.emitAsync(advertising_cost_refresh_module_1.FINANCIAL_INPUT_CHANGED, { productIds: [String(doc.productId)] }));
        return this.normalizeQuote(doc.toObject());
    }
    async findAll(params) {
        const page = Math.max(1, Number(params.page) || 1);
        const limit = Math.max(1, Math.min(200, Number(params.limit) || 50));
        const query = {};
        if (params.productId)
            query.productId = new mongoose_2.Types.ObjectId(params.productId);
        if (params.supplierId)
            query.supplierId = new mongoose_2.Types.ObjectId(params.supplierId);
        if (params.approvalStatus) {
            if (!supplier_quote_schema_1.SUPPLIER_QUOTE_APPROVAL_STATUSES.includes(params.approvalStatus)) {
                throw new common_1.BadRequestException('approvalStatus không hợp lệ');
            }
            if (params.approvalStatus === 'pending') {
                query.$or = [
                    { approvalStatus: 'pending' },
                    { approvalStatus: { $exists: false } },
                ];
            }
            else {
                query.approvalStatus = params.approvalStatus;
            }
        }
        const [total, data] = await Promise.all([
            this.model.countDocuments(query),
            this.model.find(query).sort({ effectiveAt: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        ]);
        return {
            data: data.map((row) => this.normalizeQuote(row)),
            pagination: { page, limit, total, totalPages: total ? Math.ceil(total / limit) : 0 },
        };
    }
    async getLatest(productId, supplierId) {
        const doc = await this.model
            .findOne({ productId: new mongoose_2.Types.ObjectId(productId), supplierId: new mongoose_2.Types.ObjectId(supplierId) })
            .sort({ effectiveAt: -1, createdAt: -1 })
            .lean();
        if (!doc)
            throw new common_1.NotFoundException('Chưa có báo giá');
        return this.normalizeQuote(doc);
    }
    async getEffectiveAt(productId, supplierId, targetDate) {
        const doc = await this.model
            .findOne({
            productId: new mongoose_2.Types.ObjectId(productId),
            supplierId: new mongoose_2.Types.ObjectId(supplierId),
            approvalStatus: 'approved',
            $or: [
                { effectiveAt: { $lte: targetDate } },
                { effectiveAt: { $exists: false }, createdAt: { $lte: targetDate } },
            ],
        })
            .sort({ effectiveAt: -1, createdAt: -1 })
            .lean();
        return doc ? this.normalizeQuote(doc) : null;
    }
    async getPriceHistory(productId, supplierId) {
        const quotes = await this.model
            .find({
            productId: new mongoose_2.Types.ObjectId(productId),
            supplierId: new mongoose_2.Types.ObjectId(supplierId)
        })
            .sort({ effectiveAt: -1, createdAt: -1 })
            .lean();
        if (quotes.length === 0) {
            return {
                history: [],
                stats: {
                    minPrice: 0,
                    maxPrice: 0,
                    avgPrice: 0,
                    currentPrice: 0,
                    quoteCount: 0,
                },
            };
        }
        const prices = quotes.map(q => q.price);
        const currentPrice = quotes[0].price;
        return {
            history: quotes.map(q => ({
                _id: q._id.toString(),
                price: q.price,
                effectiveAt: q.effectiveAt || q.createdAt,
                createdAt: q.createdAt,
                note: q.note,
                approvalStatus: this.normalizedStatus(q.approvalStatus),
            })),
            stats: {
                minPrice: Math.min(...prices),
                maxPrice: Math.max(...prices),
                avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
                currentPrice,
                quoteCount: quotes.length,
            },
        };
    }
    async getSupplierQuotes(supplierId) {
        const result = await this.model.aggregate([
            { $match: { supplierId: new mongoose_2.Types.ObjectId(supplierId) } },
            { $sort: { productId: 1, effectiveAt: -1, createdAt: -1 } },
            {
                $group: {
                    _id: '$productId',
                    latestQuote: { $first: '$$ROOT' },
                    quoteCount: { $sum: 1 },
                },
            },
            {
                $project: {
                    productId: '$_id',
                    currentPrice: '$latestQuote.price',
                    effectiveAt: '$latestQuote.effectiveAt',
                    approvalStatus: { $ifNull: ['$latestQuote.approvalStatus', 'pending'] },
                    quoteCount: 1,
                },
            },
        ]);
        return {
            quotes: result.map(r => ({
                productId: r.productId.toString(),
                currentPrice: r.currentPrice,
                effectiveAt: r.effectiveAt,
                approvalStatus: this.normalizedStatus(r.approvalStatus),
                quoteCount: r.quoteCount,
            })),
            totalProducts: result.length,
        };
    }
    async loadQuote(id) {
        const objectId = this.objectId(id, 'id');
        const doc = await this.model.findById(objectId);
        if (!doc)
            throw new common_1.NotFoundException('Không tìm thấy báo giá nhà cung cấp');
        return doc;
    }
    objectId(value, field) {
        if (!mongoose_2.Types.ObjectId.isValid(value)) {
            throw new common_1.BadRequestException(`${field} không hợp lệ`);
        }
        return new mongoose_2.Types.ObjectId(value);
    }
    actor(currentUser) {
        const rawId = String((currentUser === null || currentUser === void 0 ? void 0 : currentUser.id) || (currentUser === null || currentUser === void 0 ? void 0 : currentUser._id) || '').trim();
        if (!mongoose_2.Types.ObjectId.isValid(rawId)) {
            throw new common_1.BadRequestException('Không xác định được người thực hiện');
        }
        const label = String((currentUser === null || currentUser === void 0 ? void 0 : currentUser.fullName) || (currentUser === null || currentUser === void 0 ? void 0 : currentUser.email) || '').trim().slice(0, 200) || undefined;
        return { id: new mongoose_2.Types.ObjectId(rawId), label };
    }
    validActorId(value) {
        return mongoose_2.Types.ObjectId.isValid(String(value || ''));
    }
    assertIndependentDecisionActor(doc, actor, directorApproval = false) {
        if (!this.validActorId(doc.createdBy) || !this.validActorId(doc.lastCommercialEditedBy)) {
            throw new common_1.ConflictException('Quote lacks trusted provenance. A purchase-costs user must claim provenance or update commercial terms before another user decides it.');
        }
        const actorId = String(actor.id);
        if (!directorApproval && (actorId === String(doc.createdBy) || actorId === String(doc.lastCommercialEditedBy))) {
            throw new common_1.ForbiddenException('Separation of duties requires a different user to approve or reject this quote');
        }
    }
    appendAudit(doc, entry) {
        doc.approvalHistory = [
            ...(doc.approvalHistory || []),
            entry,
        ].slice(-100);
        doc.markModified('approvalHistory');
    }
    async saveWithConcurrency(doc) {
        try {
            await doc.save();
        }
        catch (error) {
            if ((error === null || error === void 0 ? void 0 : error.name) === 'VersionError') {
                throw new common_1.ConflictException('Supplier quote changed concurrently. Reload it and retry the action.');
            }
            throw error;
        }
    }
    normalizedStatus(value) {
        return ['approved', 'rejected'].includes(String(value || '').toLowerCase())
            ? String(value).toLowerCase()
            : 'pending';
    }
    normalizeQuote(row) {
        return Object.assign(Object.assign({}, row), { approvalStatus: this.normalizedStatus(row.approvalStatus), approvalHistory: Array.isArray(row.approvalHistory) ? row.approvalHistory : [], provenanceComplete: this.validActorId(row.createdBy)
                && this.validActorId(row.lastCommercialEditedBy) });
    }
};
exports.SupplierQuoteService = SupplierQuoteService;
exports.SupplierQuoteService = SupplierQuoteService = SupplierQuoteService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(supplier_quote_schema_1.SupplierQuote.name)),
    __metadata("design:paramtypes", [typeof (_a = typeof mongoose_2.Model !== "undefined" && mongoose_2.Model) === "function" ? _a : Object, typeof (_b = typeof event_emitter_1.EventEmitter2 !== "undefined" && event_emitter_1.EventEmitter2) === "function" ? _b : Object])
], SupplierQuoteService);
