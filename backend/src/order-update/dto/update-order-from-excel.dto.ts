import { IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateOrderFromExcelDto {
  @IsNotEmpty({ message: 'File Excel không được để trống' })
  file: Express.Multer.File;
}

export interface ExcelRowData {
  trackingNumber: string;     // Cột B
  receiverName: string;       // Cột K  
  receiverAddress: string;    // Cột L
  receiverPhone: string;      // Cột M
  codAmount: number;          // Cột R
  orderStatus: string;        // Cột AG
}

export interface UpdateResult {
  trackingNumber: string;
  customerName: string;
  updatedFields: string[];
  oldValues: any;
  newValues: any;
}

export interface ProcessResult {
  successCount: number;
  errorCount: number;
  totalProcessed: number;
  skippedCount: number; // Đơn hàng đã "Giao thành công"
  successItems: UpdateResult[];
  errors: {
    row: number;
    message: string;
    trackingNumber?: string;
  }[];
  skippedItems: {
    trackingNumber: string;
    customerName: string;
    reason: string;
  }[];
  message: string;
}