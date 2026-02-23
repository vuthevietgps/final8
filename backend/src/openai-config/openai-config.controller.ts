/**
 * File: openai-config/openai-config.controller.ts
 * Mục đích: Controller xử lý API endpoints cho quản lý cấu hình OpenAI
 * Chức năng: CRUD cấu hình OpenAI với authentication và phân quyền
 */
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CreateOpenAIConfigDto } from './dto/create-openai-config.dto';
import { UpdateOpenAIConfigDto } from './dto/update-openai-config.dto';
import { TestOpenAIKeyDto } from './dto/test-openai-key.dto';
import { OpenAIConfigService } from './openai-config.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';

@Controller('openai-configs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OpenAIConfigController {
  constructor(private service: OpenAIConfigService) {}

  @Post()
  @RequirePermissions('openai-configs')
  create(@Body() dto: CreateOpenAIConfigDto) { return this.service.create(dto); }

  @Get()
  @RequirePermissions('openai-configs')
  findAll(@Query() q?: any) { return this.service.findAll(q || {}); }

  @Get(':id')
  @RequirePermissions('openai-configs')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @RequirePermissions('openai-configs')
  update(@Param('id') id: string, @Body() dto: UpdateOpenAIConfigDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @RequirePermissions('openai-configs')
  remove(@Param('id') id: string) { return this.service.remove(id); }

  @Post('test-key')
  @RequirePermissions('openai-configs')
  testKey(@Body() dto: TestOpenAIKeyDto) { return this.service.testKey(dto); }
}
