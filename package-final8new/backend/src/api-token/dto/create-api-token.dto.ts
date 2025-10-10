/** DTO tạo mới ApiToken */
import { IsEnum, IsMongoId, IsOptional, IsString, Length } from 'class-validator';

export class CreateApiTokenDto {
  @IsString() @Length(1,200) name: string;
  @IsString() token: string;
  @IsEnum(['facebook','zalo','other']) provider: 'facebook' | 'zalo' | 'other';
  @IsOptional() @IsEnum(['active','inactive']) status?: 'active' | 'inactive';
  @IsOptional() @IsMongoId() fanpageId?: string;
  @IsOptional() @IsString() notes?: string;
}
