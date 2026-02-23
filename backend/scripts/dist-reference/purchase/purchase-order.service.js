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
exports.PurchaseOrderService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const create_purchase_order_dto_1 = require("./dto/create-purchase-order.dto");
const purchase_order_schema_1 = require("./schemas/purchase-order.schema");
const inventory_service_1 = require("../inventory/inventory.service");
let PurchaseOrderService = class PurchaseOrderService {
    constructor(poModel, inventory) {
        this.poModel = poModel;
        this.inventory = inventory;
    }
    calcTotals(dto) {
        const itemsTotal = (dto.items || []).reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
        const tax = Number(dto.tax || 0);
        const shippingFee = Number(dto.shippingFee || 0);
        const discount = Number(dto.discount || 0);
        const grandTotal = Math.max(0, itemsTotal + tax + shippingFee - discount);
        return { itemsTotal, tax, shippingFee, discount, grandTotal };
    }
    async create(dto) {
        if (!dto.items || dto.items.length === 0)
            throw new common_1.BadRequestException('Cần ít nhất 1 dòng hàng');
        const totals = this.calcTotals(dto);
        const doc = await this.poModel.create(Object.assign(Object.assign({ supplierId: new mongoose_2.Types.ObjectId(dto.supplierId), supplierNameSnap: dto.supplierNameSnap, status: dto.status || create_purchase_order_dto_1.PurchaseStatus.DRAFT, expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : undefined, items: dto.items.map(it => ({
                productId: new mongoose_2.Types.ObjectId(it.productId),
                productNameSnap: it.productNameSnap,
                quantity: Number(it.quantity),
                unitPrice: Number(it.unitPrice),
                currency: it.currency || 'VND',
                quantityReceived: 0,
            })) }, totals), { notes: dto.notes }));
        return doc.toObject();
    }
    async findAll(filter = {}) {
        const page = Math.max(1, Number(filter.page || 1));
        const limit = Math.max(1, Math.min(100, Number(filter.limit || 20)));
        const q = {};
        if (filter.supplierId)
            q.supplierId = new mongoose_2.Types.ObjectId(filter.supplierId);
        if (filter.status)
            q.status = filter.status;
        const [data, total] = await Promise.all([
            this.poModel.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            this.poModel.countDocuments(q),
        ]);
        return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }
    async findOne(id) {
        const doc = await this.poModel.findById(id).lean();
        if (!doc)
            throw new common_1.NotFoundException('Không tìm thấy PO');
        return doc;
    }
    async update(id, dto) {
        const po = await this.poModel.findById(id);
        if (!po)
            throw new common_1.NotFoundException('Không tìm thấy PO');
        if (dto.items && dto.items.length === 0)
            throw new common_1.BadRequestException('Cần ít nhất 1 dòng hàng');
        if (dto.supplierId)
            po.supplierId = new mongoose_2.Types.ObjectId(dto.supplierId);
        if (dto.supplierNameSnap !== undefined)
            po.supplierNameSnap = dto.supplierNameSnap;
        if (dto.status)
            po.status = dto.status;
        if (dto.expectedDeliveryDate !== undefined)
            po.expectedDeliveryDate = dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : undefined;
        if (dto.items) {
            const existingByProduct = new Map();
            for (const ex of (po.items || [])) {
                const key = String(ex.productId);
                const received = Number(ex.quantityReceived || 0);
                existingByProduct.set(key, Math.max(received, existingByProduct.get(key) || 0));
            }
            po.items = dto.items.map(it => {
                const productId = new mongoose_2.Types.ObjectId(it.productId);
                const quantity = Number(it.quantity);
                const prevReceived = existingByProduct.get(String(productId)) || 0;
                return {
                    productId,
                    productNameSnap: it.productNameSnap,
                    quantity,
                    unitPrice: Number(it.unitPrice),
                    currency: it.currency || 'VND',
                    quantityReceived: Math.min(prevReceived, quantity),
                    notes: it.notes,
                };
            });
        }
        if (dto.tax !== undefined)
            po.tax = Number(dto.tax);
        if (dto.shippingFee !== undefined)
            po.shippingFee = Number(dto.shippingFee);
        if (dto.discount !== undefined)
            po.discount = Number(dto.discount);
        const totals = this.calcTotals({ items: po.items, tax: po.tax, shippingFee: po.shippingFee, discount: po.discount });
        po.itemsTotal = totals.itemsTotal;
        po.tax = totals.tax;
        po.shippingFee = totals.shippingFee;
        po.discount = totals.discount;
        po.grandTotal = totals.grandTotal;
        await po.save();
        return po.toObject();
    }
    async remove(id) {
        const res = await this.poModel.findByIdAndDelete(id).lean();
        if (!res)
            throw new common_1.NotFoundException('Không tìm thấy PO');
        return res;
    }
    async receive(id, dto) {
        const po = await this.poModel.findById(id);
        if (!po)
            throw new common_1.NotFoundException('Không tìm thấy PO');
        const byId = new Map();
        for (const it of dto.items) {
            byId.set(String(it.itemId), Number(it.qtyReceived));
        }
        let anyReceived = false;
        const receivedForTx = [];
        po.items = (po.items || []).map((it) => {
            var _a;
            const qty = (_a = byId.get(String(it._id))) !== null && _a !== void 0 ? _a : byId.get(String(it.productId));
            if (qty && qty > 0) {
                it.quantityReceived = Math.min((it.quantityReceived || 0) + qty, it.quantity);
                anyReceived = true;
                receivedForTx.push({ productId: String(it.productId), quantity: Number(qty), unitPrice: Number(it.unitPrice || 0) });
            }
            return it;
        });
        if (!anyReceived)
            throw new common_1.BadRequestException('Không có số lượng nhận hợp lệ');
        const allReceived = po.items.every((it) => (it.quantityReceived || 0) >= it.quantity);
        po.status = allReceived ? create_purchase_order_dto_1.PurchaseStatus.RECEIVED : create_purchase_order_dto_1.PurchaseStatus.PARTIALLY_RECEIVED;
        if (allReceived)
            po.receivedDate = new Date();
        await po.save();
        try {
            const supplierId = po.supplierId ? String(po.supplierId) : undefined;
            await this.inventory.recordReceiveFromPO(String(po._id), supplierId, receivedForTx);
        }
        catch (e) {
        }
        return po.toObject();
    }
};
exports.PurchaseOrderService = PurchaseOrderService;
exports.PurchaseOrderService = PurchaseOrderService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(purchase_order_schema_1.PurchaseOrder.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        inventory_service_1.InventoryService])
], PurchaseOrderService);
//# sourceMappingURL=purchase-order.service.js.map