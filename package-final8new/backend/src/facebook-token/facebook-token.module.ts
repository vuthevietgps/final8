/**
 * File: facebook-token/facebook-token.module.ts
 * Mục đích: Module NestJS cho Facebook Token Management
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FacebookToken, FacebookTokenSchema } from './schemas/facebook-token.schema';
import { FacebookTokenService } from './facebook-token.service';
import { FacebookTokenController } from './facebook-token.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FacebookToken.name, schema: FacebookTokenSchema },
    ]),
  ],
  controllers: [FacebookTokenController],
  providers: [FacebookTokenService],
  exports: [FacebookTokenService], // Export để dùng ở Facebook Ads Sync
})
export class FacebookTokenModule {}