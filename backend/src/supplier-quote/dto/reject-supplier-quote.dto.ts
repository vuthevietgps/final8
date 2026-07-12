import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectSupplierQuoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
