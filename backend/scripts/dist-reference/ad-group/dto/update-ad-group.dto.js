"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateAdGroupDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_ad_group_dto_1 = require("./create-ad-group.dto");
class UpdateAdGroupDto extends (0, mapped_types_1.PartialType)(create_ad_group_dto_1.CreateAdGroupDto) {
}
exports.UpdateAdGroupDto = UpdateAdGroupDto;
//# sourceMappingURL=update-ad-group.dto.js.map