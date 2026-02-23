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
exports.ImportUserService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const user_schema_1 = require("../user/user.schema");
const user_enum_1 = require("../user/user.enum");
let ImportUserService = class ImportUserService {
    constructor(userModel) {
        this.userModel = userModel;
    }
    async importUsersFromCSV(csvContent) {
        const result = {
            total: 0,
            success: 0,
            updated: 0,
            failed: 0,
            errors: []
        };
        try {
            const rows = this.parseCSVContent(csvContent);
            result.total = rows.length;
            for (let i = 0; i < rows.length; i++) {
                const rowNumber = i + 2;
                const row = rows[i];
                try {
                    const userData = this.validateAndConvertRow(row, rowNumber);
                    const existingUser = await this.userModel.findOne({ email: userData.email }).exec();
                    if (existingUser) {
                        await this.userModel.updateOne({ email: userData.email }, { $set: userData }).exec();
                        result.updated++;
                    }
                    else {
                        const newUser = new this.userModel(userData);
                        await newUser.save();
                        result.success++;
                    }
                }
                catch (error) {
                    result.failed++;
                    result.errors.push({
                        row: rowNumber,
                        data: row,
                        error: error.message || 'Unknown error'
                    });
                }
            }
        }
        catch (error) {
            throw new common_1.BadRequestException(`Lỗi khi xử lý file CSV: ${error.message}`);
        }
        return result;
    }
    parseCSVContent(csvContent) {
        const lines = csvContent.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            throw new Error('File CSV phải có ít nhất 1 dòng header và 1 dòng dữ liệu');
        }
        const headers = this.parseCSVRow(lines[0]);
        const headerMap = this.createHeaderMap(headers);
        const dataRows = [];
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVRow(lines[i]);
            if (values.length === 0 || values.every(v => !v.trim())) {
                continue;
            }
            const rowData = this.mapRowToUser(values, headerMap);
            dataRows.push(rowData);
        }
        return dataRows;
    }
    parseCSVRow(line) {
        const values = [];
        let currentValue = '';
        let inQuotes = false;
        let i = 0;
        while (i < line.length) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    currentValue += '"';
                    i += 2;
                }
                else {
                    inQuotes = !inQuotes;
                    i++;
                }
            }
            else if (char === ',' && !inQuotes) {
                values.push(currentValue.trim());
                currentValue = '';
                i++;
            }
            else {
                currentValue += char;
                i++;
            }
        }
        values.push(currentValue.trim());
        return values;
    }
    createHeaderMap(headers) {
        const map = {};
        const headerMappings = {
            fullName: ['fullname', 'full_name', 'họ và tên', 'tên', 'name', 'fullName'],
            email: ['email', 'e-mail', 'email address'],
            password: ['password', 'mật khẩu', 'pass'],
            phone: ['phone', 'số điện thoại', 'điện thoại', 'sdt', 'phone number'],
            role: ['role', 'vai trò', 'chức vụ', 'position'],
            address: ['address', 'địa chỉ', 'addr'],
            isActive: ['isactive', 'is_active', 'trạng thái', 'active', 'status'],
            departmentId: ['departmentid', 'department_id', 'phòng ban', 'department'],
            managerId: ['managerid', 'manager_id', 'quản lý', 'manager'],
            notes: ['notes', 'ghi chú', 'note', 'remark'],
            googleDriveLink: ['google drive link', 'drive', 'googleDriveLink', 'link drive', 'link google drive']
        };
        Object.keys(headerMappings).forEach(field => {
            const possibleNames = headerMappings[field];
            const index = headers.findIndex(header => possibleNames.some(name => header.toLowerCase().replace(/\s+/g, '').includes(name.toLowerCase().replace(/\s+/g, ''))));
            if (index !== -1) {
                map[field] = index;
            }
        });
        const requiredFields = ['fullName', 'email', 'password', 'phone', 'role'];
        const missingFields = requiredFields.filter(field => map[field] === undefined);
        if (missingFields.length > 0) {
            throw new Error(`Không tìm thấy các cột bắt buộc: ${missingFields.join(', ')}`);
        }
        return map;
    }
    mapRowToUser(values, headerMap) {
        const getValue = (field) => {
            var _a;
            const index = headerMap[field];
            return index !== undefined ? ((_a = values[index]) === null || _a === void 0 ? void 0 : _a.trim()) || '' : '';
        };
        return {
            fullName: getValue('fullName'),
            email: getValue('email'),
            password: getValue('password'),
            phone: getValue('phone'),
            role: getValue('role'),
            address: getValue('address') || undefined,
            isActive: this.parseBoolean(getValue('isActive')),
            departmentId: getValue('departmentId') || undefined,
            managerId: getValue('managerId') || undefined,
            notes: getValue('notes') || undefined,
            googleDriveLink: getValue('googleDriveLink') || undefined,
        };
    }
    validateAndConvertRow(row, rowNumber) {
        const errors = [];
        if (!row.fullName)
            errors.push('Họ tên không được để trống');
        if (!row.email)
            errors.push('Email không được để trống');
        if (!row.password)
            errors.push('Mật khẩu không được để trống');
        if (!row.phone)
            errors.push('Số điện thoại không được để trống');
        if (!row.role)
            errors.push('Vai trò không được để trống');
        if (row.email && !this.isValidEmail(row.email)) {
            errors.push('Email không đúng định dạng');
        }
        if (row.role && !this.isValidRole(row.role)) {
            errors.push(`Vai trò "${row.role}" không hợp lệ. Các vai trò hợp lệ: ${Object.values(user_enum_1.UserRole).join(', ')}`);
        }
        if (errors.length > 0) {
            throw new Error(`Dòng ${rowNumber}: ${errors.join(', ')}`);
        }
        return {
            fullName: row.fullName,
            email: row.email,
            password: row.password,
            phone: row.phone,
            role: this.convertToUserRole(row.role),
            address: row.address,
            isActive: row.isActive !== undefined ? row.isActive : true,
            departmentId: row.departmentId,
            managerId: row.managerId,
            notes: row.notes,
            googleDriveLink: row.googleDriveLink,
        };
    }
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    isValidRole(role) {
        const validRoles = [
            ...Object.values(user_enum_1.UserRole),
            'giám đốc', 'quản lý', 'nhân viên', 'đại lý nội bộ', 'đại lý bên ngoài',
            'nhà cung cấp nội bộ', 'nhà cung cấp bên ngoài'
        ];
        return validRoles.some(validRole => validRole.toLowerCase() === role.toLowerCase());
    }
    convertToUserRole(role) {
        const roleMap = {
            'director': user_enum_1.UserRole.DIRECTOR,
            'giám đốc': user_enum_1.UserRole.DIRECTOR,
            'manager': user_enum_1.UserRole.MANAGER,
            'quản lý': user_enum_1.UserRole.MANAGER,
            'employee': user_enum_1.UserRole.EMPLOYEE,
            'nhân viên': user_enum_1.UserRole.EMPLOYEE,
            'internal_agent': user_enum_1.UserRole.INTERNAL_AGENT,
            'đại lý nội bộ': user_enum_1.UserRole.INTERNAL_AGENT,
            'external_agent': user_enum_1.UserRole.EXTERNAL_AGENT,
            'đại lý bên ngoài': user_enum_1.UserRole.EXTERNAL_AGENT,
            'internal_supplier': user_enum_1.UserRole.INTERNAL_SUPPLIER,
            'nhà cung cấp nội bộ': user_enum_1.UserRole.INTERNAL_SUPPLIER,
            'external_supplier': user_enum_1.UserRole.EXTERNAL_SUPPLIER,
            'nhà cung cấp bên ngoài': user_enum_1.UserRole.EXTERNAL_SUPPLIER,
        };
        const normalizedRole = role.toLowerCase();
        return roleMap[normalizedRole] || role;
    }
    parseBoolean(value) {
        if (!value)
            return undefined;
        const truthy = ['true', '1', 'yes', 'y', 'có', 'hoạt động', 'active'];
        const falsy = ['false', '0', 'no', 'n', 'không', 'không hoạt động', 'inactive'];
        const normalized = value.toLowerCase().trim();
        if (truthy.includes(normalized))
            return true;
        if (falsy.includes(normalized))
            return false;
        return undefined;
    }
    getCSVTemplate() {
        const headers = [
            'Họ và Tên',
            'Email',
            'Mật khẩu',
            'Số Điện Thoại',
            'Vai Trò',
            'Địa Chỉ',
            'Trạng Thái',
            'Phòng Ban ID',
            'Manager ID',
            'Ghi Chú',
            'Google Drive Link'
        ];
        const sampleData = [
            'Nguyễn Văn A,nguyenvana@example.com,password123,0123456789,manager,"123 Đường ABC, Quận 1",hoạt động,DEPT001,MGR001,Ghi chú mẫu,https://drive.google.com/drive/folders/abc123'
        ];
        return '\uFEFF' + headers.join(',') + '\n' + sampleData.join('\n');
    }
};
exports.ImportUserService = ImportUserService;
exports.ImportUserService = ImportUserService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], ImportUserService);
//# sourceMappingURL=import-user.service.js.map