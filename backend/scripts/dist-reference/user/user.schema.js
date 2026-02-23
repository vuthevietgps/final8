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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSchema = exports.User = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const user_enum_1 = require("./user.enum");
const bcrypt = require("bcryptjs");
let User = class User {
};
exports.User = User;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], User.prototype, "fullName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], User.prototype, "password", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "phone", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: user_enum_1.UserRole }),
    __metadata("design:type", String)
], User.prototype, "role", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "address", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], User.prototype, "isActive", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "departmentId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "managerId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "notes", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "googleDriveLink", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], User.prototype, "allowedLoginIps", void 0);
exports.User = User = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], User);
exports.UserSchema = mongoose_1.SchemaFactory.createForClass(User);
function isBcryptHash(value) {
    return typeof value === 'string' && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}
exports.UserSchema.pre('save', async function (next) {
    const doc = this;
    if (!doc.isModified('password'))
        return next();
    try {
        if (isBcryptHash(doc.password))
            return next();
        doc.password = await bcrypt.hash(doc.password, 12);
        next();
    }
    catch (err) {
        next(err);
    }
});
async function hashPasswordInUpdate() {
    var _a;
    const update = this.getUpdate();
    if (!update)
        return;
    const pwd = (_a = update.password) !== null && _a !== void 0 ? _a : (update.$set && update.$set.password);
    if (!pwd)
        return;
    if (isBcryptHash(pwd))
        return;
    const hashed = await bcrypt.hash(pwd, 12);
    if (update.password)
        update.password = hashed;
    if (update.$set && update.$set.password)
        update.$set.password = hashed;
    this.setUpdate(update);
}
exports.UserSchema.pre('findOneAndUpdate', async function (next) {
    try {
        await hashPasswordInUpdate.call(this);
        next();
    }
    catch (err) {
        next(err);
    }
});
exports.UserSchema.pre('updateOne', async function (next) {
    try {
        await hashPasswordInUpdate.call(this);
        next();
    }
    catch (err) {
        next(err);
    }
});
//# sourceMappingURL=user.schema.js.map