import { IsArray, IsDateString, IsMongoId, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ReceiveItemDto {
  @IsMongoId()
  itemId!: string;

  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  qty!: number;
}

export class ReceiveItemsDto {
  @IsArray()
  @Type(() => ReceiveItemDto)
  items!: ReceiveItemDto[];

  @IsDateString()
  receivedAt!: string;
}
