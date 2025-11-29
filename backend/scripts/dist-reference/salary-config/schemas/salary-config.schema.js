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
exports.SalaryConfigSchema = exports.SalaryConfig = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const user_schema_1 = require("../../user/user.schema");
let SalaryConfig = class SalaryConfig {
};
exports.SalaryConfig = SalaryConfig;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: user_schema_1.User.name, required: true, unique: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], SalaryConfig.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, required: true, min: 0 }),
    __metadata("design:type", Number)
], SalaryConfig.prototype, "hourlyRate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], SalaryConfig.prototype, "notes", void 0);
exports.SalaryConfig = SalaryConfig = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], SalaryConfig);
exports.SalaryConfigSchema = mongoose_1.SchemaFactory.createForClass(SalaryConfig);
//# sourceMappingURL=salary-config.schema.js.map