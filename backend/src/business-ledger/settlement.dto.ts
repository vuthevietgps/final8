import {Type} from 'class-transformer';
import {ArrayMaxSize,ArrayMinSize,ArrayUnique,IsArray,IsDateString,IsIn,IsInt,IsMongoId,IsNotEmpty,IsOptional,IsString,Matches,MaxLength,ValidateNested} from 'class-validator';
export class CreateSettlementDto {
  @IsString() @IsNotEmpty() @MaxLength(120) requestKey!:string;
  @Matches(/^(supplier|agent):[a-f0-9]{24}$/i) partyKey!:string;
  @IsString() @IsNotEmpty() sourceHash!:string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ArrayUnique() @IsString({each:true}) orderIds!:string[];
  @IsString() @IsNotEmpty() @MaxLength(500) evidence!:string;
}
export class ConfirmSettlementDto { @IsString() @IsNotEmpty() @MaxLength(500) evidence!:string; }
export class ReverseSettlementDto {
  @IsString() @IsNotEmpty() @MaxLength(120) requestKey!:string;
  @IsString() @IsNotEmpty() @MaxLength(120) originalKey!:string;
  @IsString() @IsNotEmpty() @MaxLength(500) evidence!:string;
}
export class SettlementAllocationDto {
  @IsString() @IsNotEmpty() orderId!:string;
  @IsInt() amount!:number;
}
export class SettlementOperationDto {
  @IsDateString() occurredAt!:string;
  @IsOptional() @IsString() @MaxLength(150) reference?:string;
  @IsString() @IsNotEmpty() @MaxLength(120) requestKey!:string;
  @IsString() @IsNotEmpty() sourceHash!:string;
  @IsIn(['payment','offset']) mode!:'payment'|'offset';
  @IsOptional() @IsMongoId() accountId?:string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({each:true}) @Type(()=>SettlementAllocationDto) allocations!:SettlementAllocationDto[];
  @IsString() @IsNotEmpty() @MaxLength(500) evidence!:string;
}
