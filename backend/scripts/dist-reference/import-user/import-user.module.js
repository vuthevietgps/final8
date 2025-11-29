"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportUserModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const import_user_service_1 = require("./import-user.service");
const import_user_controller_1 = require("./import-user.controller");
const user_schema_1 = require("../user/user.schema");
const user_module_1 = require("../user/user.module");
let ImportUserModule = class ImportUserModule {
};
exports.ImportUserModule = ImportUserModule;
exports.ImportUserModule = ImportUserModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([{ name: user_schema_1.User.name, schema: user_schema_1.UserSchema }]),
            user_module_1.UserModule,
        ],
        controllers: [import_user_controller_1.ImportUserController],
        providers: [import_user_service_1.ImportUserService],
        exports: [import_user_service_1.ImportUserService],
    })
], ImportUserModule);
//# sourceMappingURL=import-user.module.js.map