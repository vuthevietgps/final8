"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FanpageModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const fanpage_schema_1 = require("./schemas/fanpage.schema");
const fanpage_service_1 = require("./fanpage.service");
const fanpage_controller_1 = require("./fanpage.controller");
const openai_config_module_1 = require("../openai-config/openai-config.module");
let FanpageModule = class FanpageModule {
};
exports.FanpageModule = FanpageModule;
exports.FanpageModule = FanpageModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([{ name: fanpage_schema_1.Fanpage.name, schema: fanpage_schema_1.FanpageSchema }]),
            openai_config_module_1.OpenAIConfigModule
        ],
        providers: [fanpage_service_1.FanpageService],
        controllers: [fanpage_controller_1.FanpageController],
        exports: [fanpage_service_1.FanpageService]
    })
], FanpageModule);
//# sourceMappingURL=fanpage.module.js.map