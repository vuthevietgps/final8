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
exports.LaborCost1Service = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const labor_cost1_schema_1 = require("./schemas/labor-cost1.schema");
const salary_config_schema_1 = require("../salary-config/schemas/salary-config.schema");
const session_log_schema_1 = require("../session-log/session-log.schema");
let LaborCost1Service = class LaborCost1Service {
    constructor(model, salaryModel, sessionLogModel) {
        this.model = model;
        this.salaryModel = salaryModel;
        this.sessionLogModel = sessionLogModel;
    }
    parseTimeToHours(time) {
        const m = time.match(/^(\d{1,2}):(\d{2})$/);
        if (!m)
            throw new common_1.BadRequestException('Sai định dạng giờ. Dùng HH:mm');
        const h = Number(m[1]);
        const min = Number(m[2]);
        if (h < 0 || h > 23 || min < 0 || min > 59)
            throw new common_1.BadRequestException('Giờ/phút không hợp lệ');
        return h + min / 60;
    }
    calcWorkHours(start, end) {
        const s = this.parseTimeToHours(start);
        const e = this.parseTimeToHours(end);
        let diff = e - s;
        if (diff < 0)
            diff += 24;
        return Math.max(0, Number(diff.toFixed(2)));
    }
    startOfDay(d) {
        const x = new Date(d);
        x.setHours(0, 0, 0, 0);
        return x;
    }
    async create(dto) {
        var _a;
        const userId = new mongoose_2.Types.ObjectId(dto.userId);
        const date = this.startOfDay(new Date(dto.date));
        const workHours = this.calcWorkHours(dto.startTime, dto.endTime);
        const salary = await this.salaryModel.findOne({ userId }).exec();
        const hourlyRate = (_a = salary === null || salary === void 0 ? void 0 : salary.hourlyRate) !== null && _a !== void 0 ? _a : 0;
        const cost = Number((workHours * hourlyRate).toFixed(2));
        const doc = await this.model.create({
            date,
            userId,
            startTime: dto.startTime,
            endTime: dto.endTime,
            workHours,
            hourlyRate,
            cost,
            notes: dto.notes,
        });
        return doc;
    }
    async findAll() {
        return this.model
            .find()
            .populate('userId', 'fullName email role')
            .sort({ date: -1, createdAt: -1 })
            .exec();
    }
    async update(id, dto) {
        var _a, _b, _c, _d;
        const existing = await this.model.findById(id).exec();
        if (!existing)
            throw new common_1.NotFoundException('Bản ghi không tồn tại');
        const patch = {};
        if (dto.date)
            patch.date = this.startOfDay(new Date(dto.date));
        if (dto.userId)
            patch.userId = new mongoose_2.Types.ObjectId(dto.userId);
        if (dto.startTime !== undefined)
            patch.startTime = dto.startTime;
        if (dto.endTime !== undefined)
            patch.endTime = dto.endTime;
        if (dto.notes !== undefined)
            patch.notes = dto.notes;
        const newStart = (_a = patch.startTime) !== null && _a !== void 0 ? _a : existing.startTime;
        const newEnd = (_b = patch.endTime) !== null && _b !== void 0 ? _b : existing.endTime;
        const newUser = (_c = patch.userId) !== null && _c !== void 0 ? _c : existing.userId;
        const workHours = this.calcWorkHours(newStart, newEnd);
        const salary = await this.salaryModel.findOne({ userId: newUser }).exec();
        const hourlyRate = (_d = salary === null || salary === void 0 ? void 0 : salary.hourlyRate) !== null && _d !== void 0 ? _d : existing.hourlyRate;
        const cost = Number((workHours * hourlyRate).toFixed(2));
        patch.workHours = workHours;
        patch.hourlyRate = hourlyRate;
        patch.cost = cost;
        const doc = await this.model.findByIdAndUpdate(id, { $set: patch }, { new: true }).exec();
        return doc;
    }
    async remove(id) {
        await this.model.findByIdAndDelete(id).exec();
    }
    async generateFromSessionLogs(userId, date) {
        var _a;
        const filter = {};
        if (userId)
            filter.userId = new mongoose_2.Types.ObjectId(userId);
        if (date) {
            const targetDate = this.startOfDay(new Date(date));
            const nextDay = new Date(targetDate);
            nextDay.setDate(nextDay.getDate() + 1);
            filter.loginAt = { $gte: targetDate, $lt: nextDay };
        }
        const sessions = await this.sessionLogModel
            .find(Object.assign(Object.assign({}, filter), { logoutAt: { $exists: true, $ne: null } }))
            .populate('userId', 'fullName email role')
            .sort({ loginAt: 1 })
            .exec();
        if (sessions.length === 0) {
            return { message: 'Không tìm thấy session logs hoàn chình để tạo labor cost', created: 0 };
        }
        const groupedSessions = new Map();
        for (const session of sessions) {
            const loginDate = this.startOfDay(session.loginAt);
            const userInfo = session.userId;
            const key = `${userInfo._id}_${loginDate.toISOString()}`;
            if (!groupedSessions.has(key)) {
                groupedSessions.set(key, []);
            }
            groupedSessions.get(key).push(session);
        }
        const results = [];
        let created = 0;
        for (const [key, dailySessions] of groupedSessions) {
            const [userIdStr, dateStr] = key.split('_');
            const workDate = new Date(dateStr);
            const userId = new mongoose_2.Types.ObjectId(userIdStr);
            const existing = await this.model.findOne({
                userId,
                date: workDate
            }).exec();
            if (existing) {
                results.push({
                    userId: userIdStr,
                    date: workDate,
                    status: 'skipped',
                    reason: 'Đã tồn tại labor-cost1 cho ngày này'
                });
                continue;
            }
            const firstLogin = dailySessions[0].loginAt;
            const lastLogout = dailySessions[dailySessions.length - 1].logoutAt;
            const startTime = this.formatTime(firstLogin);
            const endTime = this.formatTime(lastLogout);
            let totalWorkHours = 0;
            for (const session of dailySessions) {
                const sessionStart = session.loginAt;
                const sessionEnd = session.logoutAt;
                const sessionHours = (sessionEnd.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
                totalWorkHours += sessionHours;
            }
            totalWorkHours = Number(totalWorkHours.toFixed(2));
            const salary = await this.salaryModel.findOne({ userId }).exec();
            const hourlyRate = (_a = salary === null || salary === void 0 ? void 0 : salary.hourlyRate) !== null && _a !== void 0 ? _a : 0;
            const cost = Number((totalWorkHours * hourlyRate).toFixed(2));
            try {
                const laborCost = await this.model.create({
                    date: workDate,
                    userId,
                    startTime,
                    endTime,
                    workHours: totalWorkHours,
                    hourlyRate,
                    cost,
                    notes: `Tự động tạo từ ${dailySessions.length} session(s)`
                });
                results.push({
                    userId: userIdStr,
                    userName: dailySessions[0].userId.fullName,
                    date: workDate,
                    startTime,
                    endTime,
                    workHours: totalWorkHours,
                    hourlyRate,
                    cost,
                    sessionsCount: dailySessions.length,
                    status: 'created',
                    id: laborCost._id
                });
                created++;
            }
            catch (error) {
                results.push({
                    userId: userIdStr,
                    date: workDate,
                    status: 'error',
                    error: error.message
                });
            }
        }
        return {
            message: `Đã tạo ${created} labor-cost1 records từ session logs`,
            created,
            total: results.length,
            results
        };
    }
    formatTime(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
};
exports.LaborCost1Service = LaborCost1Service;
exports.LaborCost1Service = LaborCost1Service = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(labor_cost1_schema_1.LaborCost1.name)),
    __param(1, (0, mongoose_1.InjectModel)(salary_config_schema_1.SalaryConfig.name)),
    __param(2, (0, mongoose_1.InjectModel)(session_log_schema_1.SessionLog.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], LaborCost1Service);
//# sourceMappingURL=labor-cost1.service.js.map