"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Summary4Module = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const summary4_controller_1 = require("./summary4.controller");
const summary4_service_1 = require("./summary4.service");
const summary4_google_sync_service_1 = require("./summary4-google-sync.service");
const summary4_repository_1 = require("./summary4-repository");
const summary4_sync_service_1 = require("./summary4-sync.service");
const summary4_payment_service_1 = require("./summary4-payment.service");
const summary4_maintenance_service_1 = require("./summary4-maintenance.service");
const summary4_stats_service_1 = require("./summary4-stats.service");
const summary4_schema_1 = require("./schemas/summary4.schema");
const test_order2_schema_1 = require("../test-order2/schemas/test-order2.schema");
const quote_schema_1 = require("../quote/schemas/quote.schema");
const user_schema_1 = require("../user/user.schema");
const product_schema_1 = require("../product/schemas/product.schema");
const summary5_module_1 = require("../summary5/summary5.module");
const google_sync_module_1 = require("../google-sync/google-sync.module");
let Summary4Module = class Summary4Module {
};
exports.Summary4Module = Summary4Module;
exports.Summary4Module = Summary4Module = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: summary4_schema_1.Summary4.name, schema: summary4_schema_1.Summary4Schema },
                { name: test_order2_schema_1.TestOrder2.name, schema: test_order2_schema_1.TestOrder2Schema },
                { name: quote_schema_1.Quote.name, schema: quote_schema_1.QuoteSchema },
                { name: user_schema_1.User.name, schema: user_schema_1.UserSchema },
                { name: product_schema_1.Product.name, schema: product_schema_1.ProductSchema },
            ]),
            summary5_module_1.Summary5Module,
            google_sync_module_1.GoogleSyncModule,
        ],
        controllers: [summary4_controller_1.Summary4Controller],
        providers: [
            summary4_service_1.Summary4Service,
            summary4_google_sync_service_1.Summary4GoogleSyncService,
            summary4_repository_1.Summary4Repository,
            summary4_sync_service_1.Summary4SyncService,
            summary4_payment_service_1.Summary4PaymentService,
            summary4_maintenance_service_1.Summary4MaintenanceService,
            summary4_stats_service_1.Summary4StatsService,
        ],
        exports: [
            summary4_service_1.Summary4Service,
            summary4_google_sync_service_1.Summary4GoogleSyncService,
            summary4_repository_1.Summary4Repository,
            summary4_sync_service_1.Summary4SyncService,
            summary4_payment_service_1.Summary4PaymentService,
            summary4_maintenance_service_1.Summary4MaintenanceService,
            summary4_stats_service_1.Summary4StatsService,
        ],
    })
], Summary4Module);
//# sourceMappingURL=summary4.module.js.map