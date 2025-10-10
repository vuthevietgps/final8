/**
 * File: dto/create-production-status.dto.ts
 * Mục đích: Ràng buộc validate khi tạo mới trạng thái sản xuất.
 */
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, Matches } from 'class-validator';

/**
 * DTO cho việc tạo mới trạng thái sản xuất
 * Định nghĩa các trường bắt buộc và validation rules
 */
export class CreateProductionStatusDto {
  /**
   * Tên trạng thái sản xuất (bắt buộc)
   */
  @IsString({ message: 'Tên trạng thái phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tên trạng thái không được để trống' })
  name: string;

  /**
   * Màu sắc hex (bắt buộc)
   * Phải đúng định dạng hex color (#RRGGBB)
   */
  @IsString({ message: 'Màu sắc phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Màu sắc không được để trống' })
  @Matches(/^#[0-9A-F]{6}$/i, { message: 'Màu sắc phải đúng định dạng hex (#RRGGBB)' })
  color: string;

  /**
   * Mô tả trạng thái (tùy chọn)
   */
  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi ký tự' })
  description?: string;

  /**
   * Thứ tự hiển thị (tùy chọn)
   */
  @IsOptional()
  @IsNumber({}, { message: 'Thứ tự phải là số' })
  order?: number;

  /**
   * Trạng thái hoạt động (tùy chọn)
   */
  @IsOptional()
  @IsBoolean({ message: 'Trạng thái hoạt động phải là boolean' })
  isActive?: boolean;
}
