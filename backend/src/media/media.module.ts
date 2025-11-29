import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Media, MediaSchema } from './schemas/media.schema';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { SyncMediaService } from './sync-media.service';
import { ProductModule } from '../product/product.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Media.name, schema: MediaSchema }
    ]),
    forwardRef(() => ProductModule)
  ],
  providers: [MediaService, SyncMediaService],
  controllers: [MediaController],
  exports: [MediaService, SyncMediaService]
})
export class MediaModule {}
