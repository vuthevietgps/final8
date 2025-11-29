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
exports.OtherCostController = void 0;
const common_1 = require("@nestjs/common");
const other_cost_service_1 = require("./other-cost.service");
const create_other_cost_dto_1 = require("./dto/create-other-cost.dto");
const update_other_cost_dto_1 = require("./dto/update-other-cost.dto");
const auth_guard_1 = require("../auth/guards/auth.guard");
const auth_decorator_1 = require("../auth/decorators/auth.decorator");
let OtherCostController = class OtherCostController {
    constructor(otherCostService) {
        this.otherCostService = otherCostService;
    }
    create(dto) {
        return this.otherCostService.create(dto);
    }
    findAll(from, to) {
        return this.otherCostService.findAll(from, to);
    }
    getSummary(from, to) {
        return this.otherCostService.getSummary(from, to);
    }
    async exportToCSV(res, from, to) {
        const items = await this.otherCostService.findAll(from, to);
        const headers = [
            'Ngày',
            'Chi phí',
            'Ghi chú',
            'Link chứng từ',
            'Created At',
            'Updated At',
        ];
        const esc = (val) => {
            if (val === null || val === undefined)
                return '';
            const s = String(val).replace(/"/g, '""');
            return /[",\n]/.test(s) ? `"${s}"` : s;
        };
        const rows = items.map((c) => {
            var _a, _b, _c;
            return [
                c.date ? new Date(c.date).toISOString().slice(0, 10) : '',
                (_a = c.amount) !== null && _a !== void 0 ? _a : '',
                (_b = c.notes) !== null && _b !== void 0 ? _b : '',
                (_c = c.documentLink) !== null && _c !== void 0 ? _c : '',
                c.createdAt ? new Date(c.createdAt).toISOString() : '',
                c.updatedAt ? new Date(c.updatedAt).toISOString() : '',
            ];
        });
        const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
        const filename = `other_costs_${new Date().toISOString().slice(0, 10)}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(common_1.HttpStatus.OK).send('\uFEFF' + csv);
    }
    findOne(id) {
        return this.otherCostService.findOne(id);
    }
    update(id, dto) {
        return this.otherCostService.update(id, dto);
    }
    remove(id) {
        return this.otherCostService.remove(id);
    }
};
exports.OtherCostController = OtherCostController;
__decorate([
    (0, common_1.Post)(),
    (0, auth_decorator_1.RequirePermissions)('other-costs'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)(common_1.ValidationPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_other_cost_dto_1.CreateOtherCostDto]),
    __metadata("design:returntype", void 0)
], OtherCostController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, auth_decorator_1.RequirePermissions)('other-costs'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], OtherCostController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('summary'),
    (0, auth_decorator_1.RequirePermissions)('other-costs'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], OtherCostController.prototype, "getSummary", null);
__decorate([
    (0, common_1.Get)('export/csv'),
    (0, auth_decorator_1.RequirePermissions)('other-costs'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], OtherCostController.prototype, "exportToCSV", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, auth_decorator_1.RequirePermissions)('other-costs'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OtherCostController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, auth_decorator_1.RequirePermissions)('other-costs'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)(common_1.ValidationPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_other_cost_dto_1.UpdateOtherCostDto]),
    __metadata("design:returntype", void 0)
], OtherCostController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, auth_decorator_1.RequirePermissions)('other-costs'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OtherCostController.prototype, "remove", null);
exports.OtherCostController = OtherCostController = __decorate([
    (0, common_1.Controller)('other-cost'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, auth_guard_1.RolesGuard),
    __metadata("design:paramtypes", [other_cost_service_1.OtherCostService])
], OtherCostController);
//# sourceMappingURL=other-cost.controller.js.map