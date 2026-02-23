"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateProductionStatusDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_production_status_dto_1 = require("./create-production-status.dto");
class UpdateProductionStatusDto extends (0, mapped_types_1.PartialType)(create_production_status_dto_1.CreateProductionStatusDto) {
}
exports.UpdateProductionStatusDto = UpdateProductionStatusDto;
//# sourceMappingURL=update-production-status.dto.js.map