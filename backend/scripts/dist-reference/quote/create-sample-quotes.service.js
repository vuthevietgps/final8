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
exports.CreateSampleQuotes = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const quote_schema_1 = require("./schemas/quote.schema");
let CreateSampleQuotes = class CreateSampleQuotes {
    constructor(quoteModel) {
        this.quoteModel = quoteModel;
    }
    async onModuleInit() {
        const count = await this.quoteModel.countDocuments().exec();
        console.log(`Current quotes count: ${count}`);
        if (count === 0) {
            console.log('Creating sample quotes...');
            await this.createSampleQuotes();
        }
    }
    async createSampleQuotes() {
        const sampleQuotes = [
            {
                productId: new mongoose_2.Types.ObjectId('68b7835cf402c3931acd7b35'),
                agentId: new mongoose_2.Types.ObjectId('68bfa75d2cbc0f781d9de469'),
                price: 230000,
                status: 'Đã duyệt',
                isActive: true,
                notes: 'Sample quote 1'
            },
            {
                productId: new mongoose_2.Types.ObjectId('68b7835cf402c3931acd7b35'),
                agentId: new mongoose_2.Types.ObjectId('68bfae652cbc0f781d9de478'),
                price: 250000,
                status: 'Đã duyệt',
                isActive: true,
                notes: 'Sample quote 2'
            },
            {
                productId: new mongoose_2.Types.ObjectId('68b725607ec5d28a0d499d1e'),
                agentId: new mongoose_2.Types.ObjectId('68bfae652cbc0f781d9de478'),
                price: 180000,
                status: 'Đã duyệt',
                isActive: true,
                notes: 'Sample quote 3'
            },
            {
                productId: new mongoose_2.Types.ObjectId('68b7255f7ec5d28a0d499d12'),
                agentId: new mongoose_2.Types.ObjectId('68bfae652cbc0f781d9de478'),
                price: 320000,
                status: 'Đã duyệt',
                isActive: true,
                notes: 'Sample quote 4'
            },
            {
                productId: new mongoose_2.Types.ObjectId('68b7833df402c3931acd7b2e'),
                agentId: new mongoose_2.Types.ObjectId('68b9af7afb7a0875783bcf19'),
                price: 280000,
                status: 'Đã duyệt',
                isActive: true,
                notes: 'Sample quote 5'
            }
        ];
        try {
            await this.quoteModel.insertMany(sampleQuotes);
            console.log(`Created ${sampleQuotes.length} sample quotes`);
        }
        catch (error) {
            console.error('Error creating sample quotes:', error);
        }
    }
};
exports.CreateSampleQuotes = CreateSampleQuotes;
exports.CreateSampleQuotes = CreateSampleQuotes = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(quote_schema_1.Quote.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], CreateSampleQuotes);
//# sourceMappingURL=create-sample-quotes.service.js.map