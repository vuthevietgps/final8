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
exports.OrderStatusService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const order_status_schema_1 = require("./schemas/order-status.schema");
let OrderStatusService = class OrderStatusService {
    constructor(orderStatusModel) {
        this.orderStatusModel = orderStatusModel;
    }
    async create(createOrderStatusDto) {
        try {
            const existingStatus = await this.orderStatusModel.findOne({
                name: createOrderStatusDto.name
            });
            if (existingStatus) {
                throw new common_1.ConflictException('Tên trạng thái đơn hàng đã tồn tại');
            }
            const createdStatus = new this.orderStatusModel(createOrderStatusDto);
            return createdStatus.save();
        }
        catch (error) {
            if (error instanceof common_1.ConflictException) {
                throw error;
            }
            throw new Error(`Lỗi khi tạo trạng thái đơn hàng: ${error.message}`);
        }
    }
    async findAll(isActive, isFinal) {
        try {
            const filter = {};
            if (isActive !== undefined)
                filter.isActive = isActive;
            if (isFinal !== undefined)
                filter.isFinal = isFinal;
            return this.orderStatusModel
                .find(filter)
                .sort({ order: 1, createdAt: -1 })
                .exec();
        }
        catch (error) {
            throw new Error(`Lỗi khi lấy danh sách trạng thái đơn hàng: ${error.message}`);
        }
    }
    async findOne(id) {
        try {
            const status = await this.orderStatusModel.findById(id).exec();
            if (!status) {
                throw new common_1.NotFoundException('Không tìm thấy trạng thái đơn hàng');
            }
            return status;
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException) {
                throw error;
            }
            throw new Error(`Lỗi khi tìm trạng thái đơn hàng: ${error.message}`);
        }
    }
    async update(id, updateOrderStatusDto) {
        try {
            if (updateOrderStatusDto.name) {
                const existingStatus = await this.orderStatusModel.findOne({
                    name: updateOrderStatusDto.name,
                    _id: { $ne: id }
                });
                if (existingStatus) {
                    throw new common_1.ConflictException('Tên trạng thái đơn hàng đã tồn tại');
                }
            }
            const updatedStatus = await this.orderStatusModel
                .findByIdAndUpdate(id, updateOrderStatusDto, { new: true })
                .exec();
            if (!updatedStatus) {
                throw new common_1.NotFoundException('Không tìm thấy trạng thái đơn hàng để cập nhật');
            }
            return updatedStatus;
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException || error instanceof common_1.ConflictException) {
                throw error;
            }
            throw new Error(`Lỗi khi cập nhật trạng thái đơn hàng: ${error.message}`);
        }
    }
    async remove(id) {
        try {
            const deletedStatus = await this.orderStatusModel.findByIdAndDelete(id).exec();
            if (!deletedStatus) {
                throw new common_1.NotFoundException('Không tìm thấy trạng thái đơn hàng để xóa');
            }
            return { message: 'Xóa trạng thái đơn hàng thành công' };
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException) {
                throw error;
            }
            throw new Error(`Lỗi khi xóa trạng thái đơn hàng: ${error.message}`);
        }
    }
    async updateOrder(orderUpdates) {
        try {
            const updatePromises = orderUpdates.map(({ id, order }) => this.orderStatusModel.findByIdAndUpdate(id, { order }, { new: true }).exec());
            await Promise.all(updatePromises);
            return this.findAll();
        }
        catch (error) {
            throw new Error(`Lỗi khi cập nhật thứ tự trạng thái đơn hàng: ${error.message}`);
        }
    }
    async getStats() {
        try {
            const [total, active, finalStatuses] = await Promise.all([
                this.orderStatusModel.countDocuments().exec(),
                this.orderStatusModel.countDocuments({ isActive: true }).exec(),
                this.orderStatusModel.countDocuments({ isFinal: true }).exec(),
            ]);
            return {
                total,
                active,
                inactive: total - active,
                finalStatuses,
                processingStatuses: total - finalStatuses,
            };
        }
        catch (error) {
            throw new Error(`Lỗi khi lấy thống kê trạng thái đơn hàng: ${error.message}`);
        }
    }
    async getWorkflowStatuses() {
        try {
            const [processing, final] = await Promise.all([
                this.orderStatusModel.find({ isFinal: false, isActive: true }).sort({ order: 1 }).exec(),
                this.orderStatusModel.find({ isFinal: true, isActive: true }).sort({ order: 1 }).exec(),
            ]);
            return { processing, final };
        }
        catch (error) {
            throw new Error(`Lỗi khi lấy workflow trạng thái đơn hàng: ${error.message}`);
        }
    }
};
exports.OrderStatusService = OrderStatusService;
exports.OrderStatusService = OrderStatusService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(order_status_schema_1.OrderStatus.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], OrderStatusService);
//# sourceMappingURL=order-status.service.js.map