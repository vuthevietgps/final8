/**
 * File: dto/update-order-status.dto.ts
 * Mục đích: Ràng buộc validate khi cập nhật trạng thái đơn hàng.
 */
import { PartialType } from '@nestjs/mapped-types';
import { CreateOrderStatusDto } from './create-order-status.dto';

/**
 * DTO cho việc cập nhật trạng thái đơn hàng
 * Kế thừa từ CreateOrderStatusDto với tất cả fields là optional
 */
export class UpdateOrderStatusDto extends PartialType(CreateOrderStatusDto) {}
