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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PendingOrderService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const pending_order_schema_1 = require("./schemas/pending-order.schema");
const test_order2_service_1 = require("../test-order2/test-order2.service");
const mongoose_3 = require("@nestjs/mongoose");
const mongoose_4 = require("mongoose");
let PendingOrderService = class PendingOrderService {
    constructor(model, testOrder2Service, conn) {
        this.model = model;
        this.testOrder2Service = testOrder2Service;
        this.conn = conn;
    }
    create(dto) { return new this.model(dto).save(); }
    async getAgents() {
        const roles = ['director', 'manager', 'employee', 'internal_agent', 'external_agent'];
        const users = await this.conn.collection('users').find({ role: { $in: roles }, isActive: { $ne: false } }, { projection: { _id: 1, fullName: 1, email: 1, role: 1 } }).limit(500).toArray();
        return users.map(u => ({
            _id: u._id,
            fullName: u.fullName || u.email,
            email: u.email,
            role: u.role
        }));
    }
    findAll(query = {}) {
        const filter = {};
        if (query.fanpageId)
            filter.fanpageId = query.fanpageId;
        if (query.status)
            filter.status = query.status;
        if (query.agentId)
            filter.agentId = query.agentId;
        return this.model.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    }
    async findOne(id) {
        const doc = await this.model.findById(id).lean();
        if (!doc)
            throw new common_1.NotFoundException('Pending order không tồn tại');
        return doc;
    }
    async update(id, dto) {
        const doc = await this.model.findByIdAndUpdate(id, dto, { new: true }).lean();
        if (!doc)
            throw new common_1.NotFoundException('Pending order không tồn tại');
        return doc;
    }
    async remove(id) { const res = await this.model.findByIdAndDelete(id); if (!res)
        throw new common_1.NotFoundException('Pending order không tồn tại'); }
    async approve(id, userId) {
        const pending = await this.model.findById(id);
        if (!pending)
            throw new common_1.NotFoundException('Pending order không tồn tại');
        if (pending.status === 'approved')
            throw new common_1.BadRequestException('Đơn đã được duyệt');
        const required = ['customerName', 'phone', 'address', 'adGroupId'];
        for (const field of required) {
            if (!pending[field])
                throw new common_1.BadRequestException(`Thiếu trường bắt buộc: ${field}`);
        }
        if (!pending.productId)
            throw new common_1.BadRequestException('Chưa chọn sản phẩm (productId)');
        const dto = {
            productId: pending.productId.toString(),
            customerName: pending.customerName,
            quantity: pending.quantity || 1,
            agentId: (pending.agentId ? pending.agentId.toString() : userId),
            adGroupId: pending.adGroupId || '0',
            isActive: true,
            productionStatus: 'Chưa làm',
            orderStatus: 'Chưa có mã vận đơn',
            serviceDetails: pending.notes,
            submitLink: undefined,
            trackingNumber: undefined,
            depositAmount: 0,
            codAmount: 0,
            manualPayment: 0,
            receiverName: pending.customerName,
            receiverPhone: pending.phone,
            receiverAddress: pending.address,
        };
        if (pending.orderDate) {
            dto.orderDate = pending.orderDate;
        }
        const order = await this.testOrder2Service.create(dto);
        pending.status = 'approved';
        await pending.save();
        try {
            await this.conn.collection('conversations').updateOne({ fanpageId: pending.fanpageId, senderPsid: pending.senderPsid }, { $set: {
                    orderId: order._id,
                    orderDraftStatus: 'approved',
                    orderCustomerName: pending.customerName,
                    orderPhone: pending.phone,
                } });
        }
        catch (_a) { }
        return { order, pending };
    }
};
exports.PendingOrderService = PendingOrderService;
exports.PendingOrderService = PendingOrderService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(pending_order_schema_1.PendingOrder.name)),
    __param(2, (0, mongoose_3.InjectConnection)()),
    __metadata("design:paramtypes", [mongoose_2.Model,
        test_order2_service_1.TestOrder2Service,
        mongoose_4.Connection])
], PendingOrderService);
//# sourceMappingURL=pending-order.service.js.map