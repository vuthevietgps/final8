"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatMessageModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const chat_message_schema_1 = require("./schemas/chat-message.schema");
const chat_message_service_1 = require("./chat-message.service");
const chat_message_controller_1 = require("./chat-message.controller");
const messenger_webhook_controller_1 = require("./messenger-webhook.controller");
const conversation_schema_1 = require("./schemas/conversation.schema");
const fanpage_schema_1 = require("../fanpage/schemas/fanpage.schema");
const openai_config_module_1 = require("../openai-config/openai-config.module");
const product_module_1 = require("../product/product.module");
const media_module_1 = require("../media/media.module");
const messenger_webhook_service_1 = require("./messenger-webhook.service");
const chat_events_service_1 = require("./chat-events.service");
let ChatMessageModule = class ChatMessageModule {
};
exports.ChatMessageModule = ChatMessageModule;
exports.ChatMessageModule = ChatMessageModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: chat_message_schema_1.ChatMessage.name, schema: chat_message_schema_1.ChatMessageSchema },
                { name: conversation_schema_1.Conversation.name, schema: conversation_schema_1.ConversationSchema },
                { name: fanpage_schema_1.Fanpage.name, schema: fanpage_schema_1.FanpageSchema },
            ]),
            openai_config_module_1.OpenAIConfigModule,
            product_module_1.ProductModule,
            media_module_1.MediaModule,
        ],
        providers: [chat_message_service_1.ChatMessageService, messenger_webhook_service_1.MessengerWebhookService, chat_events_service_1.ChatEventsService],
        controllers: [chat_message_controller_1.ChatMessageController, messenger_webhook_controller_1.MessengerWebhookController],
        exports: [chat_message_service_1.ChatMessageService, chat_events_service_1.ChatEventsService]
    })
], ChatMessageModule);
//# sourceMappingURL=chat-message.module.js.map