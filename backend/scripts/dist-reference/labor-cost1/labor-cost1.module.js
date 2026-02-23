"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LaborCost1Module = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const labor_cost1_schema_1 = require("./schemas/labor-cost1.schema");
const salary_config_schema_1 = require("../salary-config/schemas/salary-config.schema");
const session_log_schema_1 = require("../session-log/session-log.schema");
const labor_cost1_service_1 = require("./labor-cost1.service");
const labor_cost1_controller_1 = require("./labor-cost1.controller");
let LaborCost1Module = class LaborCost1Module {
};
exports.LaborCost1Module = LaborCost1Module;
exports.LaborCost1Module = LaborCost1Module = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: labor_cost1_schema_1.LaborCost1.name, schema: labor_cost1_schema_1.LaborCost1Schema },
                { name: salary_config_schema_1.SalaryConfig.name, schema: salary_config_schema_1.SalaryConfigSchema },
                { name: session_log_schema_1.SessionLog.name, schema: session_log_schema_1.SessionLogSchema },
            ]),
        ],
        controllers: [labor_cost1_controller_1.LaborCost1Controller],
        providers: [labor_cost1_service_1.LaborCost1Service],
    })
], LaborCost1Module);
//# sourceMappingURL=labor-cost1.module.js.map