"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateOpenAIConfigDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_openai_config_dto_1 = require("./create-openai-config.dto");
class UpdateOpenAIConfigDto extends (0, mapped_types_1.PartialType)(create_openai_config_dto_1.CreateOpenAIConfigDto) {
}
exports.UpdateOpenAIConfigDto = UpdateOpenAIConfigDto;
//# sourceMappingURL=update-openai-config.dto.js.map