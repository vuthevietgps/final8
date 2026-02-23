"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePendingOrderDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_pending_order_dto_1 = require("./create-pending-order.dto");
class UpdatePendingOrderDto extends (0, mapped_types_1.PartialType)(create_pending_order_dto_1.CreatePendingOrderDto) {
}
exports.UpdatePendingOrderDto = UpdatePendingOrderDto;
//# sourceMappingURL=update-pending-order.dto.js.map