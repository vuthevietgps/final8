import { Controller, Get, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { SecretRedactionInterceptor } from '../common/interceptors/secret-redaction.interceptor';
import { AdsAutomationEvidenceService } from './ads-automation-evidence.service';
import { AdsAutomationEvidenceSnapshotStoreService } from './ads-automation-evidence-snapshot-store.service';

@Controller('ads-automation/evidence')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(SecretRedactionInterceptor)
@RequirePermissions('google-ads.read')
export class AdsAutomationEvidenceController {
  constructor(
    private readonly service: AdsAutomationEvidenceService,
    private readonly snapshotStore: AdsAutomationEvidenceSnapshotStoreService,
  ) {}

  @Get('snapshot')
  snapshot(
    @Query('limit') limit?: string,
    @Query('lookbackDays') lookbackDays?: string,
  ) {
    return this.service.buildSnapshot({
      limit: limit ? Number(limit) : undefined,
      lookbackDays: lookbackDays ? Number(lookbackDays) : undefined,
    });
  }

  @Post('snapshots/capture')
  @RequirePermissions('google-ads.plan')
  capture(
    @Query('limit') limit?: string,
    @Query('lookbackDays') lookbackDays?: string,
  ) {
    return this.snapshotStore.captureDaily({
      limit: limit ? Number(limit) : undefined,
      lookbackDays: lookbackDays ? Number(lookbackDays) : undefined,
    });
  }

  @Get('snapshots/latest')
  latest(@Query('environment') environment?: string) {
    return this.snapshotStore.latest(environment);
  }

  @Get('snapshots/history')
  history(
    @Query('environment') environment?: string,
    @Query('limit') limit?: string,
    @Query('beforeDateKey') beforeDateKey?: string,
  ) {
    return this.snapshotStore.history({
      environment,
      limit: limit ? Number(limit) : undefined,
      beforeDateKey,
    });
  }
}
