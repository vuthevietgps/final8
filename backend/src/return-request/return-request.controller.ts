import { Body, Controller, Get, Param, Patch, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { CreateReturnRequestDto } from './dto/create-return-request.dto';
import { ResolveReturnRequestDto } from './dto/resolve-return-request.dto';
import { ReturnRequestService } from './return-request.service';
import { FeatureModule } from '../plan/feature-module.decorator';

@FeatureModule('return-request')
@Controller('returns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReturnRequestController {
  constructor(private readonly service: ReturnRequestService) {}

  @Post()
  @RequirePermissions('purchase-costs')
  create(@Body(new ValidationPipe({ whitelist: true, transform: true })) dto: CreateReturnRequestDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  @RequirePermissions('purchase-costs')
  find(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/resolve')
  @RequirePermissions('purchase-costs')
  resolve(@Param('id') id: string, @Body(new ValidationPipe({ whitelist: true, transform: true })) dto: ResolveReturnRequestDto) {
    return this.service.resolve(id, dto);
  }
}
