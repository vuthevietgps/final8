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
var ApiTokenScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiTokenScheduler = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const api_token_schema_1 = require("./schemas/api-token.schema");
const api_token_service_1 = require("./api-token.service");
let ApiTokenScheduler = ApiTokenScheduler_1 = class ApiTokenScheduler {
    constructor(model, tokenService) {
        this.model = model;
        this.tokenService = tokenService;
        this.logger = new common_1.Logger(ApiTokenScheduler_1.name);
    }
    async periodicValidate() {
        try {
            await this.tokenService.syncFromFanpages();
        }
        catch (_a) { }
        const now = new Date();
        const cutoff = new Date(Date.now() - 30 * 60 * 1000);
        const candidates = await this.model.find({
            status: 'active',
            $and: [
                { $or: [
                        { nextCheckAt: { $exists: true, $ne: null, $lte: now } },
                        { nextCheckAt: { $exists: false } },
                        { nextCheckAt: null }
                    ] },
                { $or: [
                        { lastCheckedAt: { $exists: false } },
                        { lastCheckedAt: { $lt: cutoff } },
                        { nextCheckAt: { $exists: true, $ne: null, $lte: now } }
                    ] }
            ]
        }).limit(50);
        for (const c of candidates) {
            try {
                await this.tokenService.validate(c._id.toString(), { force: true });
            }
            catch (e) {
                this.logger.warn(`Validate fail ${c._id}: ${e.message}`);
            }
        }
    }
    async markExpiringSoon() {
        const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        const tokens = await this.model.find({ expireAt: { $exists: true, $ne: null, $lt: soon }, status: 'active' }).limit(100);
        for (const t of tokens) {
            if (t.lastCheckMessage && t.lastCheckMessage.includes('[EXPIRING]'))
                continue;
            t.lastCheckMessage = (t.lastCheckMessage ? t.lastCheckMessage + ' ' : '') + '[EXPIRING] Token sắp hết hạn';
            await t.save();
        }
    }
};
exports.ApiTokenScheduler = ApiTokenScheduler;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_5_MINUTES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ApiTokenScheduler.prototype, "periodicValidate", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ApiTokenScheduler.prototype, "markExpiringSoon", null);
exports.ApiTokenScheduler = ApiTokenScheduler = ApiTokenScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(api_token_schema_1.ApiToken.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        api_token_service_1.ApiTokenService])
], ApiTokenScheduler);
//# sourceMappingURL=api-token.scheduler.js.map