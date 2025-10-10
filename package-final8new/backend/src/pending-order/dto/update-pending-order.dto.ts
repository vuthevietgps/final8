import { PartialType } from '@nestjs/mapped-types';
import { CreatePendingOrderDto } from './create-pending-order.dto';
export class UpdatePendingOrderDto extends PartialType(CreatePendingOrderDto) {}
