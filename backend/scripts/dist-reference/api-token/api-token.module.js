"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiTokenModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const api_token_schema_1 = require("./schemas/api-token.schema");
const api_token_audit_schema_1 = require("./schemas/api-token-audit.schema");
const fanpage_schema_1 = require("../fanpage/schemas/fanpage.schema");
const api_token_service_1 = require("./api-token.service");
const api_token_scheduler_1 = require("./api-token.scheduler");
const api_token_controller_1 = require("./api-token.controller");
let ApiTokenModule = class ApiTokenModule {
};
exports.ApiTokenModule = ApiTokenModule;
exports.ApiTokenModule = ApiTokenModule = __decorate([
    (0, common_1.Module)({
        imports: [mongoose_1.MongooseModule.forFeature([
                { name: api_token_schema_1.ApiToken.name, schema: api_token_schema_1.ApiTokenSchema },
                { name: fanpage_schema_1.Fanpage.name, schema: fanpage_schema_1.FanpageSchema },
                { name: api_token_audit_schema_1.ApiTokenAudit.name, schema: api_token_audit_schema_1.ApiTokenAuditSchema }
            ])],
        providers: [api_token_service_1.ApiTokenService, api_token_scheduler_1.ApiTokenScheduler],
        controllers: [api_token_controller_1.ApiTokenController],
        exports: [api_token_service_1.ApiTokenService]
    })
], ApiTokenModule);
//# sourceMappingURL=api-token.module.js.map