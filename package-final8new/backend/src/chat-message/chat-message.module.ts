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

@Module({
  imports: [
    MongooseModule.forFeature([
    { name: ChatMessage.name, schema: ChatMessageSchema },
    { name: Conversation.name, schema: ConversationSchema },
    { name: Fanpage.name, schema: FanpageSchema },
    ]),
    OpenAIConfigModule,
    ProductModule,
  ],
  providers: [ChatMessageService],
  controllers: [ChatMessageController, MessengerWebhookController],
  exports: [ChatMessageService]
})
export class ChatMessageModule {}
