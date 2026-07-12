import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { AdsBusinessContextService } from './ads-business-context.service';
import {
  CreateBusinessDailyNoteDto,
  CreateLandingPageDto,
  RejectLandingPageDto,
  UpdateBusinessDailyNoteDto,
  UpdateLandingPageDto,
} from './dto/ads-business-context.dto';
import { LandingPageApprovalStatus } from './schemas/landing-page.schema';

@Controller('ads-business-context')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdsBusinessContextController {
  constructor(private readonly service: AdsBusinessContextService) {}

  @Get('landing-pages')
  @RequirePermissions('google-ads.read')
  listLandingPages(
    @Query('approvalStatus') approvalStatus?: LandingPageApprovalStatus,
    @Query('productId') productId?: string,
    @Query('domain') domain?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.listLandingPages({ approvalStatus, productId, domain, page, limit });
  }

  @Get('landing-pages/:id')
  @RequirePermissions('google-ads.read')
  getLandingPage(@Param('id') id: string) {
    return this.service.getLandingPage(id);
  }

  @Post('landing-pages')
  @RequirePermissions('google-ads.plan')
  createLandingPage(@CurrentUser() user: any, @Body() dto: CreateLandingPageDto) {
    return this.service.createLandingPage(dto, user);
  }

  @Patch('landing-pages/:id')
  @RequirePermissions('google-ads.plan')
  updateLandingPage(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateLandingPageDto,
  ) {
    return this.service.updateLandingPage(id, dto, user);
  }

  @Patch('landing-pages/:id/approve')
  @RequirePermissions('google-ads.approve')
  approveLandingPage(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.approveLandingPage(id, user);
  }

  @Patch('landing-pages/:id/reject')
  @RequirePermissions('google-ads.approve')
  rejectLandingPage(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: RejectLandingPageDto,
  ) {
    return this.service.rejectLandingPage(id, dto.reason, user);
  }

  @Get('daily-notes')
  @RequirePermissions('google-ads.read')
  listDailyNotes(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('source') source?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.listDailyNotes({ dateFrom, dateTo, source, page, limit });
  }

  @Get('daily-notes/:id')
  @RequirePermissions('google-ads.read')
  getDailyNote(@Param('id') id: string) {
    return this.service.getDailyNote(id);
  }

  @Post('daily-notes')
  @RequirePermissions('google-ads.plan')
  createDailyNote(@CurrentUser() user: any, @Body() dto: CreateBusinessDailyNoteDto) {
    return this.service.createDailyNote(dto, user);
  }

  @Patch('daily-notes/:id')
  @RequirePermissions('google-ads.plan')
  updateDailyNote(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateBusinessDailyNoteDto,
  ) {
    return this.service.updateDailyNote(id, dto, user);
  }
}
