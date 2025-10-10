/**
 * File: test-order2/dto/update-test-order2.dto.ts
 * Mục đích: DTO cho cập nhật Đơn Hàng Thử Nghiệm 2.
 * Lưu ý: Khai báo tường minh các field optional, KHÔNG khai mặc định,
 * để tránh trường hợp cập nhật một field làm ghi đè field khác bằng giá trị mặc định.
 */
import { IsBoolean, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateTestOrder2Dto {
	@IsOptional()
	@IsMongoId()
	productId?: string;

	@IsOptional()
	@IsString()
	customerName?: string;

	@IsOptional()
	@IsNumber()
	@Min(1)
	quantity?: number;

	@IsOptional()
	@IsMongoId()
	agentId?: string;

	@IsOptional()
	@IsString()
	adGroupId?: string;

	@IsOptional()
	@IsBoolean()
	isActive?: boolean;

	@IsOptional()
	@IsString()
	serviceDetails?: string;

	@IsOptional()
	@IsString()
	productionStatus?: string;

	@IsOptional()
	@IsString()
	orderStatus?: string;

	@IsOptional()
	@IsString()
	submitLink?: string;

	@IsOptional()
	@IsString()
	trackingNumber?: string;

	@IsOptional()
	@IsNumber()
	@Min(0)
	depositAmount?: number;

	@IsOptional()
	@IsNumber()
	@Min(0)
	codAmount?: number;

	@IsOptional()
	@IsNumber()
	@Min(0)
	manualPayment?: number;

	@IsOptional()
	@IsString()
	receiverName?: string;

	@IsOptional()
	@IsString()
	receiverPhone?: string;

	@IsOptional()
	@IsString()
	receiverAddress?: string;
}
