/**
 * Module: ApiTokenModule
 * Gom nhóm controller + service + schema quản lý API Tokens.
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiToken, ApiTokenSchema } from './schemas/api-token.schema';
import { ApiTokenAudit, ApiTokenAuditSchema } from './schemas/api-token-audit.schema';
import { Fanpage, FanpageSchema } from '../fanpage/schemas/fanpage.schema';
import { ApiTokenService } from './api-token.service';
import { ApiTokenScheduler } from './api-token.scheduler';
import { ApiTokenController } from './api-token.controller';

@Module({
  imports: [MongooseModule.forFeature([
    { name: ApiToken.name, schema: ApiTokenSchema },
    { name: Fanpage.name, schema: FanpageSchema },
    { name: ApiTokenAudit.name, schema: ApiTokenAuditSchema }
  ])],
  providers: [ApiTokenService, ApiTokenScheduler],
  controllers: [ApiTokenController],
  exports: [ApiTokenService]
})
export class ApiTokenModule {}
