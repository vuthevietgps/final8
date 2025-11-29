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
var CustomerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const customer_schema_1 = require("./schemas/customer.schema");
const test_order2_schema_1 = require("../test-order2/schemas/test-order2.schema");
const product_schema_1 = require("../product/schemas/product.schema");
let CustomerService = CustomerService_1 = class CustomerService {
    constructor(customerModel, testOrder2Model, productModel) {
        this.customerModel = customerModel;
        this.testOrder2Model = testOrder2Model;
        this.productModel = productModel;
        this.logger = new common_1.Logger(CustomerService_1.name);
    }
    async syncCustomersFromOrders() {
        this.logger.log('🔄 Starting customer sync from TestOrder2...');
        const orders = await this.testOrder2Model
            .find({
            customerName: { $exists: true, $ne: '' },
            receiverPhone: { $exists: true, $ne: '' },
            receiverAddress: { $exists: true, $ne: '' },
            isActive: true
        })
            .populate('productId')
            .sort({ createdAt: -1 })
            .exec();
        this.logger.log(`📦 Found ${orders.length} orders with customer info`);
        const customerGroups = new Map();
        orders.forEach(order => {
            const key = `${order.customerName}-${order.receiverPhone}`;
            if (!customerGroups.has(key)) {
                customerGroups.set(key, []);
            }
            customerGroups.get(key).push(order);
        });
        this.logger.log(`👥 Found ${customerGroups.size} unique customers`);
        let syncedCount = 0;
        let updatedCount = 0;
        for (const [customerKey, customerOrders] of customerGroups) {
            try {
                const latestOrder = customerOrders[0];
                const product = latestOrder.productId;
                if (!product || !product.usageDurationMonths) {
                    this.logger.warn(`⚠️ Product missing usageDurationMonths for order ${latestOrder._id}`);
                    continue;
                }
                const purchaseDate = new Date(latestOrder.createdAt);
                const usageDurationMs = product.usageDurationMonths * 30 * 24 * 60 * 60 * 1000;
                const expiryDate = new Date(purchaseDate.getTime() + usageDurationMs);
                const remainingMs = expiryDate.getTime() - Date.now();
                const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
                const existingCustomer = await this.customerModel.findOne({
                    customerName: latestOrder.customerName,
                    phoneNumber: latestOrder.receiverPhone
                });
                if (existingCustomer) {
                    if (new Date(latestOrder.createdAt) > existingCustomer.latestPurchaseDate) {
                        await this.customerModel.updateOne({ _id: existingCustomer._id }, {
                            address: latestOrder.receiverAddress,
                            productId: latestOrder.productId,
                            latestPurchaseDate: latestOrder.createdAt,
                            usageDurationMonths: product.usageDurationMonths,
                            remainingDays,
                            latestOrderId: latestOrder._id,
                            lastCalculated: new Date()
                        });
                        updatedCount++;
                        this.logger.log(`📝 Updated customer: ${latestOrder.customerName}`);
                    }
                    else {
                        await this.customerModel.updateOne({ _id: existingCustomer._id }, {
                            remainingDays,
                            lastCalculated: new Date()
                        });
                    }
                }
                else {
                    await this.customerModel.create({
                        customerName: latestOrder.customerName,
                        phoneNumber: latestOrder.receiverPhone,
                        address: latestOrder.receiverAddress,
                        productId: latestOrder.productId,
                        latestPurchaseDate: latestOrder.createdAt,
                        usageDurationMonths: product.usageDurationMonths,
                        remainingDays,
                        latestOrderId: latestOrder._id,
                        isDisabled: false,
                        lastCalculated: new Date()
                    });
                    syncedCount++;
                    this.logger.log(`✅ Created customer: ${latestOrder.customerName}`);
                }
            }
            catch (error) {
                this.logger.error(`❌ Error processing customer ${customerKey}:`, error.message);
            }
        }
        this.logger.log(`🎉 Customer sync completed: ${syncedCount} created, ${updatedCount} updated`);
    }
    async findAll(query = {}) {
        const { search, expiringSoon, isDisabled, limit = 100, skip = 0 } = query;
        const mongoQuery = {};
        if (search) {
            mongoQuery.$or = [
                { customerName: { $regex: search, $options: 'i' } },
                { phoneNumber: { $regex: search, $options: 'i' } }
            ];
        }
        if (expiringSoon === 'true') {
            mongoQuery.remainingDays = { $lt: 15, $gt: 0 };
            mongoQuery.isDisabled = false;
        }
        if (isDisabled !== undefined) {
            mongoQuery.isDisabled = isDisabled === 'true';
        }
        return this.customerModel
            .find(mongoQuery)
            .populate('productId', 'name sku color usageDurationMonths')
            .sort({ remainingDays: 1, latestPurchaseDate: -1 })
            .limit(Number(limit))
            .skip(Number(skip))
            .exec();
    }
    async getStats() {
        const [totalCustomers, activeCustomers, expiringSoon, expired, disabledCustomers] = await Promise.all([
            this.customerModel.countDocuments(),
            this.customerModel.countDocuments({ isDisabled: false }),
            this.customerModel.countDocuments({
                remainingDays: { $lt: 15, $gt: 0 },
                isDisabled: false
            }),
            this.customerModel.countDocuments({
                remainingDays: { $lte: 0 },
                isDisabled: false
            }),
            this.customerModel.countDocuments({ isDisabled: true })
        ]);
        return {
            totalCustomers,
            activeCustomers,
            expiringSoon,
            expired,
            disabledCustomers
        };
    }
    async disable(id) {
        const customer = await this.customerModel.findById(id);
        if (!customer) {
            throw new common_1.NotFoundException(`Customer with ID ${id} not found`);
        }
        customer.isDisabled = true;
        await customer.save();
        this.logger.log(`🚫 Disabled customer: ${customer.customerName}`);
        return customer;
    }
    async enable(id) {
        const customer = await this.customerModel.findById(id);
        if (!customer) {
            throw new common_1.NotFoundException(`Customer with ID ${id} not found`);
        }
        customer.isDisabled = false;
        await customer.save();
        this.logger.log(`✅ Enabled customer: ${customer.customerName}`);
        return customer;
    }
    async updateRemainingDays() {
        this.logger.log('🔄 Updating remaining days for all customers...');
        const customers = await this.customerModel.find({ isDisabled: false }).populate('productId');
        let updatedCount = 0;
        for (const customer of customers) {
            try {
                const product = customer.productId;
                if (!(product === null || product === void 0 ? void 0 : product.usageDurationMonths))
                    continue;
                const purchaseDate = new Date(customer.latestPurchaseDate);
                const usageDurationMs = product.usageDurationMonths * 30 * 24 * 60 * 60 * 1000;
                const expiryDate = new Date(purchaseDate.getTime() + usageDurationMs);
                const remainingMs = expiryDate.getTime() - Date.now();
                const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
                if (customer.remainingDays !== remainingDays) {
                    await this.customerModel.updateOne({ _id: customer._id }, {
                        remainingDays,
                        lastCalculated: new Date()
                    });
                    updatedCount++;
                }
            }
            catch (error) {
                this.logger.error(`Error updating customer ${customer._id}:`, error.message);
            }
        }
        this.logger.log(`📊 Updated remaining days for ${updatedCount} customers`);
    }
    async findOne(id) {
        const customer = await this.customerModel
            .findById(id)
            .populate('productId')
            .populate('latestOrderId')
            .exec();
        if (!customer) {
            throw new common_1.NotFoundException(`Customer with ID ${id} not found`);
        }
        return customer;
    }
    async update(id, updateCustomerDto) {
        const customer = await this.customerModel
            .findByIdAndUpdate(id, updateCustomerDto, { new: true })
            .populate('productId')
            .exec();
        if (!customer) {
            throw new common_1.NotFoundException(`Customer with ID ${id} not found`);
        }
        this.logger.log(`📝 Updated customer: ${customer.customerName}`);
        return customer;
    }
    async remove(id) {
        const result = await this.customerModel.deleteOne({ _id: id });
        if (result.deletedCount === 0) {
            throw new common_1.NotFoundException(`Customer with ID ${id} not found`);
        }
        this.logger.log(`🗑️ Deleted customer with ID: ${id}`);
    }
};
exports.CustomerService = CustomerService;
exports.CustomerService = CustomerService = CustomerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(customer_schema_1.Customer.name)),
    __param(1, (0, mongoose_1.InjectModel)(test_order2_schema_1.TestOrder2.name)),
    __param(2, (0, mongoose_1.InjectModel)(product_schema_1.Product.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], CustomerService);
//# sourceMappingURL=customer.service.js.map