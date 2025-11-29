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
exports.InventoryService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const inventory_summary_schema_1 = require("./schemas/inventory-summary.schema");
const inventory_transaction_schema_1 = require("./schemas/inventory-transaction.schema");
let InventoryService = class InventoryService {
    constructor(summaryModel, txModel) {
        this.summaryModel = summaryModel;
        this.txModel = txModel;
    }
    async recordReceiveFromPO(poId, supplierId, items) {
        const txs = [];
        for (const it of items) {
            const pid = new mongoose_2.Types.ObjectId(it.productId);
            const qty = Number(it.quantity || 0);
            const price = Number(it.unitPrice || 0);
            if (qty <= 0)
                continue;
            const sum = await this.summaryModel.findOne({ productId: pid });
            const onHand = (sum === null || sum === void 0 ? void 0 : sum.onHand) || 0;
            const avg = (sum === null || sum === void 0 ? void 0 : sum.avgCost) || 0;
            const newOnHand = onHand + qty;
            const newAvg = newOnHand > 0 ? ((onHand * avg) + (qty * price)) / newOnHand : 0;
            if (sum) {
                sum.onHand = newOnHand;
                sum.avgCost = newAvg;
                await sum.save();
            }
            else {
                await this.summaryModel.create({ productId: pid, onHand: newOnHand, avgCost: newAvg });
            }
            txs.push({
                productId: pid,
                type: 'receive',
                quantity: qty,
                unitCost: price,
                purchaseOrderId: new mongoose_2.Types.ObjectId(poId),
                supplierId: supplierId ? new mongoose_2.Types.ObjectId(supplierId) : undefined,
                occurredAt: new Date(),
                notes: 'Receive from PO',
            });
        }
        if (txs.length)
            await this.txModel.insertMany(txs);
    }
    async adjustStock(productId, quantity, unitCost, notes) {
        const pid = new mongoose_2.Types.ObjectId(productId);
        const sum = await this.summaryModel.findOne({ productId: pid });
        const onHand = (sum === null || sum === void 0 ? void 0 : sum.onHand) || 0;
        let avg = (sum === null || sum === void 0 ? void 0 : sum.avgCost) || 0;
        const qty = Number(quantity || 0);
        if (qty === 0)
            return sum === null || sum === void 0 ? void 0 : sum.toObject();
        const newOnHand = onHand + qty;
        if (qty > 0 && unitCost !== undefined) {
            avg = newOnHand > 0 ? ((onHand * avg) + (qty * unitCost)) / newOnHand : 0;
        }
        if (sum) {
            sum.onHand = newOnHand;
            sum.avgCost = avg;
            await sum.save();
        }
        else {
            await this.summaryModel.create({ productId: pid, onHand: newOnHand, avgCost: qty > 0 ? (unitCost || 0) : 0 });
        }
        await this.txModel.create({ productId: pid, type: 'adjust', quantity: qty, unitCost, occurredAt: new Date(), notes });
        return this.summaryModel.findOne({ productId: pid }).lean();
    }
    async listSummary(params) {
        var _a, _b, _c;
        const page = Math.max(1, Number(params.page || 1));
        const limit = Math.max(1, Math.min(100, Number(params.limit || 20)));
        const skip = (page - 1) * limit;
        const q = (_a = params.q) === null || _a === void 0 ? void 0 : _a.trim();
        const pipeline = [
            { $lookup: { from: 'products', localField: 'productId', foreignField: '_id', as: 'product' } },
            { $unwind: '$product' },
        ];
        if (q) {
            pipeline.push({ $match: { 'product.name': { $regex: q, $options: 'i' } } });
        }
        pipeline.push({ $sort: { updatedAt: -1 } }, { $facet: { data: [{ $skip: skip }, { $limit: limit }], total: [{ $count: 'c' }] } }, { $project: { data: 1, total: { $ifNull: [{ $arrayElemAt: ['$total.c', 0] }, 0] } } });
        const agg = await this.summaryModel.aggregate(pipeline);
        const total = ((_b = agg === null || agg === void 0 ? void 0 : agg[0]) === null || _b === void 0 ? void 0 : _b.total) || 0;
        const data = (((_c = agg === null || agg === void 0 ? void 0 : agg[0]) === null || _c === void 0 ? void 0 : _c.data) || []).map((row) => {
            var _a;
            return ({
                productId: row.productId,
                productName: (_a = row.product) === null || _a === void 0 ? void 0 : _a.name,
                onHand: row.onHand,
                avgCost: row.avgCost,
                updatedAt: row.updatedAt,
            });
        });
        return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }
    async listTransactions(productId, params) {
        const page = Math.max(1, Number(params.page || 1));
        const limit = Math.max(1, Math.min(100, Number(params.limit || 20)));
        const skip = (page - 1) * limit;
        const pid = new mongoose_2.Types.ObjectId(productId);
        const [data, total] = await Promise.all([
            this.txModel.find({ productId: pid }).sort({ occurredAt: -1 }).skip(skip).limit(limit).lean(),
            this.txModel.countDocuments({ productId: pid }),
        ]);
        return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }
};
exports.InventoryService = InventoryService;
exports.InventoryService = InventoryService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(inventory_summary_schema_1.InventorySummary.name)),
    __param(1, (0, mongoose_1.InjectModel)(inventory_transaction_schema_1.InventoryTransaction.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], InventoryService);
//# sourceMappingURL=inventory.service.js.map