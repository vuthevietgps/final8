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
exports.ExportUserService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const user_schema_1 = require("../user/user.schema");
const user_enum_1 = require("../user/user.enum");
let ExportUserService = class ExportUserService {
    constructor(userModel) {
        this.userModel = userModel;
    }
    async exportAllUsersToCSV() {
        const users = await this.userModel.find().sort({ fullName: 1 }).exec();
        return this.convertUsersToCSV(users);
    }
    async exportUsersByRoleToCSV(role) {
        const users = await this.userModel
            .find({ role })
            .sort({ fullName: 1 })
            .exec();
        return this.convertUsersToCSV(users);
    }
    async exportActiveUsersToCSV() {
        const users = await this.userModel
            .find({ isActive: true })
            .sort({ fullName: 1 })
            .exec();
        return this.convertUsersToCSV(users);
    }
    convertUsersToCSV(users) {
        const headers = [
            'STT',
            'Họ và Tên',
            'Email',
            'Số Điện Thoại',
            'Vai Trò',
            'Địa Chỉ',
            'Trạng Thái',
            'Phòng Ban ID',
            'Manager ID',
            'Ghi Chú',
            'Google Drive Link',
            'Ngày Tạo',
            'Ngày Cập Nhật'
        ];
        let csvContent = '\uFEFF';
        csvContent += headers.join(',') + '\n';
        users.forEach((user, index) => {
            const row = [
                index + 1,
                this.escapeCsvValue(user.fullName),
                this.escapeCsvValue(user.email),
                this.escapeCsvValue(user.phone || ''),
                this.escapeCsvValue(this.getRoleDisplayName(user.role)),
                this.escapeCsvValue(user.address || ''),
                user.isActive ? 'Hoạt động' : 'Không hoạt động',
                this.escapeCsvValue(user.departmentId || ''),
                this.escapeCsvValue(user.managerId || ''),
                this.escapeCsvValue(user.notes || ''),
                this.escapeCsvValue(user.googleDriveLink || ''),
                this.formatDate(user.createdAt),
                this.formatDate(user.updatedAt)
            ];
            csvContent += row.join(',') + '\n';
        });
        return csvContent;
    }
    escapeCsvValue(value) {
        if (!value)
            return '';
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return '"' + value.replace(/"/g, '""') + '"';
        }
        return value;
    }
    getRoleDisplayName(role) {
        const roleNames = {
            [user_enum_1.UserRole.DIRECTOR]: 'Giám Đốc',
            [user_enum_1.UserRole.MANAGER]: 'Quản Lý',
            [user_enum_1.UserRole.EMPLOYEE]: 'Nhân Viên',
            [user_enum_1.UserRole.INTERNAL_AGENT]: 'Đại Lý Nội Bộ',
            [user_enum_1.UserRole.EXTERNAL_AGENT]: 'Đại Lý Bên Ngoài',
            [user_enum_1.UserRole.INTERNAL_SUPPLIER]: 'Nhà Cung Cấp Nội Bộ',
            [user_enum_1.UserRole.EXTERNAL_SUPPLIER]: 'Nhà Cung Cấp Bên Ngoài'
        };
        return roleNames[role] || role;
    }
    formatDate(date) {
        if (!date)
            return '';
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    }
    async getTotalUsersCount() {
        return await this.userModel.countDocuments().exec();
    }
    async getUsersCountByRole() {
        const pipeline = [
            {
                $group: {
                    _id: '$role',
                    count: { $sum: 1 }
                }
            }
        ];
        const result = await this.userModel.aggregate(pipeline).exec();
        const countByRole = Object.values(user_enum_1.UserRole).reduce((acc, role) => {
            acc[role] = 0;
            return acc;
        }, {});
        result.forEach(item => {
            countByRole[item._id] = item.count;
        });
        return countByRole;
    }
};
exports.ExportUserService = ExportUserService;
exports.ExportUserService = ExportUserService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], ExportUserService);
//# sourceMappingURL=export-user.service.js.map