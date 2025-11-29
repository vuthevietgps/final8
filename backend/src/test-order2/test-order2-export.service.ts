import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TestOrder2, TestOrder2Document } from './schemas/test-order2.schema';

function toCsvRow(values: (string | number | null | undefined)[]) {
  return values
    .map((v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    })
    .join(',');
}

@Injectable()
export class TestOrder2ExportService {
  constructor(
    @InjectModel(TestOrder2.name) private model: Model<TestOrder2Document>,
  ) {}

  async exportCsv(query: any = {}) {
    const items = await this.model.find(query).sort({ createdAt: -1 }).lean();

    const header = [
      'orderDate','customerName','productId','quantity','agentId','adGroupId','productionStatus','orderStatus','trackingNumber','submitLink','depositAmount','codAmount','manualPayment','receiverName','receiverPhone','receiverAddress','createdAt','updatedAt'
    ];

    const rows = items.map((i) => [
      i.orderDate ? new Date(i.orderDate).toISOString() : '',
      i.customerName || '',
      i.productId ? String(i.productId) : '',
      i.quantity ?? 0,
      i.agentId ? String(i.agentId) : '',
      i.adGroupId || '',
      i.productionStatus || '',
      i.orderStatus || '',
      i.trackingNumber || '',
      i.submitLink || '',
      i.depositAmount ?? 0,
      i.codAmount ?? 0,
      i.manualPayment ?? 0,
      i.receiverName || '',
      i.receiverPhone || '',
      i.receiverAddress || '',
      i.createdAt ? new Date(i.createdAt).toISOString() : '',
      i.updatedAt ? new Date(i.updatedAt).toISOString() : '',
    ]);

    const csv = [toCsvRow(header), ...rows.map(toCsvRow)].join('\n');
    return { csv, count: items.length };
  }
}
