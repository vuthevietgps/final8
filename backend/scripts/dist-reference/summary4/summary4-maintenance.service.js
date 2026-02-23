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
var Summary4MaintenanceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Summary4MaintenanceService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const summary4_schema_1 = require("./schemas/summary4.schema");
const summary5_service_1 = require("../summary5/summary5.service");
let Summary4MaintenanceService = Summary4MaintenanceService_1 = class Summary4MaintenanceService {
    constructor(summary4Model, summary5Service) {
        this.summary4Model = summary4Model;
        this.summary5Service = summary5Service;
        this.logger = new common_1.Logger(Summary4MaintenanceService_1.name);
    }
    async diagnostics() {
        var _a, _b, _c;
        const dupAgg = await this.summary4Model.aggregate([
            { $addFields: { testOrder2IdStr: { $toString: '$testOrder2Id' } } },
            { $group: { _id: '$testOrder2IdStr', count: { $sum: 1 }, ids: { $push: '$_id' } } },
            { $match: { count: { $gt: 1 } } },
            { $sort: { count: -1 } },
        ]).exec();
        const indexInfo = await ((_c = (_b = (_a = this.summary4Model.collection) === null || _a === void 0 ? void 0 : _a.indexInformation()) === null || _b === void 0 ? void 0 : _b.catch) === null || _c === void 0 ? void 0 : _c.call(_b, () => null));
        const total = await this.summary4Model.countDocuments({}).exec();
        const totalActive = await this.summary4Model.countDocuments({ isActive: true }).exec();
        return { counts: { total, totalActive }, duplicates: dupAgg, indexes: indexInfo, note: 'Nếu có duplicates, hãy gọi POST /summary4/fix-duplicates để dọn.' };
    }
    async fixDuplicates() {
        const dups = await this.summary4Model.aggregate([
            { $addFields: { testOrder2IdStr: { $toString: '$testOrder2Id' } } },
            { $group: { _id: '$testOrder2IdStr', docs: { $push: '$$ROOT' }, count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } },
        ]).exec();
        let removed = 0;
        for (const group of dups) {
            const docs = group.docs;
            const preferred = docs
                .slice()
                .sort((a, b) => {
                if ((b.approvedQuotePrice || 0) !== (a.approvedQuotePrice || 0))
                    return (b.approvedQuotePrice || 0) - (a.approvedQuotePrice || 0);
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            })[0];
            for (const doc of docs) {
                if (String(doc._id) !== String(preferred._id)) {
                    await this.summary4Model.deleteOne({ _id: doc._id }).exec();
                    removed++;
                }
            }
            if (preferred && typeof preferred.testOrder2Id === 'string') {
                await this.summary4Model.updateOne({ _id: preferred._id }, { $set: { testOrder2Id: new mongoose_2.Types.ObjectId(preferred.testOrder2Id) } }).exec();
            }
        }
        try {
            await this.summary4Model.collection.createIndex({ testOrder2Id: 1 }, { unique: true });
        }
        catch (_a) { }
        return { groupsProcessed: dups.length, removed };
    }
    async cleanupOrphanedRecords(options = {}) {
        const { dryRun = true, preserveManualPayment = true } = options;
        this.logger.log(`🧹 Bắt đầu SMART CLEANUP - DryRun: ${dryRun}, PreserveManualPayment: ${preserveManualPayment}`);
        const orphanedRecords = await this.summary4Model.aggregate([
            {
                $lookup: {
                    from: 'ordertest2',
                    let: { testOrder2Id: '$testOrder2Id' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$_id', { $toObjectId: '$$testOrder2Id' }] } } },
                    ],
                    as: 'testOrder2Match',
                },
            },
            { $match: { testOrder2Match: { $size: 0 } } },
            { $project: { _id: 1, testOrder2Id: 1, manualPayment: { $ifNull: ['$manualPayment', 0] }, customerName: 1, agentName: 1, orderDate: 1 } },
        ]).exec();
        this.logger.log(`📊 Tìm thấy ${orphanedRecords.length} records orphaned`);
        const safeToDelete = orphanedRecords.filter((r) => r.manualPayment === 0);
        const needsReview = orphanedRecords.filter((r) => r.manualPayment !== 0);
        this.logger.log(`🟢 An toàn xóa: ${safeToDelete.length} | 🟡 Cần xem xét: ${needsReview.length}`);
        let deleted = 0;
        let deletedRecords = [];
        if (!dryRun) {
            const recordsToDelete = preserveManualPayment ? safeToDelete : orphanedRecords;
            if (recordsToDelete.length > 0) {
                const deleteIds = recordsToDelete.map((r) => r._id);
                const deleteTestOrder2Ids = recordsToDelete.map((r) => r._id);
                const s4 = await this.summary4Model.deleteMany({ _id: { $in: deleteIds } }).exec();
                const s5 = await this.summary5Service['s5Model'].deleteMany({ _id: { $in: deleteTestOrder2Ids } }).exec();
                deleted = s4.deletedCount || 0;
                deletedRecords = recordsToDelete.map((r) => ({ _id: r._id.toString(), testOrder2Id: r.testOrder2Id.toString(), customerName: r.customerName }));
                this.logger.log(`✅ Deleted ${s4.deletedCount} from Summary4 | ${s5.deletedCount} from Summary5`);
            }
        }
        return Object.assign({ totalOrphaned: orphanedRecords.length, safeToDelete: safeToDelete.length, needsReview: needsReview.length, deleted, preservedRecords: needsReview.map((r) => ({ _id: r._id.toString(), testOrder2Id: r.testOrder2Id.toString(), manualPayment: r.manualPayment, customerName: r.customerName, agentName: r.agentName })) }, (deletedRecords.length > 0 && { deletedRecords }));
    }
    async findByTestOrder2Id(testOrder2Id) {
        if (!testOrder2Id)
            return null;
        const isObjectId = mongoose_2.Types.ObjectId.isValid(testOrder2Id);
        const query = isObjectId ? { $or: [{ testOrder2Id: new mongoose_2.Types.ObjectId(testOrder2Id) }, { testOrder2Id: testOrder2Id }] } : { testOrder2Id: testOrder2Id };
        return this.summary4Model.findOne(query).exec();
    }
    async deleteByTestOrder2Id(testOrder2Id) {
        const isObjectId = mongoose_2.Types.ObjectId.isValid(testOrder2Id);
        const query = isObjectId ? { $or: [{ testOrder2Id: new mongoose_2.Types.ObjectId(testOrder2Id) }, { testOrder2Id: testOrder2Id }] } : { testOrder2Id: testOrder2Id };
        const result = await this.summary4Model.deleteOne(query).exec();
        return {
            success: true,
            deletedCount: result.deletedCount || 0,
            message: result.deletedCount && result.deletedCount > 0
                ? `Đã xóa ${result.deletedCount} Summary4 record cho testOrder2Id: ${testOrder2Id}`
                : `Không tìm thấy Summary4 record cho testOrder2Id: ${testOrder2Id}`
        };
    }
    async clearAll() {
        const result = await this.summary4Model.deleteMany({});
        return {
            success: true,
            deletedCount: result.deletedCount || 0,
            message: `Đã xóa thành công ${result.deletedCount || 0} records từ Summary4`
        };
    }
};
exports.Summary4MaintenanceService = Summary4MaintenanceService;
exports.Summary4MaintenanceService = Summary4MaintenanceService = Summary4MaintenanceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(summary4_schema_1.Summary4.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        summary5_service_1.Summary5Service])
], Summary4MaintenanceService);
//# sourceMappingURL=summary4-maintenance.service.js.map