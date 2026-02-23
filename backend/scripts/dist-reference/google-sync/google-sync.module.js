"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleSyncModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const google_sync_service_1 = require("./google-sync.service");
const test_order2_schema_1 = require("../test-order2/schemas/test-order2.schema");
const quote_schema_1 = require("../quote/schemas/quote.schema");
const user_schema_1 = require("../user/user.schema");
const product_schema_1 = require("../product/schemas/product.schema");
const google_sync_controller_1 = require("./google-sync.controller");
let GoogleSyncModule = class GoogleSyncModule {
};
exports.GoogleSyncModule = GoogleSyncModule;
exports.GoogleSyncModule = GoogleSyncModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: test_order2_schema_1.TestOrder2.name, schema: test_order2_schema_1.TestOrder2Schema },
                { name: quote_schema_1.Quote.name, schema: quote_schema_1.QuoteSchema },
                { name: user_schema_1.User.name, schema: user_schema_1.UserSchema },
                { name: product_schema_1.Product.name, schema: product_schema_1.ProductSchema },
            ]),
        ],
        providers: [google_sync_service_1.GoogleSyncService],
        controllers: [google_sync_controller_1.GoogleSyncController],
        exports: [google_sync_service_1.GoogleSyncService],
    })
], GoogleSyncModule);
//# sourceMappingURL=google-sync.module.js.map