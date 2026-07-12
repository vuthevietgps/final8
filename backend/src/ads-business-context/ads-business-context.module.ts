import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdsBusinessContextController } from './ads-business-context.controller';
import { AdsBusinessContextService } from './ads-business-context.service';
import { BusinessDailyNote, BusinessDailyNoteSchema } from './schemas/business-daily-note.schema';
import { LandingPage, LandingPageSchema } from './schemas/landing-page.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: LandingPage.name, schema: LandingPageSchema },
    { name: BusinessDailyNote.name, schema: BusinessDailyNoteSchema },
  ])],
  controllers: [AdsBusinessContextController],
  providers: [AdsBusinessContextService],
  exports: [AdsBusinessContextService],
})
export class AdsBusinessContextModule {}
