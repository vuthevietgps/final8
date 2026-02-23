import { IsOptional, IsString } from 'class-validator';
// DTO kiểm tra API key OpenAI
export class TestOpenAIKeyDto {
  @IsString() apiKey: string;
  @IsOptional() @IsString() model?: string;
}
