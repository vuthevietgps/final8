import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { SecretRedactionInterceptor } from '../common/interceptors/secret-redaction.interceptor';
import { GoogleAdsActionPlanImportService } from './google-ads-action-plan-import.service';
import { GoogleAdsActionPlanService } from './google-ads-action-plan.service';
import { GoogleAdsExecutionService } from './google-ads-execution.service';
import { GoogleAdsExportService } from './google-ads-export.service';
import { GoogleAdsProviderValidationService } from './google-ads-provider-validation.service';
import { GoogleAdsReadonlySyncService } from './google-ads-readonly-sync.service';

@Controller('google-ads')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(SecretRedactionInterceptor)
@RequirePermissions('google-ads.read')
export class GoogleAdsController {
  constructor(
    private readonly readonlySyncService: GoogleAdsReadonlySyncService,
    private readonly exportService: GoogleAdsExportService,
    private readonly actionPlanImportService: GoogleAdsActionPlanImportService,
    private readonly providerValidationService: GoogleAdsProviderValidationService,
    private readonly actionPlanService: GoogleAdsActionPlanService,
    private readonly executionService: GoogleAdsExecutionService,
  ) {}

  @Post('action-plans/import')
  @RequirePermissions('google-ads.plan')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: {
      fileSize: Number(process.env.GOOGLE_ADS_ACTION_PLAN_MAX_ZIP_BYTES || 10 * 1024 * 1024),
      files: 1,
    },
    fileFilter: (_request, file, callback) => {
      const validName = String(file.originalname || '').toLowerCase().endsWith('.zip');
      const validMime = ['application/zip', 'application/x-zip-compressed', 'application/octet-stream']
        .includes(String(file.mimetype || '').toLowerCase());
      callback(validName && validMime ? null : new BadRequestException('Only ads_execution_plan.zip is accepted.'), validName && validMime);
    },
  }))
  importActionPlan(
    @UploadedFile() file: Express.Multer.File,
    @Body('source') source?: string,
  ) {
    return this.actionPlanImportService.importPending(file, { source: source || 'codex_operator' });
  }

  @Post('action-plans/:planId/validate')
  @RequirePermissions('google-ads.plan')
  validateActionPlan(
    @Param('planId') planId: string,
    @Body() body?: { validateOnly?: boolean },
  ) {
    if (body?.validateOnly === false) {
      throw new BadRequestException('Provider validation only supports validateOnly=true.');
    }
    return this.providerValidationService.validatePlan(planId);
  }

  @Patch('action-plans/:planId/items/:actionId/approve')
  @RequirePermissions('google-ads.approve')
  approveActionPlanItem(
    @CurrentUser() currentUser: any,
    @Param('planId') planId: string,
    @Param('actionId') actionId: string,
    @Body() body: { approvedBySource?: string; approvalText?: string; requireExecutionConfirmation?: boolean },
  ) {
    return this.actionPlanService.approve(currentUser, planId, actionId, body);
  }

  @Patch('action-plans/:planId/items/:actionId/reject')
  @RequirePermissions('google-ads.approve')
  rejectActionPlanItem(
    @CurrentUser() currentUser: any,
    @Param('planId') planId: string,
    @Param('actionId') actionId: string,
    @Body() body: { rejectedBySource?: string; reason?: string },
  ) {
    return this.actionPlanService.reject(currentUser, planId, actionId, body);
  }

  @Get('action-plans/:planId')
  getActionPlan(@Param('planId') planId: string) {
    return this.actionPlanService.getPlan(planId);
  }

  @Get('action-plans/:planId/executions')
  getActionPlanExecutions(@Param('planId') planId: string) {
    return this.actionPlanService.getExecutions(planId);
  }

  @Post('action-plans/:planId/execute')
  @RequirePermissions('google-ads.execute')
  executeActionPlan(
    @CurrentUser() currentUser: any,
    @Param('planId') planId: string,
    @Body() body: {
      actionIds?: string[];
      dryRun?: boolean;
      validateOnly?: boolean;
      source?: string;
    },
  ) {
    return this.executionService.execute(currentUser, planId, body);
  }

  @Post('operator/export-live-analysis')
  exportLiveAnalysis(@Body() body?: Record<string, any>) {
    return this.exportService.createLiveAnalysisExport(body);
  }

  @Get('operator/exports/:exportId/download')
  async downloadExport(@Param('exportId') exportId: string, @Res() response: Response) {
    const file = await this.exportService.getDownload(exportId);
    response.setHeader('Content-Type', 'application/zip');
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return response.sendFile(file.filePath);
  }

  @Post('operator/exports/:exportId/verify')
  verifyExport(@Param('exportId') exportId: string) {
    return this.exportService.verifyExport(exportId);
  }

  @Post('sync/readonly')
  syncReadonly(@Body() body?: { customerIds?: string[]; dateFrom?: string; dateTo?: string }) {
    return this.readonlySyncService.sync(body);
  }

  @Get('sync/runs/latest')
  latestSyncRun() {
    return this.readonlySyncService.getLatestRun();
  }
}
