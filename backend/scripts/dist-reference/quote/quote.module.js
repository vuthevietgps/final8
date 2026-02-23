"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuoteModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const quote_service_1 = require("./quote.service");
const quote_controller_1 = require("./quote.controller");
const quote_schema_1 = require("./schemas/quote.schema");
const product_schema_1 = require("../product/schemas/product.schema");
const google_sync_module_1 = require("../google-sync/google-sync.module");
const create_sample_quotes_service_1 = require("./create-sample-quotes.service");
let QuoteModule = class QuoteModule {
};
exports.QuoteModule = QuoteModule;
exports.QuoteModule = QuoteModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: quote_schema_1.Quote.name, schema: quote_schema_1.QuoteSchema },
                { name: product_schema_1.Product.name, schema: product_schema_1.ProductSchema }
            ]),
            google_sync_module_1.GoogleSyncModule,
        ],
        controllers: [quote_controller_1.QuoteController],
        providers: [quote_service_1.QuoteService, create_sample_quotes_service_1.CreateSampleQuotes],
        exports: [quote_service_1.QuoteService]
    })
], QuoteModule);
//# sourceMappingURL=quote.module.js.map