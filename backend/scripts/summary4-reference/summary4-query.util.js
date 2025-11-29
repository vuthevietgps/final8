"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUMMARY4_SORTABLE_FIELDS = void 0;
exports.buildQueryFromFilter = buildQueryFromFilter;
exports.buildSortFromFilter = buildSortFromFilter;
const mongoose_1 = require("mongoose");
exports.SUMMARY4_SORTABLE_FIELDS = new Set([
    'orderDate', 'customerName', 'product', 'quantity', 'agentName', 'adGroupId',
    'approvedQuotePrice', 'mustPayToCompany', 'paidToCompany', 'manualPayment', 'needToPay'
]);
function buildQueryFromFilter(filter = {}) {
    const query = {};
    if (!filter)
        return query;
    if (filter.agentId)
        query.agentId = new mongoose_1.Types.ObjectId(filter.agentId);
    if (filter.productionStatus)
        query.productionStatus = filter.productionStatus;
    if (filter.orderStatus)
        query.orderStatus = filter.orderStatus;
    if (filter.adGroupId)
        query.adGroupId = filter.adGroupId;
    if (filter.productId)
        query.productId = new mongoose_1.Types.ObjectId(filter.productId);
    if (filter.customerName)
        query.customerName = { $regex: filter.customerName, $options: 'i' };
    if (filter.productName)
        query.product = { $regex: filter.productName, $options: 'i' };
    if (filter.agentName)
        query.agentName = { $regex: filter.agentName, $options: 'i' };
    if (filter.startDate || filter.endDate) {
        const range = {};
        if (filter.startDate) {
            const d = new Date(filter.startDate);
            range.$gte = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
        }
        if (filter.endDate) {
            const d = new Date(filter.endDate);
            range.$lte = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
        }
        query.orderDate = range;
    }
    if (filter.paymentStatus === 'unpaid') {
        query.needToPay = { $gt: 0 };
    }
    else if (filter.paymentStatus === 'paid') {
        query.needToPay = { $lte: 0 };
    }
    else if (filter.paymentStatus === 'manual') {
        query.manualPayment = { $gt: 0 };
    }
    return query;
}
function buildSortFromFilter(filter = {}) {
    const sortBy = exports.SUMMARY4_SORTABLE_FIELDS.has((filter === null || filter === void 0 ? void 0 : filter.sortBy) || '')
        ? filter.sortBy
        : 'orderDate';
    const sortOrder = ((filter === null || filter === void 0 ? void 0 : filter.sortOrder) === 'asc') ? 1 : -1;
    return { [sortBy]: sortOrder };
}
//# sourceMappingURL=summary4-query.util.js.map