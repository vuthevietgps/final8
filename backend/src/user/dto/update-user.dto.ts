/**
 * File: dto/update-user.dto.ts
 * Mục đích: Ràng buộc validate khi cập nhật Người dùng.
 */
/**
 * Update User DTO - Data Transfer Object cho việc cập nhật user
 * 
 * Chức năng:
 * - Kế thừa từ CreateUserDto và làm tất cả fields optional
 * - Validation input cho API endpoint PATCH /users/:id
 * - Type safety cho việc update partial data
 * - Cho phép update từng field riêng lẻ hoặc nhiều fields cùng lúc
 */

import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

/**
 * UpdateUserDto kế thừa từ CreateUserDto nhưng tất cả fields đều optional
 * Điều này cho phép client gửi chỉ những fields cần update
 * PartialType tự động làm tất cả properties thành optional
 */
// Bao gồm cả allowedLoginIps như optional
export class UpdateUserDto extends PartialType(CreateUserDto) {}
