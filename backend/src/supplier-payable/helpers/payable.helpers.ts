import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { SupplierPayableDocument } from '../schemas/supplier-payable.schema';

/**
 * Helper functions for supplier payable calculations
 */

export function computeTotals(
  items: { quantity: number; unitPrice: number; amount?: number }[],
  providedTotal?: number
) {
  const total = providedTotal !== undefined
    ? Number(providedTotal) || 0
    : (items || []).reduce((s, it) => s + Number(it.amount ?? (Number(it.quantity || 0) * Number(it.unitPrice || 0))), 0);
  return { totalAmount: total };
}

export function recalcPayableBalance(doc: SupplierPayableDocument) {
  doc.balance = Math.max(0, Number(doc.totalAmount || 0) - Number(doc.amountPaid || 0));
  if (doc.amountPaid <= 0) doc.status = 'unpaid';
  else if (doc.balance <= 0.0001) doc.status = 'paid';
  else doc.status = 'partial';
}

export function buildPeriodFilter(from?: Date, to?: Date) {
  if (!from && !to) return undefined;
  const range: any = {};
  if (from) range.$gte = from;
  if (to) range.$lte = to;
  return range;
}

export function assertObjectId(id: string, label = 'id') {
  if (!id || !Types.ObjectId.isValid(id)) {
    throw new BadRequestException(`Giá trị ${label} không hợp lệ`);
  }
  return new Types.ObjectId(id);
}
