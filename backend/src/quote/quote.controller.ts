/**
 * File: quote.controller.ts
 * Mục đích: Định nghĩa REST API cho "Báo giá đại lý" (CRUD, thống kê),
 *   nhận/validate payload, và gọi service xử lý nghiệp vụ.
 */
import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ValidationPipe } from '@nestjs/common';
import { QuoteService } from './quote.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';

@Controller('quotes')
export class QuoteController {
  constructor(private readonly quoteService: QuoteService) {}

  @Post()
  create(
    @Body(new ValidationPipe({ transform: true, whitelist: true })) createQuoteDto: CreateQuoteDto,
  ) {
    // Chuẩn hóa validFrom/validUntil từ ISO format
    if (createQuoteDto.validFrom) {
      createQuoteDto.validFrom = new Date(createQuoteDto.validFrom).toISOString();
    }
    if (createQuoteDto.validUntil) {
      createQuoteDto.validUntil = new Date(createQuoteDto.validUntil).toISOString();
    }
    
    // Nếu product hoặc agentName là chuỗi rỗng, bỏ đi để service tự động điền
    ['product', 'agentName'].forEach((k) => {
      const v = (createQuoteDto as any)[k];
      if (v !== undefined && String(v).trim() === '') {
        delete (createQuoteDto as any)[k];
      }
    });
    return this.quoteService.create(createQuoteDto);
  }

  @Get()
  findAll(@Query() query: any) {
    return this.quoteService.findAll(query);
  }

  @Get('stats/summary')
  getStats() {
    return this.quoteService.getStats();
  }

  // Diagnostics: trả thông tin collection và thống kê quote để kiểm tra nhanh
  @Get('diagnostics')
  diagnostics() {
    return this.quoteService.diagnostics();
  }

  @Get('migrate-names')
  async migrateNames() {
    return this.quoteService.migrateProductAndAgentNames();
  }

  @Get('agent/:agentId')
  findByAgent(@Param('agentId') agentId: string) {
    return this.quoteService.findByAgent(agentId);
  }

  @Get('product/:productId')
  findByProduct(@Param('productId') productId: string) {
    return this.quoteService.findByProduct(productId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.quoteService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) updateQuoteDto: UpdateQuoteDto,
  ) {
    // Chuẩn hóa validFrom/validUntil từ ISO format
    if (updateQuoteDto.validFrom) {
      (updateQuoteDto as any).validFrom = new Date(updateQuoteDto.validFrom).toISOString();
    }
    if (updateQuoteDto.validUntil) {
      (updateQuoteDto as any).validUntil = new Date(updateQuoteDto.validUntil).toISOString();
    }
    
    // Bỏ product/agentName nếu là chuỗi rỗng
    ['product', 'agentName'].forEach((k) => {
      if ((updateQuoteDto as any)[k] !== undefined) {
        const v = String((updateQuoteDto as any)[k]).trim();
        if (!v) delete (updateQuoteDto as any)[k];
      }
    });
    return this.quoteService.update(id, updateQuoteDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.quoteService.remove(id);
  }
}
