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
var Summary5Service_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Summary5Service = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const summary5_schema_1 = require("./schemas/summary5.schema");
const summary4_schema_1 = require("../summary4/schemas/summary4.schema");
const advertising_cost_schema_1 = require("../advertising-cost/schemas/advertising-cost.schema");
const labor_cost1_schema_1 = require("../labor-cost1/schemas/labor-cost1.schema");
const other_cost_schema_1 = require("../other-cost/schemas/other-cost.schema");
const product_schema_1 = require("../product/schemas/product.schema");
const user_schema_1 = require("../user/user.schema");
const user_enum_1 = require("../user/user.enum");
let Summary5Service = Summary5Service_1 = class Summary5Service {
    constructor(s5Model, s4Model, adModel, laborModel, otherModel, productModel, userModel) {
        this.s5Model = s5Model;
        this.s4Model = s4Model;
        this.adModel = adModel;
        this.laborModel = laborModel;
        this.otherModel = otherModel;
        this.productModel = productModel;
        this.userModel = userModel;
        this.logger = new common_1.Logger(Summary5Service_1.name);
    }
    startOfDay(d) {
        const x = new Date(d);
        x.setHours(0, 0, 0, 0);
        return x;
    }
    endOfDay(d) {
        const x = new Date(d);
        x.setHours(23, 59, 59, 999);
        return x;
    }
    async findAll(filter) {
        const q = {};
        if (filter.agentId)
            q.agentId = new mongoose_2.Types.ObjectId(filter.agentId);
        if (filter.productId)
            q.productId = new mongoose_2.Types.ObjectId(filter.productId);
        if (filter.productionStatus)
            q.productionStatus = { $regex: new RegExp(filter.productionStatus, 'i') };
        if (filter.orderStatus)
            q.orderStatus = { $regex: new RegExp(filter.orderStatus, 'i') };
        if (filter.startDate || filter.endDate) {
            q.orderDate = {};
            if (filter.startDate)
                q.orderDate.$gte = this.startOfDay(new Date(filter.startDate));
            if (filter.endDate)
                q.orderDate.$lte = this.endOfDay(new Date(filter.endDate));
        }
        const page = Number(filter.page || 1);
        const limit = Number(filter.limit || 50);
        const sortBy = filter.sortBy || 'orderDate';
        const sortOrder = filter.sortOrder === 'asc' ? 1 : -1;
        const [data, total] = await Promise.all([
            this.s5Model.find(q).sort({ [sortBy]: sortOrder, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            this.s5Model.countDocuments(q),
        ]);
        return { data, total, page, totalPages: Math.ceil(total / limit) };
    }
    async stats(filter) {
        const match = {};
        if (filter.startDate || filter.endDate) {
            match.orderDate = {};
            if (filter.startDate)
                match.orderDate.$gte = this.startOfDay(new Date(filter.startDate));
            if (filter.endDate)
                match.orderDate.$lte = this.endOfDay(new Date(filter.endDate));
        }
        const [res] = await this.s5Model.aggregate([
            { $match: match },
            {
                $group: {
                    _id: null,
                    totalRecords: { $sum: 1 },
                    totalAdCost: { $sum: { $ifNull: ['$adCost', 0] } },
                    totalLaborCost: { $sum: { $ifNull: ['$laborCost', 0] } },
                    totalOtherCost: { $sum: { $ifNull: ['$otherCost', 0] } },
                    totalCostOfGoods: { $sum: { $ifNull: ['$costOfGoods', 0] } },
                    totalRevenue: { $sum: { $ifNull: ['$revenue', 0] } },
                    totalProfit: { $sum: { $ifNull: ['$profit', 0] } },
                },
            },
        ]).exec();
        return res || { totalRecords: 0, totalAdCost: 0, totalLaborCost: 0, totalOtherCost: 0, totalCostOfGoods: 0, totalRevenue: 0, totalProfit: 0 };
    }
    async sync(filter) {
        const q = {};
        if ((filter === null || filter === void 0 ? void 0 : filter.startDate) || (filter === null || filter === void 0 ? void 0 : filter.endDate)) {
            q.orderDate = {};
            if (filter.startDate)
                q.orderDate.$gte = this.startOfDay(new Date(filter.startDate));
            if (filter.endDate)
                q.orderDate.$lte = this.endOfDay(new Date(filter.endDate));
        }
        const s4Rows = await this.s4Model.find(q).lean();
        if (!s4Rows.length)
            return { synced: 0 };
        const productNames = Array.from(new Set(s4Rows.map(r => r.product).filter(Boolean)));
        const products = await this.productModel.find({ name: { $in: productNames } }).lean();
        const productMap = new Map(products.map(p => [p.name, p]));
        const agentNames = Array.from(new Set(s4Rows.map(r => r.agentName).filter(Boolean)));
        const users = await this.userModel.find({ fullName: { $in: agentNames } }).lean();
        const userMap = new Map(users.map(u => [u.fullName, u]));
        const dayKey = (d) => this.startOfDay(new Date(d)).toISOString();
        const rowsByDay = new Map();
        for (const r of s4Rows) {
            const k = dayKey(r.orderDate);
            if (!rowsByDay.has(k))
                rowsByDay.set(k, []);
            rowsByDay.get(k).push(r);
        }
        let synced = 0;
        for (const [k, dayRows] of rowsByDay) {
            const date = new Date(k);
            const totalQtyAll = dayRows.reduce((sum, x) => sum + (x.quantity || 0), 0);
            const adGroupIds = Array.from(new Set(dayRows.map(r => r.adGroupId).filter(Boolean)));
            const adCosts = await this.adModel.aggregate([
                { $match: { adGroupId: { $in: adGroupIds }, date: { $gte: this.startOfDay(date), $lte: this.endOfDay(date) } } },
                { $group: { _id: '$adGroupId', totalSpent: { $sum: { $ifNull: ['$spentAmount', 0] } } } }
            ]).exec();
            const adCostMap = new Map(adCosts.map(x => [x._id, x.totalSpent || 0]));
            const [laborAgg] = await this.laborModel.aggregate([
                { $match: { date: { $gte: this.startOfDay(date), $lte: this.endOfDay(date) } } },
                { $group: { _id: null, total: { $sum: { $ifNull: ['$cost', 0] } } } }
            ]).exec();
            const totalLabor = (laborAgg === null || laborAgg === void 0 ? void 0 : laborAgg.total) || 0;
            const [otherAgg] = await this.otherModel.aggregate([
                { $match: { date: { $gte: this.startOfDay(date), $lte: this.endOfDay(date) } } },
                { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } }
            ]).exec();
            const totalOther = (otherAgg === null || otherAgg === void 0 ? void 0 : otherAgg.total) || 0;
            const totalProductCountByAdGroup = new Map();
            for (const gid of adGroupIds) {
                const rows = dayRows.filter(r => r.adGroupId === gid);
                const count = rows.reduce((sum, r) => sum + (r.quantity || 0), 0);
                totalProductCountByAdGroup.set(gid, count || 1);
            }
            for (const row of dayRows) {
                const qty = row.quantity || 0;
                const gid = row.adGroupId || '0';
                const adSpent = adCostMap.get(gid) || 0;
                const groupQtyTotal = totalProductCountByAdGroup.get(gid) || qty || 1;
                const adCost = (adSpent / groupQtyTotal) * qty;
                const laborCost = totalQtyAll ? (totalLabor / totalQtyAll) * qty : 0;
                const otherCost = totalQtyAll ? (totalOther / totalQtyAll) * qty : 0;
                const prod = productMap.get(row.product);
                const importPrice = (prod === null || prod === void 0 ? void 0 : prod.importPrice) || 0;
                const costOfGoods = row.productionStatus === 'Đã trả kết quả' ? importPrice * qty : 0;
                const user = userMap.get(row.agentName);
                let revenue = 0;
                if ((user === null || user === void 0 ? void 0 : user.role) === user_enum_1.UserRole.EXTERNAL_AGENT && row.productionStatus === 'Đã trả kết quả') {
                    revenue = (row.approvedQuotePrice || 0) * qty;
                }
                else if (user === null || user === void 0 ? void 0 : user.role) {
                    const role = String(user.role).toLowerCase();
                    const internalRoles = new Set(['internal_agent', 'internal_manager', 'director', 'manager', 'employee']);
                    if (internalRoles.has(role)) {
                        if (row.orderStatus === 'Giao thành công')
                            revenue = row.codAmount || 0;
                    }
                }
                const profit = revenue - costOfGoods - otherCost - laborCost - adCost;
                const doc = {
                    orderDate: row.orderDate,
                    customerName: row.customerName,
                    product: row.product,
                    quantity: row.quantity,
                    agentName: row.agentName,
                    adGroupId: row.adGroupId,
                    isActive: row.isActive,
                    serviceDetails: row.serviceDetails,
                    productionStatus: row.productionStatus,
                    orderStatus: row.orderStatus,
                    submitLink: row.submitLink,
                    trackingNumber: row.trackingNumber,
                    depositAmount: row.depositAmount,
                    codAmount: row.codAmount,
                    agentId: row.agentId,
                    productId: row.productId,
                    approvedQuotePrice: row.approvedQuotePrice,
                    mustPayToCompany: row.mustPayToCompany,
                    paidToCompany: row.paidToCompany,
                    manualPayment: row.manualPayment,
                    needToPay: row.needToPay,
                    adCost: Math.round(adCost),
                    laborCost: Math.round(laborCost),
                    otherCost: Math.round(otherCost),
                    costOfGoods: Math.round(costOfGoods),
                    revenue: Math.round(revenue),
                    profit: Math.round(profit),
                };
                await this.s5Model.updateOne({ testOrder2Id: row.testOrder2Id }, { $set: doc, $setOnInsert: { testOrder2Id: row.testOrder2Id } }, { upsert: true });
                synced++;
            }
        }
        return { synced };
    }
    async clearAll() {
        const startTime = Date.now();
        try {
            this.logger.warn('[Summary5Service.clearAll] Starting clear operation...');
            const countBefore = await this.s5Model.countDocuments();
            this.logger.log(`[Summary5Service.clearAll] Found ${countBefore} records to clear`);
            const result = await this.s5Model.deleteMany({});
            const duration = Date.now() - startTime;
            this.logger.log(`[Summary5Service.clearAll] Successfully cleared ${result.deletedCount} records from Summary5 (${duration}ms)`);
            const countAfter = await this.s5Model.countDocuments();
            if (countAfter > 0) {
                this.logger.warn(`[Summary5Service.clearAll] Warning: ${countAfter} records still remain after clear operation`);
            }
            return {
                success: true,
                deletedCount: result.deletedCount,
                message: `Đã xóa thành công ${result.deletedCount} records từ Summary5 (${duration}ms)`
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error(`[Summary5Service.clearAll] Error clearing Summary5 records (${duration}ms):`, {
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            return {
                success: false,
                deletedCount: 0,
                message: `Lỗi khi xóa dữ liệu Summary5 (${duration}ms): ${error.message}`
            };
        }
    }
};
exports.Summary5Service = Summary5Service;
exports.Summary5Service = Summary5Service = Summary5Service_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(summary5_schema_1.Summary5.name)),
    __param(1, (0, mongoose_1.InjectModel)(summary4_schema_1.Summary4.name)),
    __param(2, (0, mongoose_1.InjectModel)(advertising_cost_schema_1.AdvertisingCost.name)),
    __param(3, (0, mongoose_1.InjectModel)(labor_cost1_schema_1.LaborCost1.name)),
    __param(4, (0, mongoose_1.InjectModel)(other_cost_schema_1.OtherCost.name)),
    __param(5, (0, mongoose_1.InjectModel)(product_schema_1.Product.name)),
    __param(6, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], Summary5Service);
//# sourceMappingURL=summary5.service.js.map