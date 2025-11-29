"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeSummary4Derived = computeSummary4Derived;
function normalize(str) {
    return (str || '').trim();
}
function computeSummary4Derived(order, quote, existing) {
    var _a, _b;
    const unitPrice = Number((quote === null || quote === void 0 ? void 0 : quote.unitPrice) || 0) || 0;
    const qty = Number(order.quantity || 0) || 0;
    const cod = Number(order.codAmount || 0) || 0;
    const production = normalize(order.productionStatus);
    const status = normalize(order.orderStatus);
    const approvedQuotePrice = unitPrice;
    const mustPayToCompany = production === 'Đã trả kết quả' ? unitPrice * qty : 0;
    const paidToCompany = status === 'Giao thành công' ? cod : 0;
    const manualPayment = ((_b = (_a = order.manualPayment) !== null && _a !== void 0 ? _a : existing === null || existing === void 0 ? void 0 : existing.manualPayment) !== null && _b !== void 0 ? _b : 0) || 0;
    const needToPay = paidToCompany - mustPayToCompany - manualPayment;
    return {
        approvedQuotePrice,
        mustPayToCompany,
        paidToCompany,
        manualPayment,
        needToPay,
    };
}
//# sourceMappingURL=summary4-calculator.js.map