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
exports.CreateAdvertisingCostSuggestionDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class CreateAdvertisingCostSuggestionDto {
}
exports.CreateAdvertisingCostSuggestionDto = CreateAdvertisingCostSuggestionDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'ID nhóm quảng cáo không được để trống' }),
    (0, class_validator_1.IsString)({ message: 'ID nhóm quảng cáo phải là chuỗi' }),
    __metadata("design:type", String)
], CreateAdvertisingCostSuggestionDto.prototype, "adGroupId", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Tên nhóm quảng cáo không được để trống' }),
    (0, class_validator_1.IsString)({ message: 'Tên nhóm quảng cáo phải là chuỗi' }),
    __metadata("design:type", String)
], CreateAdvertisingCostSuggestionDto.prototype, "adGroupName", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Chi phí đề xuất không được để trống' }),
    (0, class_validator_1.IsNumber)({}, { message: 'Chi phí đề xuất phải là số' }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.Min)(0, { message: 'Chi phí đề xuất không được âm' }),
    __metadata("design:type", Number)
], CreateAdvertisingCostSuggestionDto.prototype, "suggestedCost", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'Chi phí hàng ngày phải là số' }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.Min)(0, { message: 'Chi phí hàng ngày không được âm' }),
    __metadata("design:type", Number)
], CreateAdvertisingCostSuggestionDto.prototype, "dailyCost", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)({ message: 'Trạng thái phải là boolean' }),
    __metadata("design:type", Boolean)
], CreateAdvertisingCostSuggestionDto.prototype, "isActive", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'Ghi chú phải là chuỗi' }),
    __metadata("design:type", String)
], CreateAdvertisingCostSuggestionDto.prototype, "notes", void 0);
//# sourceMappingURL=create-advertising-cost-suggestion.dto.js.map