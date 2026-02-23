import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SupplierStatement, SupplierStatementDocument } from '../schemas/supplier-statement.schema';
import { TestOrder2 } from '../../test-order2/schemas/test-order2.schema';
import { User } from '../../user/user.schema';

/**
 * Generator for supplier statement PDF/HTML reports
 * 
 * TODO Production: Convert to real PDF using:
 *   - puppeteer (Chrome headless)
 *   - pdfkit (Node.js native)
 *   - wkhtmltopdf
 * 
 * Current: Returns HTML that browser can render/print
 */
@Injectable()
export class StatementPdfGenerator {
  constructor(
    @InjectModel(SupplierStatement.name) private statementModel: Model<SupplierStatementDocument>,
    @InjectModel(TestOrder2.name) private orderModel: Model<any>,
    @InjectModel(User.name) private userModel: Model<any>,
  ) {}

  async generate(id: string): Promise<Buffer> {
    const statement = await this.statementModel.findById(id).lean();
    if (!statement) throw new NotFoundException('Không tìm thấy kỳ đối soát');

    // Get supplier name from User collection
    const supplier: any = await this.userModel.findById(statement.supplierId).select('fullName email phone').lean();
    const supplierName = supplier?.fullName || supplier?.email || `NCC-${statement.supplierId.toString().slice(-6)}`;

    // Get detailed orders in this period
    const from = new Date(statement.periodFrom);
    const to = new Date(statement.periodTo);
    to.setHours(23, 59, 59, 999);
    
    const ordersInPeriod = await this.orderModel.find({
      supplierId: statement.supplierId,
      createdAt: { $gte: from, $lte: to },
      // Only include orders that have supplier cost (dropshipping orders)
      totalCost: { $exists: true, $gt: 0 }
    }).select('code totalCost codAmount orderStatus createdAt').sort({ createdAt: -1 }).lean();

    const html = this.generateHtml(statement, supplierName, ordersInPeriod);
    
    // In production: convert HTML to PDF using puppeteer or similar
    // For now, return HTML as buffer (browser will render it)
    return Buffer.from(html, 'utf-8');
  }

