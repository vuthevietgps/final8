import { SupplierStatementDocument } from '../schemas/supplier-statement.schema';

/**
 * Helper functions for supplier statement calculations
 */

export function recalcStatementTotals(doc: SupplierStatementDocument) {
  const statementPayments = (doc.payments || []).reduce((s, p: any) => s + Number(p.amount || 0), 0);
  doc.statementPaymentTotal = statementPayments;
  doc.closingBalance = Number(doc.openingBalance || 0) + Number(doc.periodPayables || 0) - Number(doc.periodPayments || 0) - statementPayments;
  doc.netAfterCod = Number(doc.periodCodCollected || 0) - doc.closingBalance;
}
