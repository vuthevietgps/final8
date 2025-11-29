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
exports.Summary5Controller = void 0;
const common_1 = require("@nestjs/common");
const summary5_service_1 = require("./summary5.service");
let Summary5Controller = class Summary5Controller {
    constructor(service) {
        this.service = service;
    }
    async findAll(q) {
        return this.service.findAll(q);
    }
    async stats(q) {
        return this.service.stats(q);
    }
    async sync(startDate, endDate) {
        return this.service.sync({ startDate, endDate });
    }
    async clearAll() {
        return this.service.clearAll();
    }
};
exports.Summary5Controller = Summary5Controller;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], Summary5Controller.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('stats'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], Summary5Controller.prototype, "stats", null);
__decorate([
    (0, common_1.Post)('sync'),
    __param(0, (0, common_1.Query)('startDate')),
    __param(1, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], Summary5Controller.prototype, "sync", null);
__decorate([
    (0, common_1.Delete)('clear-all'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], Summary5Controller.prototype, "clearAll", null);
exports.Summary5Controller = Summary5Controller = __decorate([
    (0, common_1.Controller)('summary5'),
    __metadata("design:paramtypes", [summary5_service_1.Summary5Service])
], Summary5Controller);
//# sourceMappingURL=summary5.controller.js.map