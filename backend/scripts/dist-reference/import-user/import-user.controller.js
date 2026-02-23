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
exports.ImportUserController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const import_user_service_1 = require("./import-user.service");
let ImportUserController = class ImportUserController {
    constructor(importUserService) {
        this.importUserService = importUserService;
    }
    async importUsersFromCSV(file) {
        try {
            if (!file) {
                throw new common_1.BadRequestException('Vui lòng chọn file CSV để upload');
            }
            const csvContent = file.buffer.toString('utf8');
            const cleanContent = csvContent.replace(/^\uFEFF/, '');
            if (!cleanContent.trim()) {
                throw new common_1.BadRequestException('File CSV không có nội dung');
            }
            const result = await this.importUserService.importUsersFromCSV(cleanContent);
            return Object.assign(Object.assign({}, result), { message: `Import hoàn tất: ${result.success} thành công, ${result.updated} cập nhật, ${result.failed} thất bại` });
        }
        catch (error) {
            console.error('Error importing users from CSV:', error);
            if (error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException(`Lỗi khi import CSV: ${error.message}`);
        }
    }
    async downloadCSVTemplate(res) {
        try {
            const templateContent = this.importUserService.getCSVTemplate();
            const filename = `user_import_template_${this.getCurrentDateString()}.csv`;
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Pragma', 'no-cache');
            res.status(common_1.HttpStatus.OK).send(templateContent);
        }
        catch (error) {
            console.error('Error generating CSV template:', error);
            res.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: 'Lỗi khi tạo template CSV',
                error: error.message
            });
        }
    }
    getImportInstructions() {
        return {
            title: 'Hướng dẫn Import Users từ CSV',
            requiredColumns: [
                {
                    name: 'Họ và Tên',
                    description: 'Họ tên đầy đủ của user (bắt buộc)',
                    example: 'Nguyễn Văn A'
                },
                {
                    name: 'Email',
                    description: 'Email của user (bắt buộc, unique)',
                    example: 'nguyenvana@example.com'
                },
                {
                    name: 'Mật khẩu',
                    description: 'Mật khẩu của user (bắt buộc)',
                    example: 'password123'
                },
                {
                    name: 'Số Điện Thoại',
                    description: 'Số điện thoại (bắt buộc)',
                    example: '0123456789'
                },
                {
                    name: 'Vai Trò',
                    description: 'Vai trò trong hệ thống (bắt buộc)',
                    example: 'manager',
                    validValues: [
                        'director / giám đốc',
                        'manager / quản lý',
                        'employee / nhân viên',
                        'internal_agent / đại lý nội bộ',
                        'external_agent / đại lý bên ngoài',
                        'internal_supplier / nhà cung cấp nội bộ',
                        'external_supplier / nhà cung cấp bên ngoài'
                    ]
                }
            ],
            optionalColumns: [
                {
                    name: 'Địa Chỉ',
                    description: 'Địa chỉ của user (tùy chọn)',
                    example: '123 Đường ABC, Quận 1'
                },
                {
                    name: 'Trạng Thái',
                    description: 'Trạng thái hoạt động (tùy chọn, mặc định: hoạt động)',
                    example: 'hoạt động / không hoạt động',
                    validValues: ['hoạt động', 'không hoạt động', 'true', 'false', '1', '0']
                },
                {
                    name: 'Phòng Ban ID',
                    description: 'ID của phòng ban (tùy chọn)',
                    example: 'DEPT001'
                },
                {
                    name: 'Manager ID',
                    description: 'ID của manager (tùy chọn)',
                    example: 'MGR001'
                },
                {
                    name: 'Ghi Chú',
                    description: 'Ghi chú bổ sung (tùy chọn)',
                    example: 'Ghi chú mẫu'
                },
                {
                    name: 'Google Drive Link',
                    description: 'Liên kết thư mục/file Google Drive của user (tùy chọn)',
                    example: 'https://drive.google.com/drive/folders/abc123'
                }
            ],
            importRules: [
                'File phải có định dạng CSV với encoding UTF-8',
                'Dòng đầu tiên phải là header chứa tên các cột',
                'Email phải unique - nếu trùng sẽ ghi đè user cũ',
                'Các cột bắt buộc không được để trống',
                'Vai trò phải thuộc danh sách hợp lệ',
                'Kích thước file tối đa 5MB'
            ],
            tips: [
                'Tải template CSV để có format đúng',
                'Sử dụng Excel hoặc Google Sheets để edit CSV',
                'Lưu file với encoding UTF-8 để hiển thị tiếng Việt đúng',
                'Kiểm tra dữ liệu trước khi import',
                'Backup database trước khi import số lượng lớn'
            ]
        };
    }
    async validateCSVFile(file) {
        try {
            if (!file) {
                throw new common_1.BadRequestException('Vui lòng chọn file CSV để validate');
            }
            const csvContent = file.buffer.toString('utf8');
            const cleanContent = csvContent.replace(/^\uFEFF/, '');
            if (!cleanContent.trim()) {
                throw new common_1.BadRequestException('File CSV không có nội dung');
            }
            const lines = cleanContent.split('\n').filter(line => line.trim());
            return {
                valid: true,
                fileName: file.originalname,
                fileSize: file.size,
                totalRows: lines.length - 1,
                encoding: 'UTF-8',
                message: 'File CSV hợp lệ và sẵn sàng import'
            };
        }
        catch (error) {
            return {
                valid: false,
                fileName: (file === null || file === void 0 ? void 0 : file.originalname) || 'unknown',
                error: error.message,
                message: 'File CSV không hợp lệ'
            };
        }
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
exports.ImportUserController = ImportUserController;
__decorate([
    (0, common_1.Post)('csv'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        fileFilter: (req, file, callback) => {
            if (file.mimetype === 'text/csv' ||
                file.mimetype === 'application/vnd.ms-excel' ||
                file.originalname.endsWith('.csv')) {
                callback(null, true);
            }
            else {
                callback(new common_1.BadRequestException('Chỉ chấp nhận file CSV'), false);
            }
        },
        limits: {
            fileSize: 5 * 1024 * 1024,
        },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ImportUserController.prototype, "importUsersFromCSV", null);
__decorate([
    (0, common_1.Get)('template'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ImportUserController.prototype, "downloadCSVTemplate", null);
__decorate([
    (0, common_1.Get)('instructions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ImportUserController.prototype, "getImportInstructions", null);
__decorate([
    (0, common_1.Post)('validate'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        fileFilter: (req, file, callback) => {
            if (file.mimetype === 'text/csv' ||
                file.mimetype === 'application/vnd.ms-excel' ||
                file.originalname.endsWith('.csv')) {
                callback(null, true);
            }
            else {
                callback(new common_1.BadRequestException('Chỉ chấp nhận file CSV'), false);
            }
        },
        limits: {
            fileSize: 5 * 1024 * 1024,
        },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ImportUserController.prototype, "validateCSVFile", null);
exports.ImportUserController = ImportUserController = __decorate([
    (0, common_1.Controller)('import-users'),
    __metadata("design:paramtypes", [import_user_service_1.ImportUserService])
], ImportUserController);
//# sourceMappingURL=import-user.controller.js.map