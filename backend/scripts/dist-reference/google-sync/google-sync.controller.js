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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleSyncController = void 0;
const common_1 = require("@nestjs/common");
const google_sync_service_1 = require("./google-sync.service");
let GoogleSyncController = class GoogleSyncController {
    constructor(svc) {
        this.svc = svc;
    }
    credCheck() {
        return {
            status: 'DEPRECATED',
            message: 'GoogleSync functionality replaced by Summary4GoogleSyncService',
            replacement: {
                syncAgent: 'POST /summary4/sync-google/:agentId',
                syncAll: 'POST /summary4/sync-google-all'
            }
        };
    }
    async authDebug() {
        return this.svc.authDebugInfo();
    }
};
exports.GoogleSyncController = GoogleSyncController;
__decorate([
    (0, common_1.Get)('cred-check'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], GoogleSyncController.prototype, "credCheck", null);
__decorate([
    (0, common_1.Get)('auth-debug'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], GoogleSyncController.prototype, "authDebug", null);
exports.GoogleSyncController = GoogleSyncController = __decorate([
    (0, common_1.Controller)('google-sync'),
    __metadata("design:paramtypes", [google_sync_service_1.GoogleSyncService])
], GoogleSyncController);
//# sourceMappingURL=google-sync.controller.js.map