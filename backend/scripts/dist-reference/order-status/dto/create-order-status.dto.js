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
exports.CreateOrderStatusDto = void 0;
const class_validator_1 = require("class-validator");
class CreateOrderStatusDto {
}
exports.CreateOrderStatusDto = CreateOrderStatusDto;
__decorate([
    (0, class_validator_1.IsString)({ message: 'Tên trạng thái phải là chuỗi ký tự' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Tên trạng thái không được để trống' }),
    __metadata("design:type", String)
], CreateOrderStatusDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)({ message: 'Màu sắc phải là chuỗi ký tự' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Màu sắc không được để trống' }),
    (0, class_validator_1.Matches)(/^#[0-9A-F]{6}$/i, { message: 'Màu sắc phải đúng định dạng hex (#RRGGBB)' }),
    __metadata("design:type", String)
], CreateOrderStatusDto.prototype, "color", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'Mô tả phải là chuỗi ký tự' }),
    __metadata("design:type", String)
], CreateOrderStatusDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'Thứ tự phải là số' }),
    __metadata("design:type", Number)
], CreateOrderStatusDto.prototype, "order", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)({ message: 'Trạng thái hoạt động phải là boolean' }),
    __metadata("design:type", Boolean)
], CreateOrderStatusDto.prototype, "isActive", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)({ message: 'Trạng thái cuối phải là boolean' }),
    __metadata("design:type", Boolean)
], CreateOrderStatusDto.prototype, "isFinal", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'Icon phải là chuỗi ký tự' }),
    __metadata("design:type", String)
], CreateOrderStatusDto.prototype, "icon", void 0);
//# sourceMappingURL=create-order-status.dto.js.map