"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionLogModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const session_log_schema_1 = require("./session-log.schema");
const session_log_service_1 = require("./session-log.service");
const session_log_controller_1 = require("./session-log.controller");
let SessionLogModule = class SessionLogModule {
};
exports.SessionLogModule = SessionLogModule;
exports.SessionLogModule = SessionLogModule = __decorate([
    (0, common_1.Module)({
        imports: [mongoose_1.MongooseModule.forFeature([{ name: session_log_schema_1.SessionLog.name, schema: session_log_schema_1.SessionLogSchema }])],
        providers: [session_log_service_1.SessionLogService],
        controllers: [session_log_controller_1.SessionLogController],
        exports: [session_log_service_1.SessionLogService],
    })
], SessionLogModule);
//# sourceMappingURL=session-log.module.js.map