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
exports.QuoteController = void 0;
const common_1 = require("@nestjs/common");
const quote_service_1 = require("./quote.service");
const create_quote_dto_1 = require("./dto/create-quote.dto");
const update_quote_dto_1 = require("./dto/update-quote.dto");
let QuoteController = class QuoteController {
    constructor(quoteService) {
        this.quoteService = quoteService;
    }
    create(createQuoteDto) {
        if (createQuoteDto.validFrom) {
            createQuoteDto.validFrom = new Date(createQuoteDto.validFrom).toISOString();
        }
        if (createQuoteDto.validUntil) {
            createQuoteDto.validUntil = new Date(createQuoteDto.validUntil).toISOString();
        }
        ['product', 'agentName'].forEach((k) => {
            const v = createQuoteDto[k];
            if (v !== undefined && String(v).trim() === '') {
                delete createQuoteDto[k];
            }
        });
        return this.quoteService.create(createQuoteDto);
    }
    findAll(query) {
        return this.quoteService.findAll(query);
    }
    getStats() {
        return this.quoteService.getStats();
    }
    diagnostics() {
        return this.quoteService.diagnostics();
    }
    async migrateNames() {
        return this.quoteService.migrateProductAndAgentNames();
    }
    findByAgent(agentId) {
        return this.quoteService.findByAgent(agentId);
    }
    findByProduct(productId) {
        return this.quoteService.findByProduct(productId);
    }
    findOne(id) {
        return this.quoteService.findOne(id);
    }
    update(id, updateQuoteDto) {
        if (updateQuoteDto.validFrom) {
            updateQuoteDto.validFrom = new Date(updateQuoteDto.validFrom).toISOString();
        }
        if (updateQuoteDto.validUntil) {
            updateQuoteDto.validUntil = new Date(updateQuoteDto.validUntil).toISOString();
        }
        ['product', 'agentName'].forEach((k) => {
            if (updateQuoteDto[k] !== undefined) {
                const v = String(updateQuoteDto[k]).trim();
                if (!v)
                    delete updateQuoteDto[k];
            }
        });
        return this.quoteService.update(id, updateQuoteDto);
    }
    remove(id) {
        return this.quoteService.remove(id);
    }
};
exports.QuoteController = QuoteController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)(new common_1.ValidationPipe({ transform: true, whitelist: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_quote_dto_1.CreateQuoteDto]),
    __metadata("design:returntype", void 0)
], QuoteController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], QuoteController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('stats/summary'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], QuoteController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('diagnostics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], QuoteController.prototype, "diagnostics", null);
__decorate([
    (0, common_1.Get)('migrate-names'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], QuoteController.prototype, "migrateNames", null);
__decorate([
    (0, common_1.Get)('agent/:agentId'),
    __param(0, (0, common_1.Param)('agentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], QuoteController.prototype, "findByAgent", null);
__decorate([
    (0, common_1.Get)('product/:productId'),
    __param(0, (0, common_1.Param)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], QuoteController.prototype, "findByProduct", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], QuoteController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)(new common_1.ValidationPipe({ transform: true, whitelist: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_quote_dto_1.UpdateQuoteDto]),
    __metadata("design:returntype", void 0)
], QuoteController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], QuoteController.prototype, "remove", null);
exports.QuoteController = QuoteController = __decorate([
    (0, common_1.Controller)('quotes'),
    __metadata("design:paramtypes", [quote_service_1.QuoteService])
], QuoteController);
//# sourceMappingURL=quote.controller.js.map