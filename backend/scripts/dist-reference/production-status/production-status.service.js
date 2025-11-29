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
exports.ProductionStatusService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const production_status_schema_1 = require("./schemas/production-status.schema");
let ProductionStatusService = class ProductionStatusService {
    constructor(productionStatusModel) {
        this.productionStatusModel = productionStatusModel;
    }
    async create(createProductionStatusDto) {
        try {
            const existingStatus = await this.productionStatusModel.findOne({
                name: createProductionStatusDto.name
            });
            if (existingStatus) {
                throw new common_1.ConflictException('Tên trạng thái sản xuất đã tồn tại');
            }
            const createdStatus = new this.productionStatusModel(createProductionStatusDto);
            return createdStatus.save();
        }
        catch (error) {
            if (error instanceof common_1.ConflictException) {
                throw error;
            }
            throw new Error(`Lỗi khi tạo trạng thái sản xuất: ${error.message}`);
        }
    }
    async findAll(isActive) {
        try {
            const filter = isActive !== undefined ? { isActive } : {};
            return this.productionStatusModel
                .find(filter)
                .sort({ order: 1, createdAt: -1 })
                .exec();
        }
        catch (error) {
            throw new Error(`Lỗi khi lấy danh sách trạng thái sản xuất: ${error.message}`);
        }
    }
    async findOne(id) {
        try {
            const status = await this.productionStatusModel.findById(id).exec();
            if (!status) {
                throw new common_1.NotFoundException('Không tìm thấy trạng thái sản xuất');
            }
            return status;
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException) {
                throw error;
            }
            throw new Error(`Lỗi khi tìm trạng thái sản xuất: ${error.message}`);
        }
    }
    async update(id, updateProductionStatusDto) {
        try {
            if (updateProductionStatusDto.name) {
                const existingStatus = await this.productionStatusModel.findOne({
                    name: updateProductionStatusDto.name,
                    _id: { $ne: id }
                });
                if (existingStatus) {
                    throw new common_1.ConflictException('Tên trạng thái sản xuất đã tồn tại');
                }
            }
            const updatedStatus = await this.productionStatusModel
                .findByIdAndUpdate(id, updateProductionStatusDto, { new: true })
                .exec();
            if (!updatedStatus) {
                throw new common_1.NotFoundException('Không tìm thấy trạng thái sản xuất để cập nhật');
            }
            return updatedStatus;
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException || error instanceof common_1.ConflictException) {
                throw error;
            }
            throw new Error(`Lỗi khi cập nhật trạng thái sản xuất: ${error.message}`);
        }
    }
    async remove(id) {
        try {
            const deletedStatus = await this.productionStatusModel.findByIdAndDelete(id).exec();
            if (!deletedStatus) {
                throw new common_1.NotFoundException('Không tìm thấy trạng thái sản xuất để xóa');
            }
            return { message: 'Xóa trạng thái sản xuất thành công' };
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException) {
                throw error;
            }
            throw new Error(`Lỗi khi xóa trạng thái sản xuất: ${error.message}`);
        }
    }
    async updateOrder(orderUpdates) {
        try {
            const updatePromises = orderUpdates.map(({ id, order }) => this.productionStatusModel.findByIdAndUpdate(id, { order }, { new: true }).exec());
            await Promise.all(updatePromises);
            return this.findAll();
        }
        catch (error) {
            throw new Error(`Lỗi khi cập nhật thứ tự trạng thái sản xuất: ${error.message}`);
        }
    }
    async getStats() {
        try {
            const [total, active] = await Promise.all([
                this.productionStatusModel.countDocuments().exec(),
                this.productionStatusModel.countDocuments({ isActive: true }).exec(),
            ]);
            return {
                total,
                active,
                inactive: total - active,
            };
        }
        catch (error) {
            throw new Error(`Lỗi khi lấy thống kê trạng thái sản xuất: ${error.message}`);
        }
    }
};
exports.ProductionStatusService = ProductionStatusService;
exports.ProductionStatusService = ProductionStatusService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(production_status_schema_1.ProductionStatus.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], ProductionStatusService);
//# sourceMappingURL=production-status.service.js.map