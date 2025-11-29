import { IsArray, IsMongoId, IsNumber, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ReceiveItemDto {
  @IsMongoId()
  itemId!: string;

  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  qtyReceived!: number;
}

export class ReceivePurchaseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveItemDto)
  items!: ReceiveItemDto[];
}
