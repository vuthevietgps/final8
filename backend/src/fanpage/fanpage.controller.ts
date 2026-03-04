import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { FanpageService } from './fanpage.service';
import { CreateFanpageDto } from './dto/create-fanpage.dto';
import { UpdateFanpageDto } from './dto/update-fanpage.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { FeatureModule } from '../plan/feature-module.decorator';

@FeatureModule('fanpage')
@Controller('fanpages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FanpageController {
  constructor(private service: FanpageService) {}

  @Post()
  @RequirePermissions('fanpages')
  create(@Body() dto: CreateFanpageDto) { return this.service.create(dto); }

  @Get()
  @RequirePermissions('fanpages')
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @RequirePermissions('fanpages')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @RequirePermissions('fanpages')
  update(@Param('id') id: string, @Body() dto: UpdateFanpageDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @RequirePermissions('fanpages')
  remove(@Param('id') id: string) { return this.service.remove(id); }

  @Post(':id/create-ai-config')
  @RequirePermissions('fanpages')
  createAIConfig(@Param('id') id: string) { return this.service.createAIConfigForExisting(id); }

  @Post(':id/validate-token')
  validateToken(@Param('id') id: string) { return this.service.validateAccessToken(id); }

  @Post(':id/refresh-token')
  refreshToken(@Param('id') id: string, @Body() dto: { accessToken: string }) { 
    return this.service.refreshAccessToken(id, dto.accessToken); 
  }

  // Debug endpoints without auth
  @Post('debug/:id/validate-token')
  debugValidateToken(@Param('id') id: string) { 
    return this.service.validateAccessToken(id); 
  }

  @Post('debug/:id/refresh-token')
  debugRefreshToken(@Param('id') id: string, @Body() dto: { accessToken: string }) { 
    return this.service.refreshAccessToken(id, dto.accessToken); 
  }
}
