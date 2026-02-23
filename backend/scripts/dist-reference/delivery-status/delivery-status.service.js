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
exports.DeliveryStatusService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const delivery_status_schema_1 = require("./schemas/delivery-status.schema");
let DeliveryStatusService = class DeliveryStatusService {
    constructor(deliveryStatusModel) {
        this.deliveryStatusModel = deliveryStatusModel;
    }
    async create(createDeliveryStatusDto) {
        if (!createDeliveryStatusDto.order) {
            const count = await this.deliveryStatusModel.countDocuments();
            createDeliveryStatusDto.order = count + 1;
        }
        const deliveryStatus = new this.deliveryStatusModel(createDeliveryStatusDto);
        return deliveryStatus.save();
    }
    async findAll() {
        return this.deliveryStatusModel.find().sort({ order: 1 }).exec();
    }
    async findOne(id) {
        const deliveryStatus = await this.deliveryStatusModel.findById(id).exec();
        if (!deliveryStatus) {
            throw new common_1.NotFoundException(`Delivery status with ID ${id} not found`);
        }
        return deliveryStatus;
    }
    async update(id, updateDeliveryStatusDto) {
        const deliveryStatus = await this.deliveryStatusModel
            .findByIdAndUpdate(id, updateDeliveryStatusDto, { new: true })
            .exec();
        if (!deliveryStatus) {
            throw new common_1.NotFoundException(`Delivery status with ID ${id} not found`);
        }
        return deliveryStatus;
    }
    async remove(id) {
        const result = await this.deliveryStatusModel.findByIdAndDelete(id).exec();
        if (!result) {
            throw new common_1.NotFoundException(`Delivery status with ID ${id} not found`);
        }
    }
    async updateOrder(orderId, newOrder) {
        return this.update(orderId, { order: newOrder });
    }
    async getActiveStatuses() {
        return this.deliveryStatusModel.find({ isActive: true }).sort({ order: 1 }).exec();
    }
    async getFinalStatuses() {
        return this.deliveryStatusModel.find({ isFinal: true }).sort({ order: 1 }).exec();
    }
    async getStatsSummary() {
        const total = await this.deliveryStatusModel.countDocuments();
        const active = await this.deliveryStatusModel.countDocuments({ isActive: true });
        const inactive = total - active;
        const finalStatuses = await this.deliveryStatusModel.countDocuments({ isFinal: true });
        return {
            total,
            active,
            inactive,
            finalStatuses,
            averageEstimatedDays: await this.getAverageEstimatedDays()
        };
    }
    async getAverageEstimatedDays() {
        const statuses = await this.deliveryStatusModel.find({ estimatedDays: { $exists: true, $ne: null } });
        if (statuses.length === 0)
            return 0;
        const sum = statuses.reduce((acc, status) => acc + (status.estimatedDays || 0), 0);
        return Math.round(sum / statuses.length);
    }
    async seedSampleData() {
        await this.deliveryStatusModel.deleteMany({});
        const sampleData = [
            {
                name: 'Chờ xử lý',
                description: 'Đơn hàng đang chờ được xử lý',
                color: '#f39c12',
                icon: '⏳',
                isActive: true,
                isFinal: false,
                order: 1,
                estimatedDays: 1,
                trackingNote: 'Đơn hàng sẽ được xử lý trong 1 ngày làm việc'
            },
            {
                name: 'Đang vận chuyển',
                description: 'Hàng hóa đang được vận chuyển đến địa chỉ giao hàng',
                color: '#3498db',
                icon: '🚛',
                isActive: true,
                isFinal: false,
                order: 2,
                estimatedDays: 3,
                trackingNote: 'Dự kiến giao hàng trong 2-3 ngày'
            },
            {
                name: 'Đã giao hàng',
                description: 'Đơn hàng đã được giao thành công',
                color: '#27ae60',
                icon: '✅',
                isActive: true,
                isFinal: true,
                order: 3,
                estimatedDays: 0,
                trackingNote: 'Đơn hàng đã hoàn thành'
            }
        ];
        const createdRecords = [];
        for (const data of sampleData) {
            const created = new this.deliveryStatusModel(data);
            createdRecords.push(await created.save());
        }
        return createdRecords;
    }
};
exports.DeliveryStatusService = DeliveryStatusService;
exports.DeliveryStatusService = DeliveryStatusService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(delivery_status_schema_1.DeliveryStatus.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], DeliveryStatusService);
//# sourceMappingURL=delivery-status.service.js.map