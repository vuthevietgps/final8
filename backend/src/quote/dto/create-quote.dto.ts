/**
 * File: dto/create-quote.dto.ts
 * Mục đích: Định nghĩa kiểu dữ liệu và ràng buộc validate cho yêu cầu tạo mới Báo giá.
 */
import { IsNotEmpty, IsNumber, IsString, IsOptional, IsMongoId, Min, MaxLength, IsIn } from 'class-validator';
import { Type, Transform } from 'class-transformer';

// Chuẩn hoá status về dạng chuẩn (tránh lỗi do dấu/Unicode khác nhau)
function normalizeStatus(input: any): string {
  if (input == null) return input;
  const raw = String(input).trim();
  const ascii = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const map: Record<string, string> = {
    'cho duyet': 'Chờ duyệt',
    'da duyet': 'Đã duyệt',
    'tu choi': 'Từ chối',
    'het hieu luc': 'Hết hiệu lực',
    // tiếng Anh phổ biến
    'pending': 'Chờ duyệt',
    'approved': 'Đã duyệt',
    'rejected': 'Từ chối',
    'expired': 'Hết hiệu lực',
  };
  return map[ascii] ?? raw;
}
import { QUOTE_STATUS_VALUES } from '../quote.enum';

export class CreateQuoteDto {
  @IsNotEmpty()
  @IsMongoId()
  productId: string;

  @IsOptional()
  @IsMongoId()
  agentId?: string; // Làm optional để hỗ trợ "áp dụng cho tất cả"

  @IsOptional()
  @IsString()
  product?: string; // Tên sản phẩm (tùy chọn, sẽ tự động điền theo productId nếu không gửi)

  @IsOptional()
  @IsString()
  agentName?: string; // Tên đại lý (tùy chọn, sẽ tự động điền theo agentId nếu không gửi)

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice: number; // Đổi từ price sang unitPrice

  @IsNotEmpty()
  @IsString()
  @IsIn(['Chờ duyệt', 'Đã duyệt', 'Từ chối', 'Hết hiệu lực'])
  @Transform(({ value }) => normalizeStatus(value))
  status: string;

  // Ngày bắt đầu hiệu lực
  @IsNotEmpty()
  @IsString()
  validFrom: string;

  // Ngày kết thúc hiệu lực
  @IsNotEmpty()
  @IsString()
  validUntil: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  // Tính năng mới: áp dụng cho tất cả đại lý
  @IsOptional()
  @Type(() => Boolean)
  applyToAllAgents?: boolean;
}
