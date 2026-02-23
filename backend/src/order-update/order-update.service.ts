/**
 * File: order-update/order-update.service.ts
 * Mục đích: Service xử lý logic cập nhật thông tin đơn hàng từ file Excel VTP
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as XLSX from 'xlsx';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';
import { 
  ExcelRowData, 
  ProcessResult, 
  UpdateResult 
} from './dto/update-order-from-excel.dto';

@Injectable()
export class OrderUpdateService {
  constructor(
    @InjectModel(TestOrder2.name) 
    private testOrder2Model: Model<TestOrder2Document>
  ) {}

  // Excel column indices (0-based)
  private static readonly COL = {
    B_trackingNumber: 1,
    K_receiverName: 10,
    L_receiverAddress: 11,
    M_receiverPhone: 12,
    R_codAmount: 17,
    AG_orderStatus: 32,
  } as const;

  /**
   * Xử lý file Excel và cập nhật đơn hàng
   */
  async processExcelFile(file: Express.Multer.File): Promise<ProcessResult> {
    try {
      // Đọc file Excel
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Chuyển đổi thành JSON
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // Bỏ qua dòng header (dòng đầu tiên)
      const dataRows = rawData.slice(1) as any[][];
      
  // Found rows after header removal

      // Parse và validate dữ liệu Excel
      const excelData = this.parseExcelData(dataRows);
      
      // Nhóm theo trackingNumber và tính COD trung bình
      const groupedData = this.groupByTrackingNumber(excelData);
      
      // Xử lý cập nhật từng nhóm
      const result = await this.updateOrdersFromGroupedData(groupedData);
      
      return result;

    } catch (error) {
      console.error('❌ Lỗi xử lý file Excel:', error);
      throw new BadRequestException(`Lỗi đọc file Excel: ${error.message}`);
    }
  }

  /**
   * Kiểm tra số đơn hàng có thể cập nhật
   */
  async checkUpdateableStatus(file: Express.Multer.File) {
    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const dataRows = rawData.slice(1) as any[][];
      
      const excelData = this.parseExcelData(dataRows);
      const trackingNumbers = [...new Set(excelData.map(item => item.trackingNumber))];
      
  let updatable = 0;
  let completed = 0; // giữ field để tương thích response, nhưng luôn = 0 trong chế độ ghi đè
      let notFound = 0;
      
      for (const trackingNumber of trackingNumbers) {
        // Dùng cùng logic khớp mã vận đơn như khi cập nhật (xử lý leading zeros)
        const digitsOnly = /^[0-9]+$/.test(trackingNumber) ? trackingNumber.replace(/^0+/, '') : null;
        const findFilter: any = digitsOnly
          ? { $or: [
              { trackingNumber },
              { trackingNumber: { $regex: `^0*${digitsOnly}$` } }
            ] }
          : { trackingNumber };

        const orders = await this.testOrder2Model.find(findFilter).lean();
        
        if (orders.length === 0) {
          notFound++;
        } else {
          // Chế độ ghi đè: tất cả đơn tìm thấy đều có thể cập nhật
          updatable++;
        }
      }
      
      return {
        updatable,
        completed,
        notFound,
        total: trackingNumbers.length
      };

    } catch (error) {
      throw new BadRequestException(`Lỗi kiểm tra trạng thái: ${error.message}`);
    }
  }

  /**
   * Parse dữ liệu từ các dòng Excel
   */
  private parseExcelData(dataRows: any[][]): ExcelRowData[] {
    const result: ExcelRowData[] = [];
    
    // dataRows đã bỏ header ở bước trước, nên duyệt từ index 0
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      
      try {
        // Mapping theo yêu cầu:
        // B: trackingNumber, K: receiverName, L: receiverAddress, 
        // M: receiverPhone, R: codAmount, AG: orderStatus
        
  const trackingNumber = this.getCellValue(row, OrderUpdateService.COL.B_trackingNumber);
  const receiverName = this.getCellValue(row, OrderUpdateService.COL.K_receiverName);
  const receiverAddress = this.getCellValue(row, OrderUpdateService.COL.L_receiverAddress);
  const receiverPhone = this.getCellValue(row, OrderUpdateService.COL.M_receiverPhone);
  const codAmountRaw = this.getCellValue(row, OrderUpdateService.COL.R_codAmount);
  const orderStatus = this.getCellValue(row, OrderUpdateService.COL.AG_orderStatus);
        
        // Debug: Kiểm tra độ dài row và giá trị cột AG  
        if (trackingNumber && i < 5) { // Log 5 dòng đầu
          console.log(`🔍 Row ${i+2}: Len=${row.length}, AG(32)="${orderStatus}", B(1)="${trackingNumber}"`);
        }
        
        // Validate tracking number (bắt buộc)
        if (!trackingNumber) {
          continue; // Bỏ qua dòng không có mã vận đơn
        }
        
        // Chuyển đổi và validate COD amount
        let codAmount = 0;
        if (codAmountRaw) {
          const parsed = parseFloat(String(codAmountRaw).replace(/[^0-9.-]/g, ''));
          codAmount = isNaN(parsed) ? 0 : parsed;
        }
        
        const parsedItem = {
          trackingNumber: this.normalize(String(trackingNumber)),
          receiverName: this.normalize(receiverName),
          receiverAddress: this.normalize(receiverAddress),
          receiverPhone: this.normalize(receiverPhone),
          codAmount: codAmount,
          orderStatus: this.normalize(orderStatus)
        };
        
        // Debug log cho orderStatus
        if (parsedItem.trackingNumber) {
      // For early rows only
        }
        
        result.push(parsedItem);
        
      } catch (error) {
  console.warn(`⚠️ Lỗi parse dòng ${i + 2}:`, error.message);
        // Tiếp tục xử lý dòng khác
      }
    }
    
    console.log(`✅ Parse thành công ${result.length} dòng dữ liệu hợp lệ`);
    return result;
  }

  /**
   * Lấy giá trị cell an toàn
   */
  private getCellValue(row: any[], index: number): any {
    return row && row.length > index ? row[index] : null;
  }

  private normalize(v: unknown): string {
    if (v === null || v === undefined) return '';
    return String(v).trim().replace(/\s+/g, ' ');
  }

  /**
   * Nhóm dữ liệu theo trackingNumber và tính COD trung bình
   */
  private groupByTrackingNumber(excelData: ExcelRowData[]): Map<string, ExcelRowData> {
    const grouped = new Map<string, ExcelRowData[]>();
    
    // Nhóm theo tracking number
    for (const item of excelData) {
      const key = item.trackingNumber;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    }
    
    // Tạo dữ liệu đại diện cho mỗi nhóm
    const result = new Map<string, ExcelRowData>();
    
    for (const [trackingNumber, items] of grouped) {
      // Lấy item đầu tiên làm mẫu
      const representative = { ...items[0] };
      
      // Tính tổng COD của nhóm (để chia sau)
      const totalCod = items.reduce((sum, item) => sum + (item.codAmount || 0), 0);
      representative.codAmount = totalCod;
      
      result.set(trackingNumber, representative);
      
  // Grouping summary (optional)
    }
    
    return result;
  }

  /**
   * Cập nhật đơn hàng từ dữ liệu đã nhóm
   */
  private async updateOrdersFromGroupedData(
    groupedData: Map<string, ExcelRowData>
  ): Promise<ProcessResult> {
    const result: ProcessResult = {
      successCount: 0,
      errorCount: 0,
      skippedCount: 0,
      totalProcessed: 0,
      successItems: [],
      errors: [],
      skippedItems: [],
      message: ''
    };

    for (const [trackingNumber, excelItem] of groupedData) {
      try {
        result.totalProcessed++;
        
        // Tìm tất cả đơn hàng có cùng tracking number
        // Xử lý trường hợp Excel làm rơi số 0 ở đầu (leading zeros)
        const digitsOnly = /^[0-9]+$/.test(trackingNumber) ? trackingNumber.replace(/^0+/, '') : null;
        const findFilter: any = digitsOnly
          ? { $or: [
              { trackingNumber },
              // Khớp mọi giá trị trong DB có thể có 0* ở đầu so với chuỗi số trong Excel
              { trackingNumber: { $regex: `^0*${digitsOnly}$` } }
            ] }
          : { trackingNumber };

        const orders = await this.testOrder2Model.find(findFilter).lean();

        if (orders.length === 0) {
          result.errorCount++;
          result.errors.push({
            row: 0,
            message: `Không tìm thấy đơn hàng với mã vận đơn: ${trackingNumber}`,
            trackingNumber
          });
          continue;
        }

        // Ghi đè tất cả đơn hàng tìm thấy (không loại trừ "Giao thành công")
        const updatableOrders = orders;

        // Tính COD cho mỗi đơn (chia đều)
        const codPerOrder = (excelItem.codAmount || 0) / orders.length;

        // Build update $set object for batch update
        const updateSet: any = {};
        if (this.normalize(excelItem.receiverName)) updateSet.receiverName = this.normalize(excelItem.receiverName);
        if (this.normalize(excelItem.receiverPhone)) updateSet.receiverPhone = this.normalize(excelItem.receiverPhone);
        if (this.normalize(excelItem.receiverAddress)) updateSet.receiverAddress = this.normalize(excelItem.receiverAddress);
        const finalStatus = this.normalize(excelItem.orderStatus);
        if (finalStatus.length > 0) updateSet.orderStatus = finalStatus;
        if (codPerOrder > 0) updateSet.codAmount = Math.round(codPerOrder);

        if (Object.keys(updateSet).length === 0) {
          // Không có trường hợp lệ để cập nhật cho mã vận đơn này
          result.skippedCount++;
          result.skippedItems.push({
            trackingNumber,
            customerName: orders[0]?.customerName ?? '',
            reason: 'Không có dữ liệu hợp lệ để cập nhật'
          });
        } else {
          try {
            const updateFilter = findFilter;
            const updateResult = await this.testOrder2Model.updateMany(
              updateFilter,
              { $set: updateSet }
            );

            result.successItems.push({
              trackingNumber,
              customerName: orders[0].customerName,
              updatedFields: Object.keys(updateSet),
              oldValues: {},
              newValues: updateSet
            });

            // Chỉ tính thành công khi cập nhật không lỗi và có trường cập nhật
            result.successCount++;
          } catch (updateError) {
            console.error(`❌ Update error for tracking ${trackingNumber}:`, updateError);
            result.errorCount++;
            result.errors.push({
              row: 0,
              message: `Lỗi cập nhật tracking ${trackingNumber}: ${updateError.message}`,
              trackingNumber
            });
          }
        }


      } catch (error) {
        result.errorCount++;
        result.errors.push({
          row: 0,
          message: `Lỗi cập nhật tracking ${trackingNumber}: ${error.message}`,
          trackingNumber
        });
        console.error(`❌ Lỗi cập nhật tracking ${trackingNumber}:`, error);
      }
    }

    // Tạo thông báo tổng kết
    result.message = this.generateSummaryMessage(result);
    
  // Completed summary
    
    return result;
  }

  /**
   * Preview dữ liệu Excel mà không cập nhật database
   */
  async previewExcelData(file: Express.Multer.File) {
    try {
      // Đọc file Excel
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Chuyển đổi thành JSON
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const dataRows = rawData.slice(1) as any[][];
      
      // Parse dữ liệu
      const excelData = this.parseExcelData(dataRows);
      
      // Lấy 10 dòng đầu làm sample
      const sampleData = excelData.slice(0, 10).map(item => ({
        trackingNumber: item.trackingNumber,
        receiverName: item.receiverName,
        receiverPhone: item.receiverPhone,
        receiverAddress: item.receiverAddress,
        codAmount: item.codAmount,
        orderStatus: item.orderStatus
      }));
      
      return {
        sampleData,
        totalRows: excelData.length,
        mappingInfo: {
          'Cột B': 'Mã vận đơn (trackingNumber)',
          'Cột K': 'Tên người nhận (receiverName)',
          'Cột L': 'Địa chỉ (receiverAddress)',
          'Cột M': 'Số điện thoại (receiverPhone)',
          'Cột R': 'Số tiền COD (codAmount)',
          'Cột AG': 'Trạng thái vận đơn (orderStatus)'
        }
      };
      
    } catch (error) {
      throw new BadRequestException(`Lỗi preview Excel: ${error.message}`);
    }
  }

  /**
   * Tạo thông báo tổng kết
   */
  private generateSummaryMessage(result: ProcessResult): string {
    const parts = [];
    
    if (result.successCount > 0) {
      parts.push(`${result.successCount} vận đơn cập nhật thành công`);
    }
    
    if (result.skippedCount > 0) {
      parts.push(`${result.skippedCount} vận đơn đã hoàn thành (bỏ qua)`);
    }
    
    if (result.errorCount > 0) {
      parts.push(`${result.errorCount} vận đơn có lỗi`);
    }
    
    return parts.length > 0 
      ? parts.join(', ') + ` trong tổng ${result.totalProcessed} vận đơn.`
      : 'Không có dữ liệu để xử lý.';
  }

}