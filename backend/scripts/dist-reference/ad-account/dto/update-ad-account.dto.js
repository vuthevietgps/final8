"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateAdAccountDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_ad_account_dto_1 = require("./create-ad-account.dto");
class UpdateAdAccountDto extends (0, mapped_types_1.PartialType)(create_ad_account_dto_1.CreateAdAccountDto) {
}
exports.UpdateAdAccountDto = UpdateAdAccountDto;
//# sourceMappingURL=update-ad-account.dto.js.map