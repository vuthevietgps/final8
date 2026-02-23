import { IsBoolean, IsDateString, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Length } from 'class-validator';

export class CreateFanpageDto {
  @IsString() @Length(1, 100) pageId: string;
  @IsString() @Length(1, 200) name: string;
  @IsString() accessToken: string;
  @IsOptional() @IsEnum(['active','inactive']) status?: 'active' | 'inactive';
  @IsOptional() @IsDateString() connectedAt?: string;
  @IsOptional() @IsMongoId() connectedBy?: string;
  @IsOptional() @IsMongoId() defaultProductGroup?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() greetingScript?: string;
  @IsOptional() @IsString() clarifyScript?: string;
  @IsOptional() @IsString() productSuggestScript?: string;
  @IsOptional() @IsString() fallbackScript?: string;
  @IsOptional() @IsString() closingScript?: string;
  @IsOptional() @IsBoolean() aiEnabled?: boolean;
  @IsOptional() @IsBoolean() subscribedWebhook?: boolean;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsNumber() messageQuota?: number;
  @IsOptional() @IsNumber() subscriberCount?: number;
  @IsOptional() @IsNumber() sentThisMonth?: number;
  @IsOptional() @IsMongoId() openAIConfigId?: string;
}
