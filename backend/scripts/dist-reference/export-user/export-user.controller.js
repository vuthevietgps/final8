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
exports.ExportUserController = void 0;
const common_1 = require("@nestjs/common");
const export_user_service_1 = require("./export-user.service");
const user_enum_1 = require("../user/user.enum");
let ExportUserController = class ExportUserController {
    constructor(exportUserService) {
        this.exportUserService = exportUserService;
    }
    async exportUsersToCSV(res, role, activeOnly) {
        try {
            let csvContent;
            let filename;
            if (role && Object.values(user_enum_1.UserRole).includes(role)) {
                csvContent = await this.exportUserService.exportUsersByRoleToCSV(role);
                const roleDisplayName = this.getRoleDisplayName(role);
                filename = `users_${roleDisplayName.replace(/\s+/g, '_')}_${this.getCurrentDateString()}.csv`;
            }
            else if (activeOnly === 'true') {
                csvContent = await this.exportUserService.exportActiveUsersToCSV();
                filename = `users_active_${this.getCurrentDateString()}.csv`;
            }
            else {
                csvContent = await this.exportUserService.exportAllUsersToCSV();
                filename = `users_all_${this.getCurrentDateString()}.csv`;
            }
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Pragma', 'no-cache');
            res.status(common_1.HttpStatus.OK).send(csvContent);
        }
        catch (error) {
            console.error('Error exporting users to CSV:', error);
            res.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: 'Lỗi khi xuất file CSV',
                error: error.message
            });
        }
    }
    async getUsersStats() {
        try {
            const totalUsers = await this.exportUserService.getTotalUsersCount();
            const countByRole = await this.exportUserService.getUsersCountByRole();
            return {
                total: totalUsers,
                byRole: countByRole,
                exportDate: new Date().toISOString()
            };
        }
        catch (error) {
            console.error('Error getting users stats:', error);
            throw error;
        }
    }
    async previewCsvExport(role, activeOnly) {
        try {
            let csvContent;
            if (role && Object.values(user_enum_1.UserRole).includes(role)) {
                csvContent = await this.exportUserService.exportUsersByRoleToCSV(role);
            }
            else if (activeOnly === 'true') {
                csvContent = await this.exportUserService.exportActiveUsersToCSV();
            }
            else {
                csvContent = await this.exportUserService.exportAllUsersToCSV();
            }
            const lines = csvContent.split('\n');
            const header = lines[0];
            const previewLines = lines.slice(1, 11);
            const totalRows = lines.length - 2;
            return {
                header: header.split(','),
                preview: previewLines.filter(line => line.trim()).map(line => line.split(',')),
                totalRows: totalRows,
                previewRows: previewLines.filter(line => line.trim()).length,
                filters: {
                    role: role || null,
                    activeOnly: activeOnly === 'true'
                }
            };
        }
        catch (error) {
            console.error('Error previewing CSV export:', error);
            throw error;
        }
    }
    getRoleDisplayName(role) {
        const roleNames = {
            [user_enum_1.UserRole.DIRECTOR]: 'Giam_Doc',
            [user_enum_1.UserRole.MANAGER]: 'Quan_Ly',
            [user_enum_1.UserRole.EMPLOYEE]: 'Nhan_Vien',
            [user_enum_1.UserRole.INTERNAL_AGENT]: 'Dai_Ly_Noi_Bo',
            [user_enum_1.UserRole.EXTERNAL_AGENT]: 'Dai_Ly_Ben_Ngoai',
            [user_enum_1.UserRole.INTERNAL_SUPPLIER]: 'Nha_Cung_Cap_Noi_Bo',
            [user_enum_1.UserRole.EXTERNAL_SUPPLIER]: 'Nha_Cung_Cap_Ben_Ngoai'
        };
        return roleNames[role] || role;
    }
    getCurrentDateString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}_${hours}${minutes}${seconds}`;
    }
};
exports.ExportUserController = ExportUserController;
__decorate([
    (0, common_1.Get)('csv'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Query)('role')),
    __param(2, (0, common_1.Query)('activeOnly')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ExportUserController.prototype, "exportUsersToCSV", null);
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ExportUserController.prototype, "getUsersStats", null);
__decorate([
    (0, common_1.Get)('preview'),
    __param(0, (0, common_1.Query)('role')),
    __param(1, (0, common_1.Query)('activeOnly')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ExportUserController.prototype, "previewCsvExport", null);
exports.ExportUserController = ExportUserController = __decorate([
    (0, common_1.Controller)('export-users'),
    __metadata("design:paramtypes", [export_user_service_1.ExportUserService])
], ExportUserController);
//# sourceMappingURL=export-user.controller.js.map