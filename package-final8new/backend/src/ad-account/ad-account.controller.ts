/**
 * File: ad-account/ad-account.controller.ts
 * Mục đích: API endpoints cho quản lý Tài Khoản Quảng Cáo.
 */
import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { AdAccountService } from './ad-account.service';
import { CreateAdAccountDto } from './dto/create-ad-account.dto';
import { UpdateAdAccountDto } from './dto/update-ad-account.dto';

@Controller('ad-accounts')
export class AdAccountController {
  constructor(private readonly adAccountService: AdAccountService) {}

  @Post()
  create(@Body() createAdAccountDto: CreateAdAccountDto) {
    return this.adAccountService.create(createAdAccountDto);
  }

  @Get()
  findAll(@Query() query: any) {
    return this.adAccountService.findAll(query);
  }

  @Get('search')
  search(@Query() query: any) {
    return this.adAccountService.search(query);
  }

  @Get('validate/account-id/:accountId')
  validateAccountId(@Param('accountId') accountId: string) {
    return this.adAccountService.validateAccountId(accountId);
  }

  @Get('stats/counts-by-type')
  getStatsByType() {
    return this.adAccountService.getStatsByType();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adAccountService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAdAccountDto: UpdateAdAccountDto) {
    return this.adAccountService.update(id, updateAdAccountDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.adAccountService.remove(id);
  }
}
