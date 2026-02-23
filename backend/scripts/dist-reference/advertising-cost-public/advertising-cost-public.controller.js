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
exports.AdvertisingCostPublicController = void 0;
const common_1 = require("@nestjs/common");
const advertising_cost_service_1 = require("../advertising-cost/advertising-cost.service");
let AdvertisingCostPublicController = class AdvertisingCostPublicController {
    constructor(advertisingCostService) {
        this.advertisingCostService = advertisingCostService;
    }
    async getYesterdaySpent() {
        const spentMap = await this.advertisingCostService.getYesterdaySpentByAdGroups();
        return {
            statusCode: 200,
            message: 'Lấy chi phí ngày hôm qua thành công',
            data: spentMap
        };
    }
};
exports.AdvertisingCostPublicController = AdvertisingCostPublicController;
__decorate([
    (0, common_1.Get)('yesterday-spent'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdvertisingCostPublicController.prototype, "getYesterdaySpent", null);
exports.AdvertisingCostPublicController = AdvertisingCostPublicController = __decorate([
    (0, common_1.Controller)('advertising-cost-public'),
    __metadata("design:paramtypes", [advertising_cost_service_1.AdvertisingCostService])
], AdvertisingCostPublicController);
//# sourceMappingURL=advertising-cost-public.controller.js.map