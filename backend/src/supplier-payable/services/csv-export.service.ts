import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SupplierPayable, SupplierPayableDocument } from '../schemas/supplier-payable.schema';

/**
 * Service responsible for exporting payables to CSV format
 */
@Injectable()
export class CsvExportService {
  constructor(
    @InjectModel(SupplierPayable.name) private payableModel: Model<SupplierPayableDocument>,
  ) {}

  async exportCsv(params: { supplierId?: string; from?: string; to?: string; status?: string }): Promise<string> {
    const from = params.from ? new Date(params.from) : undefined;
    const to = params.to ? new Date(params.to) : undefined;
    if (to) to.setHours(23, 59, 59, 999);

    const match: any = {};
    if (params.supplierId) match.supplierId = new Types.ObjectId(params.supplierId);
    if (params.status) match.status = params.status;
    if (from || to) {
      match.createdAt = {} as any;
      if (from) match.createdAt.$gte = from;
      if (to) match.createdAt.$lte = to;
    }

    const payables = await this.payableModel.find(match).sort({ createdAt: -1 }).lean();
    const lines: string[] = [];
    const header = ['type','date','orderId','totalAmount','paymentAmount','codCollected','status','reference','notes'];
    lines.push(header.join(','));

    const inRangePayment = (paidAt: Date) => {
      if (from && paidAt < from) return false;
      if (to && paidAt > to) return false;
      return true;
    };

    const toCsvVal = (v: any) => {
      if (v === undefined || v === null) return '';
      const s = String(v).replace(/"/g, '""');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s}"`;
      return s;
    };

    for (const p of payables as any[]) {
      const createdAt = p.createdAt;
      lines.push([
        'payable',
        createdAt?.toISOString?.() || '',
        p.orderId || '',
        p.totalAmount ?? 0,
        '',
        '',
        p.status || '',
        '',
        p.notes || '',
      ].map(toCsvVal).join(','));

      if (p.payments && Array.isArray(p.payments)) {
        for (const pay of p.payments) {
          if (!inRangePayment(pay.paidAt)) continue;
          lines.push([
            'payment',
            pay.paidAt?.toISOString?.() || '',
            p.orderId || '',
            '',
            pay.amount ?? 0,
            '',
            '',
            pay.reference || '',
            pay.notes || '',
          ].map(toCsvVal).join(','));
        }
      }
    }

    return lines.join('\n');
  }
}
