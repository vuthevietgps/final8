"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIConfigModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const openai_config_schema_1 = require("./schemas/openai-config.schema");
const openai_config_service_1 = require("./openai-config.service");
const openai_config_controller_1 = require("./openai-config.controller");
let OpenAIConfigModule = class OpenAIConfigModule {
};
exports.OpenAIConfigModule = OpenAIConfigModule;
exports.OpenAIConfigModule = OpenAIConfigModule = __decorate([
    (0, common_1.Module)({
        imports: [mongoose_1.MongooseModule.forFeature([{ name: openai_config_schema_1.OpenAIConfig.name, schema: openai_config_schema_1.OpenAIConfigSchema }])],
        providers: [openai_config_service_1.OpenAIConfigService],
        controllers: [openai_config_controller_1.OpenAIConfigController],
        exports: [openai_config_service_1.OpenAIConfigService]
    })
], OpenAIConfigModule);
//# sourceMappingURL=openai-config.module.js.map