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
exports.SetPrimaryTokenDto = exports.RotateTokenDto = exports.ValidateTokenDto = void 0;
const class_validator_1 = require("class-validator");
class ValidateTokenDto {
}
exports.ValidateTokenDto = ValidateTokenDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ValidateTokenDto.prototype, "force", void 0);
class RotateTokenDto {
}
exports.RotateTokenDto = RotateTokenDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RotateTokenDto.prototype, "newToken", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RotateTokenDto.prototype, "notes", void 0);
class SetPrimaryTokenDto {
}
exports.SetPrimaryTokenDto = SetPrimaryTokenDto;
__decorate([
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], SetPrimaryTokenDto.prototype, "fanpageId", void 0);
//# sourceMappingURL=token-actions.dto.js.map