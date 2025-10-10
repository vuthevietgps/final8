/**
 * File: dto/create-user.dto.ts
 * Mục đích: Ràng buộc validate khi tạo mới Người dùng.
 */
/**
 * Create User DTO - Data Transfer Object cho việc tạo user mới
 * 
 * Chức năng:
 * - Định nghĩa structure của data khi tạo user
 * - Validation input từ frontend
 * - Type safety cho API endpoint POST /users
 * - Đảm bảo required fields được cung cấp
 */

import { IsString, IsEmail, IsEnum, IsOptional, IsBoolean, IsArray, ArrayNotEmpty, ArrayUnique, IsIP } from 'class-validator';
import { UserRole } from '../user.enum';

export class CreateUserDto {
  /**
   * Họ và tên đầy đủ của user
   * Required field - không được để trống
   */
  @IsString()
  fullName: string;

  /**
   * Email của user - phải unique trong hệ thống
   * Required field với validation email format
   */
  @IsEmail()
  email: string;

  /**
   * Mật khẩu của user
   * Required field - sẽ được hash trước khi lưu
   */
  @IsString()
  password: string;

  /**
   * Số điện thoại của user
   * Required field
   */
  @IsString()
  phone: string;

  /**
   * Role/vai trò của user trong hệ thống
   * Required field - phải thuộc enum UserRole
   */
  @IsEnum(UserRole)
  role: UserRole;

  /**
   * Địa chỉ của user
   * Optional field - có thể để trống
   */
  @IsOptional()
  @IsString()
  address?: string;

  /**
   * Trạng thái hoạt động của user
   * Optional field - mặc định là true
   */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * ID của phòng ban mà user thuộc về
   * Optional field - reference đến Department collection
   */
  @IsOptional()
  @IsString()
  departmentId?: string;

  /**
   * ID của manager quản lý user này
   * Optional field - reference đến User collection (self-reference)
   */
  @IsOptional()
  @IsString()
  managerId?: string;

  /**
   * Ghi chú bổ sung về user
   * Optional field - thông tin thêm
   */
  @IsOptional()
  @IsString()
  notes?: string;

  /**
   * Link Google Drive của user
   * Optional field - URL string
   */
  @IsOptional()
  @IsString()
  googleDriveLink?: string;

  /**
   * Danh sách IP được phép đăng nhập (chỉ bắt buộc với Manager/Employee)
   * Optional ở DTO (bắt buộc sẽ kiểm tra ở logic auth theo role)
   */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIP(undefined, { each: true })
  allowedLoginIps?: string[];
}
