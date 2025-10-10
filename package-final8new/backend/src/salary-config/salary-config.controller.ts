import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SalaryConfigService } from './salary-config.service';
import { CreateSalaryConfigDto } from './dto/create-salary-config.dto';
import { UpdateSalaryConfigDto } from './dto/update-salary-config.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';

@Controller('salary-config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalaryConfigController {
  constructor(private readonly service: SalaryConfigService) {}

  @Get()
  @RequirePermissions('salary-config')
  findAll() {
    return this.service.findAll();
  }

  // Upsert theo userId
  @Post()
  @RequirePermissions('salary-config')
  create(@Body() dto: CreateSalaryConfigDto) {
    return this.service.createOrUpdate(dto);
  }

  @Patch(':id')
  @RequirePermissions('salary-config')
  update(@Param('id') id: string, @Body() dto: UpdateSalaryConfigDto) {
    return this.service.update(id, dto);
  }

  // Patch một trường (inline edit)
  @Patch(':id/field')
  @RequirePermissions('salary-config')
  updateField(@Param('id') id: string, @Body() patch: Partial<UpdateSalaryConfigDto>) {
    return this.service.updateField(id, patch);
  }

  @Delete(':id')
  @RequirePermissions('salary-config')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
