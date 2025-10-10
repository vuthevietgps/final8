/**
 * File: facebook-token/facebook-token.controller.ts
 * Mục đích: API endpoints quản lý Facebook Access Tokens
 */
import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { FacebookTokenService } from './facebook-token.service';
import { CreateFacebookTokenDto } from './dto/create-facebook-token.dto';
import { UpdateFacebookTokenDto } from './dto/update-facebook-token.dto';

@Controller('facebook-tokens')
export class FacebookTokenController {
  constructor(private readonly facebookTokenService: FacebookTokenService) {}

  @Post()
  create(@Body() createDto: CreateFacebookTokenDto) {
    return this.facebookTokenService.create(createDto);
  }

  @Get()
  findAll() {
    return this.facebookTokenService.findAll();
  }

  @Get('default')
  async getDefault() {
    const token = await this.facebookTokenService.getDefaultToken();
    return {
      hasDefault: !!token,
      message: token ? 'Default token found' : 'No default token configured'
    };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.facebookTokenService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateFacebookTokenDto) {
    return this.facebookTokenService.update(id, updateDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.facebookTokenService.remove(id);
    return { message: 'Facebook token deleted successfully' };
  }

  @Post(':id/set-default')
  setDefault(@Param('id') id: string) {
    return this.facebookTokenService.setDefault(id);
  }

  @Post(':id/test')
  testToken(@Param('id') id: string) {
    return this.facebookTokenService.testToken(id);
  }
}