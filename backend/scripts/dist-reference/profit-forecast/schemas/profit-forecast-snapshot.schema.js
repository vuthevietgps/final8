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
exports.ProfitForecastSnapshotSchema = exports.ProfitForecastSnapshot = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let ProfitForecastSnapshot = class ProfitForecastSnapshot {
};
exports.ProfitForecastSnapshot = ProfitForecastSnapshot;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ProfitForecastSnapshot.prototype, "date", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ProfitForecastSnapshot.prototype, "adGroupId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Number)
], ProfitForecastSnapshot.prototype, "modelVersion", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], ProfitForecastSnapshot.prototype, "maturedRevenue", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], ProfitForecastSnapshot.prototype, "maturedProfit", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], ProfitForecastSnapshot.prototype, "maturedOrderCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], ProfitForecastSnapshot.prototype, "projectedRevenue", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], ProfitForecastSnapshot.prototype, "projectedProfit", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], ProfitForecastSnapshot.prototype, "projectedOrderCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], ProfitForecastSnapshot.prototype, "spend", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], ProfitForecastSnapshot.prototype, "blendedRevenue", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], ProfitForecastSnapshot.prototype, "blendedProfit", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], ProfitForecastSnapshot.prototype, "blendedROAS", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], ProfitForecastSnapshot.prototype, "maturedROAS", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], ProfitForecastSnapshot.prototype, "confidence", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], ProfitForecastSnapshot.prototype, "calibrationError", void 0);
exports.ProfitForecastSnapshot = ProfitForecastSnapshot = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], ProfitForecastSnapshot);
exports.ProfitForecastSnapshotSchema = mongoose_1.SchemaFactory.createForClass(ProfitForecastSnapshot);
exports.ProfitForecastSnapshotSchema.index({ date: 1, adGroupId: 1 }, { unique: true });
//# sourceMappingURL=profit-forecast-snapshot.schema.js.map