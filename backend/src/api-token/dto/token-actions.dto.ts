/** DTOs cho các hành động validate / rotate / set-primary của ApiToken */
import { IsBoolean, IsMongoId, IsOptional, IsString } from 'class-validator';

// DTO: Validate token (không cần field ngoài tokenId param)
export class ValidateTokenDto {
  @IsOptional() @IsBoolean() force?: boolean; // ép kiểm tra lại
}

// DTO: Rotate (cung cấp token mới + optional ghi chú)
export class RotateTokenDto {
  @IsString() newToken: string;
  @IsOptional() @IsString() notes?: string;
}

// DTO: Set primary cho fanpage
export class SetPrimaryTokenDto {
  @IsMongoId() fanpageId: string;
}
