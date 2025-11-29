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
exports.AdvertisingCostSuggestionSchema = exports.AdvertisingCostSuggestion = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let AdvertisingCostSuggestion = class AdvertisingCostSuggestion {
};
exports.AdvertisingCostSuggestion = AdvertisingCostSuggestion;
__decorate([
    (0, mongoose_1.Prop)({ required: true, type: String, index: true }),
    __metadata("design:type", String)
], AdvertisingCostSuggestion.prototype, "adGroupId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AdvertisingCostSuggestion.prototype, "adGroupName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 0 }),
    __metadata("design:type", Number)
], AdvertisingCostSuggestion.prototype, "suggestedCost", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0, min: 0 }),
    __metadata("design:type", Number)
], AdvertisingCostSuggestion.prototype, "dailyCost", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], AdvertisingCostSuggestion.prototype, "dailyDifference", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], AdvertisingCostSuggestion.prototype, "dailyDifferencePercent", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], AdvertisingCostSuggestion.prototype, "isActive", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AdvertisingCostSuggestion.prototype, "notes", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], AdvertisingCostSuggestion.prototype, "lastOptimizedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AdvertisingCostSuggestion.prototype, "lastOptimizationReason", void 0);
exports.AdvertisingCostSuggestion = AdvertisingCostSuggestion = __decorate([
    (0, mongoose_1.Schema)({
        timestamps: true,
        collection: 'advertising_cost_suggestions'
    })
], AdvertisingCostSuggestion);
exports.AdvertisingCostSuggestionSchema = mongoose_1.SchemaFactory.createForClass(AdvertisingCostSuggestion);
exports.AdvertisingCostSuggestionSchema.pre('save', function () {
    if (this.suggestedCost > 0) {
        this.dailyDifference = this.dailyCost - this.suggestedCost;
        this.dailyDifferencePercent = (this.dailyDifference / this.suggestedCost) * 100;
    }
});
//# sourceMappingURL=advertising-cost-suggestion.schema.js.map