/**
 * Controller: ApiTokenController
 * Nhiệm vụ: Expose REST endpoints CRUD + các thao tác vòng đời token (validate / set-primary / rotate)
 * Bảo vệ bằng JwtAuthGuard + RolesGuard và kiểm soát quyền qua @RequirePermissions('api-tokens').
 */
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTokenService } from './api-token.service';
import { CreateApiTokenDto } from './dto/create-api-token.dto';
import { UpdateApiTokenDto } from './dto/update-api-token.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { ValidateTokenDto, RotateTokenDto, SetPrimaryTokenDto } from './dto/token-actions.dto';

@Controller('api-tokens')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApiTokenController {
  constructor(private service: ApiTokenService) {}

  @Post() @RequirePermissions('api-tokens') create(@Body() dto: CreateApiTokenDto) { return this.service.create(dto); }
  @Get() @RequirePermissions('api-tokens') findAll(@Query() q?: any) { return this.service.findAll(q||{}); }
  @Get(':id') @RequirePermissions('api-tokens') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Patch(':id') @RequirePermissions('api-tokens') update(@Param('id') id: string, @Body() dto: UpdateApiTokenDto) { return this.service.update(id, dto); }
  @Delete(':id') @RequirePermissions('api-tokens') remove(@Param('id') id: string) { return this.service.remove(id); }

  // Validate token
  @Post(':id/validate') @RequirePermissions('api-tokens') validate(@Param('id') id: string, @Body() dto: ValidateTokenDto) { return this.service.validate(id, dto); }
  // Set primary
  @Post(':id/set-primary') @RequirePermissions('api-tokens') setPrimary(@Param('id') id: string, @Body() dto: SetPrimaryTokenDto) { return this.service.setPrimary(id, dto); }
  // Rotate token
  @Post(':id/rotate') @RequirePermissions('api-tokens') rotate(@Param('id') id: string, @Body() dto: RotateTokenDto) { return this.service.rotate(id, dto); }

  // Đồng bộ token từ fanpages (import accessToken -> api-tokens)
  @Post('sync/from-fanpages') @RequirePermissions('api-tokens') syncFromFanpages(){
    return this.service.syncFromFanpages();
  }
}
