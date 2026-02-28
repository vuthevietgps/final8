import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatMessage, ChatMessageSchema } from './schemas/chat-message.schema';
import { ChatMessageService } from './chat-message.service';
import { ChatMessageController } from './chat-message.controller';
import { MessengerWebhookController } from './messenger-webhook.controller';
import { Conversation, ConversationSchema } from './schemas/conversation.schema';
import { Fanpage, FanpageSchema } from '../fanpage/schemas/fanpage.schema';
import { OpenAIConfigModule } from '../openai-config/openai-config.module';
import { ProductModule } from '../product/product.module';
import { MediaModule } from '../media/media.module';

import { MessengerWebhookService } from './messenger-webhook.service';
import { ChatEventsService } from './chat-events.service';
import { AiDeliveryRecoveryService } from './ai-delivery-recovery.service';

@Module({
  imports: [
    MongooseModule.forFeature([
    { name: ChatMessage.name, schema: ChatMessageSchema },
    { name: Conversation.name, schema: ConversationSchema },
    { name: Fanpage.name, schema: FanpageSchema },
    ]),
    OpenAIConfigModule,
    ProductModule,
    MediaModule,
  ],
  providers: [ChatMessageService, MessengerWebhookService, ChatEventsService, AiDeliveryRecoveryService],
  controllers: [ChatMessageController, MessengerWebhookController],
  exports: [ChatMessageService, ChatEventsService]
})
export class ChatMessageModule {}
