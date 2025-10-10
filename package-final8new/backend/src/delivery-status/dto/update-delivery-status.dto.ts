/**
 * File: dto/update-delivery-status.dto.ts
 * Mục đích: Ràng buộc validate khi cập nhật trạng thái giao hàng.
 */
import { PartialType } from '@nestjs/mapped-types';
import { CreateDeliveryStatusDto } from './create-delivery-status.dto';

export class UpdateDeliveryStatusDto extends PartialType(CreateDeliveryStatusDto) {}
