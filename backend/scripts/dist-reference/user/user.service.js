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
exports.UserService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const user_schema_1 = require("./user.schema");
const user_enum_1 = require("./user.enum");
let UserService = class UserService {
    constructor(userModel) {
        this.userModel = userModel;
    }
    async create(createUserDto) {
        const createdUser = new this.userModel(createUserDto);
        return createdUser.save();
    }
    async findAll() {
        return this.userModel.find().exec();
    }
    async findOne(id) {
        return this.userModel.findById(id).exec();
    }
    async update(id, updateUserDto) {
        return this.userModel.findByIdAndUpdate(id, updateUserDto, { new: true }).exec();
    }
    async remove(id) {
        return this.userModel.findByIdAndDelete(id).exec();
    }
    async findByRole(role) {
        return this.userModel.find({ role }).exec();
    }
    async findByEmail(email) {
        return this.userModel.findOne({ email }).exec();
    }
    async findActiveUsers() {
        return this.userModel.find({ isActive: true }).exec();
    }
    async findActiveAgentsMinimal(roles = [user_enum_1.UserRole.INTERNAL_AGENT, user_enum_1.UserRole.EXTERNAL_AGENT]) {
        const users = await this.userModel
            .find({ role: { $in: roles }, isActive: true })
            .select('_id fullName email role')
            .sort({ fullName: 1 })
            .lean();
        return users.map((u) => ({ _id: String(u._id), fullName: u.fullName, email: u.email, role: u.role }));
    }
    async findSuppliers(params = {}) {
        const { q, active, minimal } = params;
        const filter = { role: { $in: [user_enum_1.UserRole.INTERNAL_SUPPLIER, user_enum_1.UserRole.EXTERNAL_SUPPLIER] } };
        if (active === true)
            filter.isActive = true;
        if (q && q.trim()) {
            const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [
                { fullName: rx },
                { email: rx },
                { phone: rx },
                { address: rx }
            ];
        }
        const query = this.userModel.find(filter).sort({ fullName: 1 });
        if (minimal) {
            query.select('_id fullName email phone role isActive');
        }
        const docs = await query.lean();
        return docs.map((u) => (Object.assign(Object.assign({}, u), { _id: String(u._id) })));
    }
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], UserService);
//# sourceMappingURL=user.service.js.map