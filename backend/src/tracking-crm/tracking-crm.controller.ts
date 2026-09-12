import { Body, Controller, Get, Param, Patch, Post, Req, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions, Roles } from '../auth/decorators/auth.decorator';
import { FeatureModule } from '../plan/feature-module.decorator';
import { TrackingCrmService } from './tracking-crm.service';
import { LinkTrackingOrderDto, SaveTrackingLeadDto, TrackingVersionDto } from './tracking-crm.dto';

@Controller('tracking-crm')
@FeatureModule('test-order2')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermissions('orders-test2')
@Roles('director', 'manager', 'employee')
export class TrackingCrmController {
  constructor(private service: TrackingCrmService) {}
  private id(id: string) { if (!Types.ObjectId.isValid(id)) throw new BadRequestException('ID không hợp lệ'); return id; }
  private actor(req: any) { return String(req.user.id || req.user._id); }
  @Get('options') options() { return this.service.options(); }
  @Get() list(@Query() query: Record<string, string>) { return this.service.list(query); }
  @Get('visits/:id/events') history(@Param('id') id: string) { return this.service.history(this.id(id)); }
  @Post('visits/:id/lead') saveVisit(@Param('id') id: string, @Body() dto: SaveTrackingLeadDto, @Req() req: any) { return this.service.saveVisit(this.id(id), dto, this.actor(req)); }
  @Get(':id') detail(@Param('id') id: string) { return this.service.detail(this.id(id)); }
  @Patch(':id') save(@Param('id') id: string, @Body() dto: SaveTrackingLeadDto, @Req() req: any) { return this.service.save(this.id(id), dto, this.actor(req)); }
  @Get(':id/preview') preview(@Param('id') id: string) { return this.service.preview(this.id(id)); }
  @Post(':id/promote') promote(@Param('id') id: string, @Body() dto: TrackingVersionDto, @Req() req: any) { return this.service.promote(this.id(id), dto.version, this.actor(req), req.user); }
  @Post(':id/order-link') link(@Param('id') id: string, @Body() dto: LinkTrackingOrderDto, @Req() req: any) { return this.service.link(this.id(id), dto, this.actor(req), req.user); }
  @Post(':id/sync-order') sync(@Param('id') id: string, @Body() dto: TrackingVersionDto, @Req() req: any) { return this.service.sync(this.id(id), dto.version, this.actor(req), req.user); }
}
