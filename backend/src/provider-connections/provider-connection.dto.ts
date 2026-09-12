import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { BirdApi, ConnectionKind } from './provider-connection.schema';

export class SaveProviderConnectionDto {
  @IsIn(['windsor-facebook', 'windsor-google', 'bird-messenger']) kind: ConnectionKind;
  @IsString() @Matches(/\S/) @MaxLength(100) name: string;
  // Keys never returned by the API. Omit on update to preserve the existing key.
  @IsOptional() @IsString() @Matches(/^[\x21-\x7E]{8,4096}$/) apiKey?: string;
  @IsOptional() @IsString() @Matches(/^[\x21-\x7E]{8,4096}$/) signingSecret?: string;
  @IsInt() @Min(0) revision: number;
  @IsIn(['configured', 'disabled']) state: 'configured' | 'disabled';
  @IsArray() @ArrayUnique() @ArrayMaxSize(75) @Matches(/^\d{1,30}$/, { each: true }) accountIds: string[];
  @IsOptional() @IsIn(['bird-v1', 'messagebird-v1']) birdApi?: BirdApi;
  @IsOptional() @IsString() @Matches(/^[a-fA-F0-9-]{32,36}$/) workspaceId?: string;
  @IsOptional() @IsString() @Matches(/^[a-fA-F0-9-]{32,36}$/) channelId?: string;
  @IsOptional() @IsString() @Matches(/^\d{1,30}$/) pageId?: string;
}
