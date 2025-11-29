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
var GoogleSyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleSyncService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const test_order2_schema_1 = require("../test-order2/schemas/test-order2.schema");
const quote_schema_1 = require("../quote/schemas/quote.schema");
const user_schema_1 = require("../user/user.schema");
const googleapis_1 = require("googleapis");
const path = require("path");
const fs = require("fs");
let GoogleSyncService = GoogleSyncService_1 = class GoogleSyncService {
    constructor(orderModel, quoteModel, userModel) {
        this.orderModel = orderModel;
        this.quoteModel = quoteModel;
        this.userModel = userModel;
        this.logger = new common_1.Logger(GoogleSyncService_1.name);
    }
    async authDebugInfo() {
        try {
            const auth = await this.getGoogleAuth();
            return auth ? { status: 'OK', hasAuth: true } : { status: 'No credentials', hasAuth: false };
        }
        catch (error) {
            return { status: 'Error', error: error === null || error === void 0 ? void 0 : error.message, hasAuth: false };
        }
    }
    async ensureSheetExists(sheets, spreadsheetId, title) {
        try {
            const meta = await sheets.spreadsheets.get({ spreadsheetId });
            const exists = (meta.data.sheets || []).some((s) => { var _a; return ((_a = s.properties) === null || _a === void 0 ? void 0 : _a.title) === title; });
            if (!exists) {
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    requestBody: {
                        requests: [
                            {
                                addSheet: {
                                    properties: { title },
                                },
                            },
                        ],
                    },
                });
                this.logger.log(`Đã tạo sheet tab '${title}' trong spreadsheet ${spreadsheetId}`);
            }
        }
        catch (e) {
            this.logger.warn(`Không thể kiểm tra/tạo sheet '${title}': ${e}`);
        }
    }
    extractSpreadsheetId(link) {
        if (!link)
            return null;
        const cleaned = decodeURIComponent(String(link)).replace(/\s+/g, '');
        let m = cleaned.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (m)
            return m[1];
        m = cleaned.match(/[?&]id=([a-zA-Z0-9-_]+)/);
        if (m)
            return m[1];
        m = cleaned.match(/([a-zA-Z0-9-_]{20,})/);
        return m ? m[1] : null;
    }
    async getGoogleAuth() {
        try {
            const jsonInline = process.env.GOOGLE_CREDENTIALS_JSON;
            if (jsonInline) {
                const credentials = JSON.parse(jsonInline);
                const jwtClient = new googleapis_1.google.auth.JWT({
                    email: credentials.client_email,
                    key: credentials.private_key,
                    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
                });
                await jwtClient.authorize();
                this.logger.log('Google Auth: sử dụng GOOGLE_CREDENTIALS_JSON (JWT)');
                return jwtClient;
            }
            let credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
            const backendRootEnv = process.env.BACKEND_ROOT;
            const debugPieces = [];
            debugPieces.push(`CWD=${process.cwd()}`);
            debugPieces.push(`__dirname=${__dirname}`);
            if (credPath)
                debugPieces.push(`GOOGLE_APPLICATION_CREDENTIALS(raw)=${credPath}`);
            if (backendRootEnv)
                debugPieces.push(`BACKEND_ROOT=${backendRootEnv}`);
            if (credPath && !path.isAbsolute(credPath)) {
                const attempts = [];
                const tryPaths = [
                    path.resolve(process.cwd(), credPath),
                    backendRootEnv ? path.resolve(backendRootEnv, credPath) : '',
                    path.resolve(__dirname, '..', '..', credPath),
                    path.resolve(__dirname, '..', '..', '..', credPath),
                ].filter(Boolean);
                for (const p of tryPaths) {
                    attempts.push(p);
                    if (fs.existsSync(p)) {
                        credPath = p;
                        break;
                    }
                }
                debugPieces.push(`rel attempts=${attempts.join(' | ')}`);
            }
            if (credPath && fs.existsSync(credPath)) {
                const raw = fs.readFileSync(credPath, 'utf8');
                const credentials = JSON.parse(raw);
                const jwtClient = new googleapis_1.google.auth.JWT({
                    email: credentials.client_email,
                    key: credentials.private_key,
                    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
                });
                await jwtClient.authorize();
                this.logger.log(`Google Auth: sử dụng GOOGLE_APPLICATION_CREDENTIALS (JWT) -> ${credPath}`);
                return jwtClient;
            }
            const candidates = [
                path.resolve(process.cwd(), 'dongbodulieuweb-8de0c9a12896.json'),
                path.resolve(process.cwd(), 'backend', 'dongbodulieuweb-8de0c9a12896.json'),
                backendRootEnv ? path.resolve(backendRootEnv, 'dongbodulieuweb-8de0c9a12896.json') : '',
                path.resolve(__dirname, '..', '..', 'dongbodulieuweb-8de0c9a12896.json'),
                path.resolve(__dirname, '..', '..', '..', 'dongbodulieuweb-8de0c9a12896.json'),
                'D:\\code\\final2\\backend\\dongbodulieuweb-8de0c9a12896.json',
            ].filter(Boolean);
            for (const p of candidates) {
                if (fs.existsSync(p)) {
                    const raw = fs.readFileSync(p, 'utf8');
                    const credentials = JSON.parse(raw);
                    const jwtClient = new googleapis_1.google.auth.JWT({
                        email: credentials.client_email,
                        key: credentials.private_key,
                        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
                    });
                    await jwtClient.authorize();
                    this.logger.log(`Google Auth: fallback JWT credentials loaded from ${p}`);
                    return jwtClient;
                }
            }
            this.logger.warn('Không tìm thấy Google credentials (GOOGLE_CREDENTIALS_JSON hoặc GOOGLE_APPLICATION_CREDENTIALS)');
            this.logger.warn(`Auth debug: ${debugPieces.join(' | ')}`);
            return null;
        }
        catch (error) {
            this.logger.error('Lỗi Google Auth:', error);
            return null;
        }
    }
};
exports.GoogleSyncService = GoogleSyncService;
exports.GoogleSyncService = GoogleSyncService = GoogleSyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(test_order2_schema_1.TestOrder2.name)),
    __param(1, (0, mongoose_1.InjectModel)(quote_schema_1.Quote.name)),
    __param(2, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], GoogleSyncService);
//# sourceMappingURL=google-sync.service.js.map