  private generateHtml(statement: any, supplierName: string, ordersInPeriod: any[]): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Biên bản đối soát công nợ</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; max-width: 1000px; margin: 0 auto; }
    h1 { text-align: center; color: #1f2937; }
    h2 { color: #374151; margin-top: 30px; }
    .header { margin-bottom: 30px; }
    .info { margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; }
    th { background: #f3f4f6; font-weight: bold; }
    .num { text-align: right; }
    .total { font-weight: bold; background: #fef3c7; }
    .footer { margin-top: 40px; display: flex; justify-content: space-between; }
    .signature { text-align: center; }
    .print-btn { 
      position: fixed; top: 20px; right: 20px; 
      padding: 10px 20px; background: #2563eb; color: white; 
      border: none; border-radius: 6px; cursor: pointer; 
      font-size: 14px; z-index: 1000; 
    }
    .print-btn:hover { background: #1d4ed8; }
    @media print {
      .print-btn { display: none; }
      body { padding: 20px; }
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨️ In biên bản</button>
  <h1>📊 BIÊN BẢN ĐỐI SOÁT CÔNG NỢ NHÀ CUNG CẤP</h1>
  
  <div class="header">
    <div class="info"><strong>Kỳ đối soát:</strong> ${new Date(statement.periodFrom).toLocaleDateString('vi-VN')} → ${new Date(statement.periodTo).toLocaleDateString('vi-VN')}</div>
    <div class="info"><strong>Tên nhà cung cấp:</strong> ${supplierName}</div>
    <div class="info"><strong>Trạng thái:</strong> ${statement.status === 'closed' ? '🔒 Đã chốt' : '📝 Chưa chốt'}</div>
    <div class="info"><strong>Ngày in:</strong> ${new Date().toLocaleString('vi-VN')}</div>
  </div>

  <h2>I. CHI TIẾT KỲ ĐỐI SOÁT</h2>
  <table>
    <thead>
      <tr>
        <th>Hạng mục</th>
        <th class="num">Số tiền (VND)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1. Số dư đầu kỳ (Opening Balance)</td>
        <td class="num">${statement.openingBalance.toLocaleString('vi-VN')}</td>
      </tr>
      <tr>
        <td>2. Phát sinh công nợ trong kỳ (Period Payables)</td>
        <td class="num">${statement.periodPayables.toLocaleString('vi-VN')}</td>
      </tr>
      <tr>
        <td>3. Thanh toán trong kỳ - từ payables (Period Payments)</td>
        <td class="num">${statement.periodPayments.toLocaleString('vi-VN')}</td>
      </tr>
      <tr>
        <td>4. Thanh toán theo kỳ đối soát (Statement Payments)</td>
        <td class="num">${statement.statementPaymentTotal.toLocaleString('vi-VN')}</td>
      </tr>
      <tr>
        <td>5. COD thu hộ trong kỳ (COD Collected)</td>
        <td class="num">${statement.periodCodCollected.toLocaleString('vi-VN')}</td>
      </tr>
      <tr class="total">
        <td><strong>Số dư cuối kỳ (Closing Balance)</strong></td>
        <td class="num"><strong>${statement.closingBalance.toLocaleString('vi-VN')}</strong></td>
      </tr>
      <tr class="total">
        <td><strong>Net After COD (COD - Closing)</strong></td>
        <td class="num"><strong>${statement.netAfterCod.toLocaleString('vi-VN')}</strong></td>
      </tr>
    </tbody>
  </table>

  ${this.generateOrdersSection(ordersInPeriod)}
  ${this.generatePaymentsSection(statement.payments)}
  ${this.generateNotesSection(statement.notes)}

  <div class="footer">
    <div class="signature">
      <p><strong>Đại diện Nhà cung cấp</strong></p>
      <p style="margin-top: 60px;">____________________</p>
      <p>Họ tên & Chữ ký</p>
    </div>
    <div class="signature">
      <p><strong>Đại diện Công ty</strong></p>
      <p style="margin-top: 60px;">____________________</p>
      <p>Họ tên & Chữ ký</p>
    </div>
  </div>
</body>
<script>
  // Add download button
  window.addEventListener('DOMContentLoaded', () => {
    const printBtn = document.querySelector('.print-btn');
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'print-btn';
    downloadBtn.style.right = '160px';
    downloadBtn.textContent = '💾 Tải HTML';
    downloadBtn.onclick = () => {
      const blob = new Blob([document.documentElement.outerHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'statement-${statement._id}.html';
      a.click();
      URL.revokeObjectURL(url);
    };
    printBtn.parentElement.insertBefore(downloadBtn, printBtn);
  });
</script>
</html>
    `;
  }

  private generateOrdersSection(ordersInPeriod: any[]): string {
    if (ordersInPeriod.length === 0) return '';

    return `
  <h2>II. DANH SÁCH ĐƠN HÀNG TRONG KỲ</h2>
  <table>
    <thead>
      <tr>
        <th>STT</th>
        <th>Mã đơn hàng</th>
        <th>Ngày tạo</th>
        <th class="num">Tổng giá vốn (VND)</th>
        <th class="num">COD (VND)</th>
        <th>Trạng thái</th>
      </tr>
    </thead>
    <tbody>
      ${ordersInPeriod.map((order: any, idx: number) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${order.code || '-'}</td>
          <td>${new Date(order.createdAt).toLocaleDateString('vi-VN')}</td>
          <td class="num">${(order.totalCost || 0).toLocaleString('vi-VN')}</td>
          <td class="num">${(order.codAmount || 0).toLocaleString('vi-VN')}</td>
          <td>${order.orderStatus || '-'}</td>
        </tr>
      `).join('')}
      <tr class="total">
        <td colspan="3"><strong>TỔNG CỘNG</strong></td>
        <td class="num"><strong>${ordersInPeriod.reduce((sum: number, o: any) => sum + (o.totalCost || 0), 0).toLocaleString('vi-VN')}</strong></td>
        <td class="num"><strong>${ordersInPeriod.reduce((sum: number, o: any) => sum + (o.codAmount || 0), 0).toLocaleString('vi-VN')}</strong></td>
        <td></td>
      </tr>
    </tbody>
  </table>
    `;
  }

  private generatePaymentsSection(payments: any[]): string {
    if (!payments || payments.length === 0) return '';

    return `
  <h2>III. CHI TIẾT THANH TOÁN</h2>
  <table>
    <thead>
      <tr>
        <th>Ngày thanh toán</th>
        <th>Số tiền</th>
        <th>Phương thức</th>
        <th>Mã tham chiếu</th>
        <th>Ghi chú</th>
      </tr>
    </thead>
    <tbody>
      ${payments.map((p: any) => `
        <tr>
          <td>${new Date(p.paidAt).toLocaleDateString('vi-VN')}</td>
          <td class="num">${p.amount.toLocaleString('vi-VN')}</td>
          <td>${p.method || '-'}</td>
          <td>${p.reference || '-'}</td>
          <td>${p.notes || '-'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
    `;
  }

  private generateNotesSection(notes?: string): string {
    if (!notes) return '';

    return `
  <h2>IV. GHI CHÚ</h2>
  <p>${notes}</p>
    `;
  }
}
