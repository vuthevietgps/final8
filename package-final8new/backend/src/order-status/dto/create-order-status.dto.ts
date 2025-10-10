/**
 * File: dto/create-order-status.dto.ts
 * Mục đích: Ràng buộc validate khi tạo mới trạng thái đơn hàng.
 */
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, Matches } from 'class-validator';

/**
 * DTO cho việc tạo mới trạng thái đơn hàng
 * Định nghĩa các trường bắt buộc và validation rules
 */
export class CreateOrderStatusDto {
  /**
   * Tên trạng thái đơn hàng (bắt buộc)
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

  /**
   * Có phải trạng thái cuối không (tùy chọn)
   */
  @IsOptional()
  @IsBoolean({ message: 'Trạng thái cuối phải là boolean' })
  isFinal?: boolean;

  /**
   * Icon đại diện (tùy chọn)
   */
  @IsOptional()
  @IsString({ message: 'Icon phải là chuỗi ký tự' })
  icon?: string;
}
