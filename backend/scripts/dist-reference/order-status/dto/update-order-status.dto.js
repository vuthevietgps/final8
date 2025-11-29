"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateOrderStatusDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_order_status_dto_1 = require("./create-order-status.dto");
class UpdateOrderStatusDto extends (0, mapped_types_1.PartialType)(create_order_status_dto_1.CreateOrderStatusDto) {
}
exports.UpdateOrderStatusDto = UpdateOrderStatusDto;
//# sourceMappingURL=update-order-status.dto.js.map