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
var EnhancedApiTokenService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedApiTokenService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const api_token_schema_1 = require("./schemas/api-token.schema");
const fanpage_schema_1 = require("../fanpage/schemas/fanpage.schema");
const node_fetch_1 = require("node-fetch");
let EnhancedApiTokenService = EnhancedApiTokenService_1 = class EnhancedApiTokenService {
    constructor(tokenModel, fanpageModel) {
        this.tokenModel = tokenModel;
        this.fanpageModel = fanpageModel;
        this.logger = new common_1.Logger(EnhancedApiTokenService_1.name);
    }
    async validateWithRecovery(tokenId) {
        const token = await this.tokenModel.findById(tokenId);
        if (!token)
            throw new Error('Token not found');
        const validationResult = await this.validateFacebookToken(token.token);
        if (validationResult.isValid) {
            await this.tokenModel.findByIdAndUpdate(tokenId, {
                lastCheckStatus: 'valid',
                lastCheckMessage: validationResult.message,
                lastCheckedAt: new Date(),
                consecutiveFail: 0,
                nextCheckAt: this.calculateNextCheck()
            });
            return { status: 'valid', message: validationResult.message };
        }
        this.logger.warn(`Token ${tokenId} is invalid, attempting recovery...`);
        const refreshResult = await this.attemptTokenRefresh(token);
        if (refreshResult.success) {
            return { status: 'recovered', message: 'Token refreshed successfully', newToken: refreshResult.token };
        }
        const backupResult = await this.activateBackupToken(String(token.fanpageId));
        if (backupResult.success) {
            return { status: 'failover', message: 'Switched to backup token', activeToken: backupResult.token };
        }
        await this.notifyTokenExpiry(token);
        await this.tokenModel.findByIdAndUpdate(tokenId, {
            lastCheckStatus: 'expired',
            lastCheckMessage: 'Token expired - manual intervention required',
            lastCheckedAt: new Date(),
            consecutiveFail: token.consecutiveFail + 1,
            nextCheckAt: this.calculateNextCheck(true)
        });
        return {
            status: 'expired',
            message: 'Token expired - please refresh manually',
            recoveryMethods: ['manual_refresh', 'oauth_reconnect']
        };
    }
    async attemptTokenRefresh(token) {
        try {
            this.logger.log('Token refresh not implemented yet - requires OAuth integration');
            return { success: false };
        }
        catch (error) {
            this.logger.error('Token refresh failed:', error.message);
            return { success: false };
        }
    }
    async activateBackupToken(fanpageId) {
        try {
            const backupTokens = await this.tokenModel.find({
                fanpageId,
                status: 'active',
                lastCheckStatus: { $in: ['valid', 'unknown'] },
                _id: { $ne: fanpageId }
            }).sort({ lastCheckedAt: -1 });
            if (backupTokens.length > 0) {
                const backupToken = backupTokens[0];
                const validation = await this.validateFacebookToken(backupToken.token);
                if (validation.isValid) {
                    await this.tokenModel.findByIdAndUpdate(backupToken._id, { isPrimary: true });
                    await this.fanpageModel.findByIdAndUpdate(fanpageId, {
                        accessToken: backupToken.token
                    });
                    this.logger.log(`Activated backup token for fanpage ${fanpageId}`);
                    return { success: true, token: backupToken };
                }
            }
            return { success: false };
        }
        catch (error) {
            this.logger.error('Backup token activation failed:', error.message);
            return { success: false };
        }
    }
    async notifyTokenExpiry(token) {
        try {
            const fanpage = await this.fanpageModel.findById(String(token.fanpageId));
            this.logger.warn(`TOKEN EXPIRY NOTIFICATION: Fanpage "${fanpage === null || fanpage === void 0 ? void 0 : fanpage.name}" token expired. Manual refresh required.`);
        }
        catch (error) {
            this.logger.error('Failed to send token expiry notification:', error.message);
        }
    }
    async addBackupToken(fanpageId, token, notes) {
        const validation = await this.validateFacebookToken(token);
        if (!validation.isValid) {
            throw new Error('Backup token is invalid: ' + validation.message);
        }
        const backupToken = new this.tokenModel({
            name: `Backup Token - ${new Date().toISOString()}`,
            token,
            provider: 'facebook',
            fanpageId,
            isPrimary: false,
            notes: notes || 'Backup token for failover',
            status: 'active',
            lastCheckStatus: 'valid',
            lastCheckMessage: validation.message,
            lastCheckedAt: new Date(),
            nextCheckAt: this.calculateNextCheck()
        });
        return await backupToken.save();
    }
    async refreshTokenManually(tokenId, newToken) {
        const validation = await this.validateFacebookToken(newToken);
        if (!validation.isValid) {
            throw new Error('New token is invalid: ' + validation.message);
        }
        const updatedToken = await this.tokenModel.findByIdAndUpdate(tokenId, {
            token: newToken,
            lastCheckStatus: 'valid',
            lastCheckMessage: validation.message,
            lastCheckedAt: new Date(),
            consecutiveFail: 0,
            nextCheckAt: this.calculateNextCheck()
        }, { new: true });
        if (updatedToken.isPrimary) {
            await this.fanpageModel.findByIdAndUpdate(String(updatedToken.fanpageId), {
                accessToken: newToken
            });
        }
        this.logger.log(`Token ${tokenId} refreshed manually`);
        return updatedToken;
    }
    calculateNextCheck(isFailed = false) {
        const now = new Date();
        let minutes;
        if (isFailed) {
            minutes = Math.floor(Math.random() * 60) + 60;
        }
        else {
            minutes = Math.floor(Math.random() * 3) + 27;
        }
        return new Date(now.getTime() + minutes * 60 * 1000);
    }
    async validateFacebookToken(token) {
        var _a;
        try {
            const response = await (0, node_fetch_1.default)(`https://graph.facebook.com/me?access_token=${token}`);
            const data = await response.json();
            if (response.ok && data.id) {
                return {
                    isValid: true,
                    message: `Token hợp lệ cho ${data.name || 'Facebook User'}`
                };
            }
            else {
                return {
                    isValid: false,
                    message: ((_a = data.error) === null || _a === void 0 ? void 0 : _a.message) || 'Token không hợp lệ'
                };
            }
        }
        catch (error) {
            return {
                isValid: false,
                message: 'Lỗi kết nối khi validate token: ' + error.message
            };
        }
    }
};
exports.EnhancedApiTokenService = EnhancedApiTokenService;
exports.EnhancedApiTokenService = EnhancedApiTokenService = EnhancedApiTokenService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(api_token_schema_1.ApiToken.name)),
    __param(1, (0, mongoose_1.InjectModel)(fanpage_schema_1.Fanpage.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], EnhancedApiTokenService);
exports.default = EnhancedApiTokenService;
//# sourceMappingURL=enhanced-api-token.service.js.map