import { Body, Controller, Get, Post, Query, Req, Res, Logger } from '@nestjs/common';
import { Response, Request } from 'express';
import { MessengerWebhookService } from './messenger-webhook.service';

// Heavy logic moved into MessengerWebhookService for maintainability

/**
 * Facebook Messenger Webhook Controller
 * 
 * Handles:
 * - GET: Webhook verification for Facebook
 * - POST: Receives messages and triggers AI auto-reply
 * 
 * Features:
 * - Automatic AI response based on fanpage configuration
 * - Message persistence to database
 * - Conversation state management
 */
@Controller('webhook/messenger')
export class MessengerWebhookController {
  private readonly logger = new Logger(MessengerWebhookController.name);
  private readonly isDebugMode = process.env.CHAT_WEBHOOK_DEBUG === '1';

  constructor(
    private readonly webhookService: MessengerWebhookService,
  ) {}

  /**
   * Webhook verification endpoint for Facebook
   */
  @Get()
  async verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
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

  /**
   * Webhook event receiver for Facebook Messenger
   */
  @Post()
  async receive(
    @Body() body: any, 
    @Res() res: Response, 
    @Req() req: Request
  ) {
    try {
      await this.webhookService.handle(body);
      return res.status(200).json({ status: 'ok' });
    } catch (error) {
      this.logger.error('Webhook processing failed', error.stack);
      return res.status(500).json({ 
        message: 'Webhook processing error', 
        error: error.message 
      });
    }
  }
}
