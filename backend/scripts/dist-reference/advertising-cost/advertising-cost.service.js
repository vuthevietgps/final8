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
exports.AdvertisingCostService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const XLSX = require("xlsx");
const fs = require("fs");
const advertising_cost_schema_1 = require("./schemas/advertising-cost.schema");
const ad_group_schema_1 = require("../ad-group/schemas/ad-group.schema");
const ad_account_schema_1 = require("../ad-account/schemas/ad-account.schema");
let AdvertisingCostService = class AdvertisingCostService {
    constructor(model, adGroupModel, adAccountModel) {
        this.model = model;
        this.adGroupModel = adGroupModel;
        this.adAccountModel = adAccountModel;
    }
    async create(dto) {
        var _a, _b, _c;
        const payload = {
            adGroupId: dto.adGroupId.trim(),
            frequency: dto.frequency,
            spentAmount: (_a = dto.spentAmount) !== null && _a !== void 0 ? _a : 0,
            cpm: (_b = dto.cpm) !== null && _b !== void 0 ? _b : 0,
            cpc: (_c = dto.cpc) !== null && _c !== void 0 ? _c : 0,
        };
        if (dto.date)
            payload.date = new Date(dto.date);
        const created = new this.model(payload);
        return created.save();
    }
    async findAll(query) {
        let adGroupIdFilter;
        if (query === null || query === void 0 ? void 0 : query.adAccountId) {
            const groups = await this.adGroupModel.find({ adAccountId: query.adAccountId }).select('adGroupId').lean();
            adGroupIdFilter = groups.map(g => g.adGroupId);
            if (adGroupIdFilter.length === 0) {
                return [];
            }
        }
        const findCond = {};
        if (adGroupIdFilter)
            findCond.adGroupId = { $in: adGroupIdFilter };
        const costs = await this.model.find(findCond).sort({ date: -1, createdAt: -1 }).lean();
        if (costs.length === 0)
            return costs;
        const uniqueAdGroupIds = Array.from(new Set(costs.map(c => c.adGroupId)));
        const adGroups = await this.adGroupModel.find({ adGroupId: { $in: uniqueAdGroupIds } })
            .select('adGroupId adAccountId')
            .lean();
        const adAccountIds = Array.from(new Set(adGroups.map(g => String(g.adAccountId))));
        const adAccounts = await this.adAccountModel.find({ _id: { $in: adAccountIds } })
            .select('name accountId')
            .lean();
        const adGroupMap = new Map(adGroups.map(g => [g.adGroupId, g]));
        const adAccountMap = new Map(adAccounts.map(a => [String(a._id), a]));
        return costs.map(c => {
            const grp = adGroupMap.get(c.adGroupId);
            const acc = grp ? adAccountMap.get(String(grp.adAccountId)) : null;
            return Object.assign(Object.assign({}, c), { adAccountId: (grp === null || grp === void 0 ? void 0 : grp.adAccountId) ? String(grp.adAccountId) : undefined, adAccountName: acc === null || acc === void 0 ? void 0 : acc.name, adAccountAccountId: acc === null || acc === void 0 ? void 0 : acc.accountId });
        });
    }
    async findOne(id) {
        const doc = await this.model.findById(id).lean();
        if (!doc)
            throw new common_1.NotFoundException('Không tìm thấy chi phí quảng cáo');
        return doc;
    }
    async update(id, dto) {
        const update = Object.assign({}, dto);
        if (dto.date)
            update.date = new Date(dto.date);
        const doc = await this.model.findByIdAndUpdate(id, update, { new: true }).lean();
        if (!doc)
            throw new common_1.NotFoundException('Không tìm thấy chi phí quảng cáo');
        return doc;
    }
    async remove(id) {
        const res = await this.model.findByIdAndDelete(id);
        if (!res)
            throw new common_1.NotFoundException('Không tìm thấy chi phí quảng cáo');
    }
    async summary() {
        const agg = await this.model.aggregate([
            {
                $group: {
                    _id: null,
                    totalSpent: { $sum: { $ifNull: ['$spentAmount', 0] } },
                    count: { $count: {} },
                    avgCPM: { $avg: { $ifNull: ['$cpm', 0] } },
                    avgCPC: { $avg: { $ifNull: ['$cpc', 0] } },
                },
            },
        ]);
        return agg[0] || { totalSpent: 0, count: 0, avgCPM: 0, avgCPC: 0 };
    }
    async getYesterdaySpentByAdGroups() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const endOfYesterday = new Date(yesterday);
        endOfYesterday.setHours(23, 59, 59, 999);
        console.log(`Querying advertising costs for yesterday: ${yesterday.toISOString()} to ${endOfYesterday.toISOString()}`);
        const results = await this.model
            .find({
            date: {
                $gte: yesterday,
                $lte: endOfYesterday
            }
        })
            .select('adGroupId spentAmount date')
            .lean()
            .exec();
        console.log(`Found ${results.length} advertising cost records for yesterday`);
        const spentMap = {};
        results.forEach(result => {
            const spentAmount = result.spentAmount || 0;
            spentMap[result.adGroupId] = spentAmount;
            console.log(`AdGroup ${result.adGroupId}: spent ${spentAmount} on ${result.date}`);
        });
        return spentMap;
    }
    async processFacebookExcelUpload(file) {
        var _a;
        if (!file) {
            throw new common_1.BadRequestException('Không tìm thấy file Excel');
        }
        const readUploadedFile = () => {
            if (file.buffer && file.buffer.length)
                return file.buffer;
            if (file.path)
                return fs.readFileSync(file.path);
            throw new common_1.BadRequestException('Không đọc được nội dung file (thiếu buffer/path)');
        };
        const excelSerialToDate = (serial) => {
            const utcDays = Math.floor(serial - 25569);
            const utcValue = utcDays * 86400;
            const dateInfo = new Date(utcValue * 1000);
            const fractionalDay = serial - Math.floor(serial);
            const totalSeconds = Math.round(fractionalDay * 86400);
            dateInfo.setSeconds(totalSeconds);
            dateInfo.setMilliseconds(0);
            return dateInfo;
        };
        const parseDate = (v) => {
            if (v === null || v === undefined || v === '')
                return null;
            if (v instanceof Date)
                return v;
            if (typeof v === 'number' && !Number.isNaN(v))
                return excelSerialToDate(v);
            if (typeof v === 'string') {
                const sv = v.trim();
                if (/^\d{4}-\d{2}-\d{2}$/.test(sv))
                    return new Date(sv);
                if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(sv))
                    return new Date(sv);
                const d = new Date(sv);
                if (!isNaN(d.getTime()))
                    return d;
            }
            return null;
        };
        const results = { processed: 0, skipped: 0, created: 0, updated: 0, errors: [] };
        try {
            const buffer = readUploadedFile();
            const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, cellNF: false, cellText: false });
            const sheetName = (_a = workbook.SheetNames) === null || _a === void 0 ? void 0 : _a[0];
            if (!sheetName)
                throw new common_1.BadRequestException('File Excel không có sheet nào');
            const worksheet = workbook.Sheets[sheetName];
            if (!worksheet)
                throw new common_1.BadRequestException('Không thể đọc sheet đầu tiên của file Excel');
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: false });
            if (!rows || rows.length < 2)
                throw new common_1.BadRequestException('File Excel rỗng hoặc thiếu dữ liệu (cần header + ít nhất 1 dòng dữ liệu)');
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0 || !row.some(c => c !== null && c !== undefined && c !== '')) {
                    results.skipped++;
                    continue;
                }
                try {
                    const get = (idx) => (idx < row.length && row[idx] !== '' && row[idx] !== null && row[idx] !== undefined) ? row[idx] : '';
                    const adGroupId = String(get(0)).trim();
                    const rawDate = get(1);
                    const frequency = get(3) !== '' ? Number(get(3)) : undefined;
                    const spentAmount = get(5) !== '' ? Number(get(5)) : 0;
                    const cpc = get(6) !== '' ? Number(get(6)) : 0;
                    const cpm = get(7) !== '' ? Number(get(7)) : 0;
                    if (!adGroupId || rawDate === '') {
                        results.skipped++;
                        results.errors.push(`Dòng ${i + 1}: thiếu ID Nhóm QC hoặc Ngày`);
                        continue;
                    }
                    const date = parseDate(rawDate);
                    if (!date || isNaN(date.getTime())) {
                        results.skipped++;
                        results.errors.push(`Dòng ${i + 1}: ngày không hợp lệ (${rawDate})`);
                        continue;
                    }
                    const startOfDay = new Date(date);
                    startOfDay.setHours(0, 0, 0, 0);
                    const endOfDay = new Date(date);
                    endOfDay.setHours(23, 59, 59, 999);
                    const updateDoc = { adGroupId, date, frequency, spentAmount, cpc, cpm };
                    const existing = await this.model.findOne({ adGroupId, date: { $gte: startOfDay, $lte: endOfDay } });
                    if (existing) {
                        await this.model.findByIdAndUpdate(existing._id, updateDoc);
                        results.updated++;
                    }
                    else {
                        await new this.model(updateDoc).save();
                        results.created++;
                    }
                    results.processed++;
                }
                catch (rowErr) {
                    results.skipped++;
                    results.errors.push(`Dòng ${i + 1}: ${(rowErr === null || rowErr === void 0 ? void 0 : rowErr.message) || rowErr}`);
                }
            }
            return results;
        }
        finally {
            try {
                if (file.path && fs.existsSync(file.path))
                    fs.unlinkSync(file.path);
            }
            catch (_b) { }
        }
    }
};
exports.AdvertisingCostService = AdvertisingCostService;
exports.AdvertisingCostService = AdvertisingCostService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(advertising_cost_schema_1.AdvertisingCost.name)),
    __param(1, (0, mongoose_1.InjectModel)(ad_group_schema_1.AdGroup.name)),
    __param(2, (0, mongoose_1.InjectModel)(ad_account_schema_1.AdAccount.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], AdvertisingCostService);
//# sourceMappingURL=advertising-cost.service.js.map