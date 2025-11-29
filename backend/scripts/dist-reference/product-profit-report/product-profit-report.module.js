"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductProfitReportModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const product_profit_report_controller_1 = require("./product-profit-report.controller");
const product_profit_report_service_1 = require("./product-profit-report.service");
const summary5_schema_1 = require("../summary5/schemas/summary5.schema");
const product_schema_1 = require("../product/schemas/product.schema");
let ProductProfitReportModule = class ProductProfitReportModule {
};
exports.ProductProfitReportModule = ProductProfitReportModule;
exports.ProductProfitReportModule = ProductProfitReportModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: summary5_schema_1.Summary5.name, schema: summary5_schema_1.Summary5Schema },
                { name: product_schema_1.Product.name, schema: product_schema_1.ProductSchema },
            ]),
        ],
        controllers: [product_profit_report_controller_1.ProductProfitReportController],
        providers: [product_profit_report_service_1.ProductProfitReportService],
        exports: [product_profit_report_service_1.ProductProfitReportService],
    })
], ProductProfitReportModule);
//# sourceMappingURL=product-profit-report.module.js.map