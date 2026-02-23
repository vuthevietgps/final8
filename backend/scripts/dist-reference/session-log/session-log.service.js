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
exports.SessionLogService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const session_log_schema_1 = require("./session-log.schema");
let SessionLogService = class SessionLogService {
    constructor(model) {
        this.model = model;
    }
    async logLogin(userId, loginIp) {
        const log = new this.model({ userId, loginAt: new Date(), loginIp });
        return log.save();
    }
    async logLogout(userId) {
        const last = await this.model.findOne({ userId, logoutAt: { $exists: false } }).sort({ loginAt: -1 });
        if (last) {
            last.logoutAt = new Date();
            await last.save();
            return last;
        }
        return null;
    }
    async getUserSessions(userId) {
        return this.model.find({ userId }).sort({ loginAt: -1 }).exec();
    }
    async createDemoSessions() {
        const demoSessions = [
            {
                userId: '68b6fc60fb9017d13093a57f',
                loginAt: new Date('2025-09-07 08:00:00'),
                logoutAt: new Date('2025-09-07 12:00:00'),
                loginIp: '127.0.0.1'
            },
            {
                userId: '68b6fc60fb9017d13093a57f',
                loginAt: new Date('2025-09-07 13:00:00'),
                logoutAt: new Date('2025-09-07 17:30:00'),
                loginIp: '127.0.0.1'
            },
            {
                userId: '68b78688ad578515a6615661',
                loginAt: new Date('2025-09-07 09:00:00'),
                logoutAt: new Date('2025-09-07 18:00:00'),
                loginIp: '192.168.1.100'
            }
        ];
        const created = await this.model.insertMany(demoSessions);
        return { message: `Đã tạo ${created.length} demo session logs`, created: created.length };
    }
};
exports.SessionLogService = SessionLogService;
exports.SessionLogService = SessionLogService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(session_log_schema_1.SessionLog.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], SessionLogService);
//# sourceMappingURL=session-log.service.js.map