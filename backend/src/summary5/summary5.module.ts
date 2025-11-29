import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Summary5Controller } from './summary5.controller';
import { Summary5Service } from './summary5.service';
import { Summary5, Summary5Schema } from './schemas/summary5.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Summary5.name, schema: Summary5Schema }]),
  ],
  controllers: [Summary5Controller],
  providers: [Summary5Service],
})
export class Summary5Module {}
