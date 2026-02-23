"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var Summary4SyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Summary4SyncService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const summary4_schema_1 = require("./schemas/summary4.schema");
const test_order2_schema_1 = require("../test-order2/schemas/test-order2.schema");
const quote_schema_1 = require("../quote/schemas/quote.schema");
const summary4_calculator_1 = require("./summary4-calculator");
const summary4_repository_1 = require("./summary4-repository");
const summary4_google_sync_service_1 = require("./summary4-google-sync.service");
let Summary4SyncService = Summary4SyncService_1 = class Summary4SyncService {
    constructor(summary4Model, testOrder2Model, quoteModel, summary4Repo, summary4GoogleSyncService) {
        this.summary4Model = summary4Model;
        this.testOrder2Model = testOrder2Model;
        this.quoteModel = quoteModel;
        this.summary4Repo = summary4Repo;
        this.summary4GoogleSyncService = summary4GoogleSyncService;
        this.logger = new common_1.Logger(Summary4SyncService_1.name);
        this.debugEnabled = process.env.DEBUG_SUMMARY4 === 'true';
    }
    async syncFromTestOrder2() {
        var _a, _b, _c, _d;
        this.logger.log('Bắt đầu đồng bộ dữ liệu từ TestOrder2...');
        const result = { processed: 0, updated: 0, errors: [] };
        try {
            const testOrder2Records = await this.testOrder2Model
                .find({ isActive: true })
                .populate('agentId', 'fullName')
                .populate('productId', 'name')
                .sort({ createdAt: -1 })
                .exec();
            if (this.debugEnabled)
                this.logger.log(`Tìm thấy ${testOrder2Records.length} bản ghi TestOrder2`);
            for (const order of testOrder2Records) {
                result.processed++;
                try {
                    const orderIdObj = order === null || order === void 0 ? void 0 : order._id;
                    const existingSummary = await this.summary4Repo.findByTestOrder2IdFlexible(orderIdObj);
                    const agentName = ((_a = order.agentId) === null || _a === void 0 ? void 0 : _a.fullName) || 'Unknown Agent';
                    const productName = ((_b = order.productId) === null || _b === void 0 ? void 0 : _b.name) || 'Unknown Product';
                    const agentIdObjectId = ((_c = order.agentId) === null || _c === void 0 ? void 0 : _c._id) || order.agentId;
                    const productIdObjectId = ((_d = order.productId) === null || _d === void 0 ? void 0 : _d._id) || order.productId;
                    const agentIdString = agentIdObjectId === null || agentIdObjectId === void 0 ? void 0 : agentIdObjectId.toString();
                    const productIdString = productIdObjectId === null || productIdObjectId === void 0 ? void 0 : productIdObjectId.toString();
                    if (this.debugEnabled)
                        this.logger.debug(`Looking for quote: agentId=${agentIdString}, productId=${productIdString}, status='Đã duyệt'`);
                    const approvedQuote = await this.quoteModel.findOne({
                        $and: [
                            { $or: [{ agentId: agentIdString }, { agentId: new mongoose_2.Types.ObjectId(agentIdString) }] },
                            { $or: [{ productId: productIdString }, { productId: new mongoose_2.Types.ObjectId(productIdString) }] },
                            { status: 'Đã duyệt' },
                            { isActive: true },
                        ],
                    }).exec();
                    const { approvedQuotePrice, mustPayToCompany, paidToCompany, manualPayment, needToPay } = (0, summary4_calculator_1.computeSummary4Derived)({
                        productionStatus: order.productionStatus,
                        orderStatus: order.orderStatus,
                        codAmount: order.codAmount,
                        depositAmount: order.depositAmount,
                        quantity: order.quantity,
                        manualPayment: order === null || order === void 0 ? void 0 : order.manualPayment,
                    }, { unitPrice: approvedQuote === null || approvedQuote === void 0 ? void 0 : approvedQuote.unitPrice }, { manualPayment: existingSummary === null || existingSummary === void 0 ? void 0 : existingSummary.manualPayment });
                    const summaryData = {
                        orderDate: order.createdAt,
                        customerName: order.customerName,
                        product: productName,
                        quantity: order.quantity,
                        agentName: agentName,
                        adGroupId: order.adGroupId || '0',
                        isActive: order.isActive,
                        serviceDetails: order.serviceDetails,
                        productionStatus: order.productionStatus,
                        orderStatus: order.orderStatus,
                        submitLink: order.submitLink,
                        trackingNumber: order.trackingNumber,
                        depositAmount: order.depositAmount || 0,
                        codAmount: order.codAmount || 0,
                        agentId: agentIdObjectId,
                        productId: productIdObjectId,
                        approvedQuotePrice,
                        mustPayToCompany,
                        paidToCompany,
                        manualPayment,
                        needToPay,
                    };
                    await this.summary4Repo.upsertByTestOrder2Id(orderIdObj, summaryData);
                    result.updated++;
                }
                catch (error) {
                    result.errors.push(`TestOrder2 ${order._id}: ${error.message}`);
                }
            }
            if (this.debugEnabled)
                this.logger.log(`Hoàn thành đồng bộ: ${result.updated}/${result.processed} bản ghi`);
            this.logger.log(`🔄 Summary4 batch sync done. Google Sync is managed per-order in other flows.`);
            return result;
        }
        catch (error) {
            this.logger.error('Lỗi đồng bộ dữ liệu:', error);
            result.errors.push(`Lỗi chung: ${error.message}`);
            return result;
        }
    }
    async syncSingleOrder(orderId) {
        var _a, _b, _c, _d, _e;
        try {
            const order = await this.testOrder2Model
                .findById(orderId)
                .populate('agentId', 'fullName')
                .populate('productId', 'name')
                .exec();
            if (!order) {
                return { success: false, error: `Order ${orderId} not found` };
            }
            const agentName = ((_a = order.agentId) === null || _a === void 0 ? void 0 : _a.fullName) || 'Unknown Agent';
            const productName = ((_b = order.productId) === null || _b === void 0 ? void 0 : _b.name) || 'Unknown Product';
            const agentIdObjectId = ((_c = order.agentId) === null || _c === void 0 ? void 0 : _c._id) || order.agentId;
            const productIdObjectId = ((_d = order.productId) === null || _d === void 0 ? void 0 : _d._id) || order.productId;
            const agentIdString = agentIdObjectId === null || agentIdObjectId === void 0 ? void 0 : agentIdObjectId.toString();
            const productIdString = productIdObjectId === null || productIdObjectId === void 0 ? void 0 : productIdObjectId.toString();
            const orderIdObj = order === null || order === void 0 ? void 0 : order._id;
            const existingSummary4 = await this.summary4Repo.findByTestOrder2IdFlexible(orderIdObj);
            const oldAgentId = (_e = existingSummary4 === null || existingSummary4 === void 0 ? void 0 : existingSummary4.agentId) === null || _e === void 0 ? void 0 : _e.toString();
            const newAgentId = agentIdString;
            const agentChanged = oldAgentId && oldAgentId !== newAgentId;
            if (agentChanged) {
                this.logger.log(`🔄 Agent changed for order ${orderId}: ${oldAgentId} → ${newAgentId}`);
            }
            const approvedQuote = await this.quoteModel.findOne({
                $and: [
                    { $or: [{ agentId: agentIdString }, { agentId: new mongoose_2.Types.ObjectId(agentIdString) }] },
                    { $or: [{ productId: productIdString }, { productId: new mongoose_2.Types.ObjectId(productIdString) }] },
                    { status: 'Đã duyệt' },
                ],
            }).exec();
            const { approvedQuotePrice, mustPayToCompany, paidToCompany, manualPayment, needToPay } = (0, summary4_calculator_1.computeSummary4Derived)({
                productionStatus: order.productionStatus,
                orderStatus: order.orderStatus,
                codAmount: order.codAmount,
                depositAmount: order.depositAmount,
                quantity: order.quantity,
                manualPayment: order === null || order === void 0 ? void 0 : order.manualPayment,
            }, { unitPrice: approvedQuote === null || approvedQuote === void 0 ? void 0 : approvedQuote.unitPrice }, { manualPayment: existingSummary4 === null || existingSummary4 === void 0 ? void 0 : existingSummary4.manualPayment });
            const setData = {
                orderDate: order.createdAt,
                customerName: order.customerName,
                product: productName,
                quantity: order.quantity,
                agentId: agentIdObjectId,
                agentName: agentName,
                adGroupId: order.adGroupId,
                productionStatus: order.productionStatus,
                orderStatus: order.orderStatus,
                trackingNumber: order.trackingNumber,
                submitLink: order.submitLink,
                depositAmount: order.depositAmount,
                codAmount: order.codAmount,
                approvedQuotePrice,
                mustPayToCompany,
                paidToCompany,
                manualPayment,
                needToPay,
                updatedAt: new Date(),
                isActive: true,
            };
            await this.summary4Repo.upsertByTestOrder2Id(orderIdObj, setData);
            this.logger.log(`✅ Summary4 synced for single order ${orderId}, agent: ${agentIdString}`);
            if (agentChanged) {
                const agentIds = [oldAgentId, newAgentId].filter(Boolean);
                this.logger.log(`🔄 Agent change detected, need to sync both agents: ${agentIds.join(', ')}`);
                return { success: true, agentIds, oldAgentId, newAgentId };
            }
            return { success: true, agentIds: [agentIdString] };
        }
        catch (error) {
            this.logger.error(`Summary4 sync failed for order ${orderId}:`, error);
            return { success: false, error: (error === null || error === void 0 ? void 0 : error.message) || 'Unknown error' };
        }
    }
};
exports.Summary4SyncService = Summary4SyncService;
exports.Summary4SyncService = Summary4SyncService = Summary4SyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(summary4_schema_1.Summary4.name)),
    __param(1, (0, mongoose_1.InjectModel)(test_order2_schema_1.TestOrder2.name)),
    __param(2, (0, mongoose_1.InjectModel)(quote_schema_1.Quote.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        summary4_repository_1.Summary4Repository,
        summary4_google_sync_service_1.Summary4GoogleSyncService])
], Summary4SyncService);
//# sourceMappingURL=summary4-sync.service.js.map