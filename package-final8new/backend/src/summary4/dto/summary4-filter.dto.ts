import { Transform, Type } from 'class-transformer';
import { IsOptional, IsInt, Min, Max, IsIn, IsString, IsMongoId, IsDateString } from 'class-validator';

export class Summary4FilterDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page phải là số nguyên' })
  @Min(1, { message: 'Page phải >= 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit phải là số nguyên' })
  @Min(1, { message: 'Limit phải >= 1' })
  @Max(200, { message: 'Limit không được vượt quá 200' })
  limit?: number = 50;

  @IsOptional()
  @IsString()
  sortBy?: string = 'orderDate';

  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'sortOrder chỉ được là "asc" hoặc "desc"' })
  sortOrder?: 'asc' | 'desc' = 'desc';

  // Filter theo đại lý
  @IsOptional()
  @IsMongoId({ message: 'agentId phải là ObjectId hợp lệ' })
  agentId?: string;

  @IsOptional()
  @IsString()
  agentName?: string; // Tìm kiếm theo tên đại lý

  // Filter theo thời gian
  @IsOptional()
  @IsDateString({}, { message: 'startDate phải có định dạng ISO date' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'endDate phải có định dạng ISO date' })
  endDate?: string;

  // Filter theo trạng thái
  @IsOptional()
  @IsString()
  productionStatus?: string;

  @IsOptional()
  @IsString()
  orderStatus?: string;

  // Filter theo sản phẩm
  @IsOptional()
  @IsMongoId({ message: 'productId phải là ObjectId hợp lệ' })
  productId?: string;

  @IsOptional()
  @IsString()
  productName?: string; // Tìm kiếm theo tên sản phẩm

  // Filter theo khách hàng
  @IsOptional()
  @IsString()
  customerName?: string;

  // Filter theo thanh toán
  @IsOptional()
  @IsIn(['all', 'unpaid', 'paid', 'manual'], { message: 'paymentStatus phải là all, unpaid, paid hoặc manual' })
  paymentStatus?: 'all' | 'unpaid' | 'paid' | 'manual' = 'all';

  // Filter theo Ad Group
  @IsOptional()
  @IsString()
  adGroupId?: string;
}
