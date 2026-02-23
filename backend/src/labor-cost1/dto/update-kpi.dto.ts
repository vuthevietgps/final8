import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

/**
 * DTO để Director/Manager nhập KPI cho phiếu lương
 * Bước 2 trong workflow: Tạo phiếu → Nhập KPI → Duyệt → Thanh toán
 */
export class UpdateKpiDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  kpiPercent!: number; // % hoàn thành KPI (0-100)

  @IsOptional()
  @IsString()
  updatedBy?: string; // Ai nhập (Director/Manager)
}
