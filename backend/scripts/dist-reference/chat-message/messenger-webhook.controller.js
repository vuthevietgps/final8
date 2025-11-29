"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var MessengerWebhookController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessengerWebhookController = void 0;
const common_1 = require("@nestjs/common");
const messenger_webhook_service_1 = require("./messenger-webhook.service");
let MessengerWebhookController = MessengerWebhookController_1 = class MessengerWebhookController {
    constructor(webhookService) {
        this.webhookService = webhookService;
        this.logger = new common_1.Logger(MessengerWebhookController_1.name);
        this.isDebugMode = process.env.CHAT_WEBHOOK_DEBUG === '1';
    }
    async verify(mode, token, challenge, res) {
        const expectedToken = process.env.MESSENGER_VERIFY_TOKEN ||
            process.env.FB_VERIFY_TOKEN ||
            'dev-verify-token';
        if (mode === 'subscribe' && token === expectedToken) {
            this.logger.log('Webhook verification successful');
            return res.status(200).send(challenge);
        }
        this.logger.warn('Webhook verification failed', { mode, token });
        return res.status(403).send('Verification failed');
    }
    async receive(body, res, req) {
        try {
            await this.webhookService.handle(body);
            return res.status(200).json({ status: 'ok' });
        }
        catch (error) {
            this.logger.error('Webhook processing failed', error.stack);
            return res.status(500).json({
                message: 'Webhook processing error',
                error: error.message
            });
        }
    }
};
exports.MessengerWebhookController = MessengerWebhookController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('hub.mode')),
    __param(1, (0, common_1.Query)('hub.verify_token')),
    __param(2, (0, common_1.Query)('hub.challenge')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], MessengerWebhookController.prototype, "verify", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], MessengerWebhookController.prototype, "receive", null);
exports.MessengerWebhookController = MessengerWebhookController = MessengerWebhookController_1 = __decorate([
    (0, common_1.Controller)('webhook/messenger'),
    __metadata("design:paramtypes", [messenger_webhook_service_1.MessengerWebhookService])
], MessengerWebhookController);
//# sourceMappingURL=messenger-webhook.controller.js.map