"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateApiTokenDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_api_token_dto_1 = require("./create-api-token.dto");
class UpdateApiTokenDto extends (0, mapped_types_1.PartialType)(create_api_token_dto_1.CreateApiTokenDto) {
}
exports.UpdateApiTokenDto = UpdateApiTokenDto;
//# sourceMappingURL=update-api-token.dto.js.map