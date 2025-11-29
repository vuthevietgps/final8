"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdGroupModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const ad_group_controller_1 = require("./ad-group.controller");
const ad_group_service_1 = require("./ad-group.service");
const ad_group_schema_1 = require("./schemas/ad-group.schema");
const product_schema_1 = require("../product/schemas/product.schema");
let AdGroupModule = class AdGroupModule {
};
exports.AdGroupModule = AdGroupModule;
exports.AdGroupModule = AdGroupModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: ad_group_schema_1.AdGroup.name, schema: ad_group_schema_1.AdGroupSchema },
                { name: product_schema_1.Product.name, schema: product_schema_1.ProductSchema }
            ])
        ],
        controllers: [ad_group_controller_1.AdGroupController],
        providers: [ad_group_service_1.AdGroupService],
    })
], AdGroupModule);
//# sourceMappingURL=ad-group.module.js.map