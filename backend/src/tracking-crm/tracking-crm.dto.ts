import { IsIn, IsInt, IsMongoId, IsOptional, IsString, Max, MaxLength, Min, IsDateString } from 'class-validator';

export class TrackingVersionDto {
  @IsInt() @Min(0) version: number;
}
export class SaveTrackingLeadDto extends TrackingVersionDto {
  @IsOptional() @IsDateString() contactedAt?: string;
  @IsOptional() @IsDateString() nextFollowUpAt?: string;
  @IsOptional() @IsIn(['phone', 'zalo', 'inbox', 'form_submit', 'contact']) contactChannel?: string;
  @IsOptional() @IsMongoId() matchedEventId?: string;
  @IsOptional() @IsIn(['unknown', 'approximate', 'verified']) matchConfidence?: string;
  @IsOptional() @IsString() @MaxLength(200) customerName?: string;
  @IsOptional() @IsString() @MaxLength(200) recipientName?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(1000) shippingAddress?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsIn(['noted', 'confirmed', 'cancelled']) status: string;
  @IsOptional() @IsMongoId() agentId?: string;
  @IsOptional() @IsMongoId() supplierId?: string;
  @IsOptional() @IsMongoId() productId?: string;
  @IsOptional() @IsString() @MaxLength(200) adSelectionKey?: string;
  @IsOptional() @IsDateString() orderDate?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100000) quantity?: number;
  @IsOptional() @IsInt() @Min(0) @Max(9999999999999) saleTotal?: number;
  @IsOptional() @IsInt() @Min(0) @Max(9999999999999) deposit?: number;
  @IsOptional() @IsInt() @Min(0) @Max(9999999999999) codAmount?: number;
  @IsOptional() @IsString() @MaxLength(1000) matchEvidence?: string;
}
export class LinkTrackingOrderDto extends TrackingVersionDto {
  @IsMongoId() orderId: string;
}
