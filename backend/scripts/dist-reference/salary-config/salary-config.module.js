"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalaryConfigModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const salary_config_schema_1 = require("./schemas/salary-config.schema");
const salary_config_service_1 = require("./salary-config.service");
const salary_config_controller_1 = require("./salary-config.controller");
let SalaryConfigModule = class SalaryConfigModule {
};
exports.SalaryConfigModule = SalaryConfigModule;
exports.SalaryConfigModule = SalaryConfigModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([{ name: salary_config_schema_1.SalaryConfig.name, schema: salary_config_schema_1.SalaryConfigSchema }]),
        ],
        controllers: [salary_config_controller_1.SalaryConfigController],
        providers: [salary_config_service_1.SalaryConfigService],
    })
], SalaryConfigModule);
//# sourceMappingURL=salary-config.module.js.map