import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Media, MediaSchema } from './schemas/media.schema';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { SyncMediaService } from './sync-media.service';
import { ProductModule } from '../product/product.module';
import { Product, ProductSchema } from '../product/schemas/product.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Media.name, schema: MediaSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    forwardRef(() => ProductModule)
  ],
  providers: [MediaService, SyncMediaService],
  controllers: [MediaController],
  exports: [MediaService, SyncMediaService]
})
export class MediaModule {}
