"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdGroupProfitReportModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const ad_group_profit_report_controller_1 = require("./ad-group-profit-report.controller");
const ad_group_profit_report_service_1 = require("./ad-group-profit-report.service");
const ad_group_schema_1 = require("../ad-group/schemas/ad-group.schema");
const summary5_schema_1 = require("../summary5/schemas/summary5.schema");
let AdGroupProfitReportModule = class AdGroupProfitReportModule {
};
exports.AdGroupProfitReportModule = AdGroupProfitReportModule;
exports.AdGroupProfitReportModule = AdGroupProfitReportModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: ad_group_schema_1.AdGroup.name, schema: ad_group_schema_1.AdGroupSchema },
                { name: summary5_schema_1.Summary5.name, schema: summary5_schema_1.Summary5Schema },
            ])
        ],
        controllers: [ad_group_profit_report_controller_1.AdGroupProfitReportController],
        providers: [ad_group_profit_report_service_1.AdGroupProfitReportService],
        exports: [ad_group_profit_report_service_1.AdGroupProfitReportService]
    })
], AdGroupProfitReportModule);
//# sourceMappingURL=ad-group-profit-report.module.js.map