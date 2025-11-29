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
exports.ApiTokenService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const api_token_schema_1 = require("./schemas/api-token.schema");
const api_token_audit_schema_1 = require("./schemas/api-token-audit.schema");
const fanpage_schema_1 = require("../fanpage/schemas/fanpage.schema");
const crypto_util_1 = require("./crypto.util");
class FacebookValidator {
    async validate(rawToken) {
        try {
            const response = await fetch(`https://graph.facebook.com/me?fields=id,name&access_token=${encodeURIComponent(rawToken)}`);
            const data = await response.json();
            if (response.ok && data.id) {
                try {
                    const permResponse = await fetch(`https://graph.facebook.com/me/permissions?access_token=${encodeURIComponent(rawToken)}`);
                    const permData = await permResponse.json();
                    const scopes = permResponse.ok && permData.data ?
                        permData.data.filter((p) => p.status === 'granted').map((p) => p.permission) : [];
                    return {
                        status: 'valid',
                        message: `Token hợp lệ cho ${data.name || data.id}`,
                        scopes
                    };
                }
                catch (_a) {
                    return {
                        status: 'valid',
                        message: `Token hợp lệ cho ${data.name || data.id}`,
                        scopes: []
                    };
                }
            }
            else if (data.error) {
                const errorCode = data.error.code;
                const errorMessage = data.error.message;
                if (errorCode === 190) {
                    return { status: 'expired', message: `Token hết hạn: ${errorMessage}` };
                }
                else if (errorCode === 102 || errorCode === 2500) {
                    return { status: 'invalid', message: `Token không hợp lệ: ${errorMessage}` };
                }
                else {
                    return { status: 'invalid', message: `Lỗi Facebook API: ${errorMessage}` };
                }
            }
            else {
                return { status: 'invalid', message: 'Token không hợp lệ - không nhận được phản hồi từ Facebook' };
            }
        }
        catch (error) {
            return {
                status: 'invalid',
                message: `Lỗi kết nối Facebook API: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}
class ZaloValidator {
    async validate(rawToken) {
        try {
            const response = await fetch(`https://openapi.zalo.me/v2.0/me?access_token=${encodeURIComponent(rawToken)}`);
            const data = await response.json();
            if (response.ok && data.id) {
                return {
                    status: 'valid',
                    message: `Zalo token hợp lệ cho ${data.name || data.id}`,
                    scopes: []
                };
            }
            else if (data.error) {
                return { status: 'invalid', message: `Zalo API error: ${data.error.message || data.error}` };
            }
            else {
                return { status: 'invalid', message: 'Zalo token không hợp lệ' };
            }
        }
        catch (error) {
            return {
                status: 'invalid',
                message: `Lỗi kết nối Zalo API: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}
class OtherValidator {
    async validate(rawToken) {
        if (!rawToken || rawToken.length < 10) {
            return { status: 'invalid', message: 'Token quá ngắn hoặc không hợp lệ' };
        }
        return {
            status: 'valid',
            message: 'Token được chấp nhận (chưa xác thực với provider)',
            scopes: []
        };
    }
}
function buildValidator(provider) {
    switch (provider) {
        case 'facebook': return new FacebookValidator();
        case 'zalo': return new ZaloValidator();
        default: return new OtherValidator();
    }
}
let ApiTokenService = class ApiTokenService {
    constructor(model, auditModel, fanpageModel) {
        this.model = model;
        this.auditModel = auditModel;
        this.fanpageModel = fanpageModel;
    }
    async create(dto) {
        const tokenHash = (0, crypto_util_1.hashToken)(dto.token);
        const tokenEnc = (0, crypto_util_1.encryptToken)(dto.token);
        const doc = new this.model(Object.assign(Object.assign({}, dto), { token: dto.token, tokenEnc, tokenHash }));
        await doc.save();
        await this.audit('create', doc._id, undefined, { _id: doc._id, name: doc.name });
        return doc;
    }
    findAll(filter = {}) { return this.model.find(filter).sort({ createdAt: -1 }).lean(); }
    async findOne(id) { const doc = await this.model.findById(id).lean(); if (!doc)
        throw new common_1.NotFoundException('Token không tồn tại'); return doc; }
    async update(id, dto) { const doc = await this.model.findByIdAndUpdate(id, dto, { new: true }).lean(); if (!doc)
        throw new common_1.NotFoundException('Token không tồn tại'); return doc; }
    async remove(id) { const res = await this.model.findByIdAndDelete(id); if (!res)
        throw new common_1.NotFoundException('Token không tồn tại'); }
    async validate(id, _dto) {
        const token = await this.model.findById(id);
        if (!token)
            throw new common_1.NotFoundException('Token không tồn tại');
        const validator = buildValidator(token.provider);
        const result = await validator.validate(token.token);
        token.lastCheckedAt = new Date();
        token.lastCheckStatus = result.status;
        token.lastCheckMessage = result.message;
        if (result.status === 'valid')
            token.consecutiveFail = 0;
        else
            token.consecutiveFail = (token.consecutiveFail || 0) + 1;
        if (result.scopes)
            token.scopes = result.scopes;
        if (result.expireAt)
            token.expireAt = result.expireAt;
        const minMs = 27 * 60 * 1000;
        const maxMs = 30 * 60 * 1000;
        const delta = Math.floor(minMs + Math.random() * (maxMs - minMs));
        token.nextCheckAt = new Date(Date.now() + delta);
        await token.save();
        await this.audit('validate', token._id, undefined, { status: token.lastCheckStatus });
        return token.toObject();
    }
    async setPrimary(id, dto) {
        const token = await this.model.findById(id);
        if (!token)
            throw new common_1.NotFoundException('Token không tồn tại');
        if (!token.fanpageId || token.fanpageId.toString() !== dto.fanpageId) {
            throw new common_1.BadRequestException('Token không thuộc fanpageId cung cấp');
        }
        await this.model.updateMany({ fanpageId: dto.fanpageId, isPrimary: true }, { $set: { isPrimary: false } });
        token.isPrimary = true;
        await token.save();
        await this.audit('setPrimary', token._id, undefined, { fanpageId: dto.fanpageId });
        return token.toObject();
    }
    async rotate(id, dto) {
        var _a, _b;
        const current = await this.model.findById(id);
        if (!current)
            throw new common_1.NotFoundException('Token không tồn tại');
        if (!((_a = dto.newToken) === null || _a === void 0 ? void 0 : _a.trim()))
            throw new common_1.BadRequestException('newToken rỗng');
        const newHash = (0, crypto_util_1.hashToken)(dto.newToken.trim());
        const newEnc = (0, crypto_util_1.encryptToken)(dto.newToken.trim());
        const newDoc = new this.model({
            name: current.name + ' (rotated)',
            token: dto.newToken.trim(),
            tokenEnc: newEnc,
            tokenHash: newHash,
            provider: current.provider,
            status: current.status,
            fanpageId: current.fanpageId,
            notes: (_b = dto.notes) !== null && _b !== void 0 ? _b : current.notes,
            rotatedFrom: current._id
        });
        await newDoc.save();
        current.rotatedTo = newDoc._id;
        await current.save();
        await this.audit('rotate', newDoc._id, { oldId: current._id }, { newId: newDoc._id });
        return { old: current.toObject(), fresh: newDoc.toObject() };
    }
    async syncFromFanpages() {
        const fanpages = await this.fanpageModel.find({ accessToken: { $exists: true, $ne: '' } }).lean();
        const created = [];
        for (const fp of fanpages) {
            const existed = await this.model.findOne({ fanpageId: fp._id, provider: 'facebook', rotatedFrom: { $exists: false } });
            if (existed)
                continue;
            const tokenHash = (0, crypto_util_1.hashToken)(fp.accessToken);
            const tokenEnc = (0, crypto_util_1.encryptToken)(fp.accessToken);
            const doc = new this.model({
                name: fp.name,
                token: fp.accessToken,
                tokenEnc,
                tokenHash,
                provider: 'facebook',
                status: fp.status || 'active',
                fanpageId: fp._id,
                notes: 'Imported from fanpage.accessToken',
                isPrimary: true
            });
            await doc.save();
            try {
                await this.validate(doc._id.toString(), { force: true });
            }
            catch (_a) { }
            created.push(doc.toObject());
            await this.audit('syncImport', doc._id, undefined, { fanpageId: fp._id });
        }
        return { imported: created.length, items: created };
    }
    async audit(action, tokenId, prev, next, meta) {
        try {
            await this.auditModel.create({ action, tokenId, prev, next, meta });
        }
        catch (_a) { }
    }
    async resolveForFanpage(fanpageId, provider = 'facebook') {
        let primary = await this.model.findOne({ fanpageId, provider, isPrimary: true }).lean();
        if (primary && primary.lastCheckStatus === 'valid')
            return { token: primary, fallback: false };
        const alt = await this.model.find({ fanpageId, provider, status: 'active', lastCheckStatus: 'valid' })
            .sort({ lastCheckedAt: -1 }).limit(1).lean();
        if (alt.length) {
            if (primary) {
                await this.model.updateOne({ _id: primary._id }, { $set: { degraded: true } });
                await this.audit('fallback', primary._id, undefined, { fallbackTo: alt[0]._id });
            }
            return { token: alt[0], fallback: true };
        }
        return { token: primary || null, fallback: false };
    }
};
exports.ApiTokenService = ApiTokenService;
exports.ApiTokenService = ApiTokenService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(api_token_schema_1.ApiToken.name)),
    __param(1, (0, mongoose_1.InjectModel)(api_token_audit_schema_1.ApiTokenAudit.name)),
    __param(2, (0, mongoose_1.InjectModel)(fanpage_schema_1.Fanpage.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], ApiTokenService);
//# sourceMappingURL=api-token.service.js.map