import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { SecretRedactionInterceptor } from '../common/interceptors/secret-redaction.interceptor';
import { AdsAutomationDraftService } from './ads-automation-draft.service';

@Controller('ads-automation/drafts')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(SecretRedactionInterceptor)
export class AdsAutomationDraftController {
  constructor(private readonly service: AdsAutomationDraftService) {}

  @Get('google/pause-review/preview')
  @RequirePermissions('google-ads.read')
  previewGoogle(@Query('limit') limit?: string) {
    return this.service.previewPauseReviewDrafts('google_ads', {
      limit: parseLimit(limit),
    });
  }

  @Post('google/pause-review')
  @RequirePermissions('google-ads.plan')
  materializeGoogle(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
  ) {
    return this.service.materializePauseReviewDrafts(
      'google_ads',
      userId(user),
      { limit: parseLimit(limit) },
    );
  }

  @Get('meta/pause-review/preview')
  @RequirePermissions('meta-ads.read')
  previewMeta(@Query('limit') limit?: string) {
    return this.service.previewPauseReviewDrafts('meta_ads', {
      limit: parseLimit(limit),
    });
  }

  @Post('meta/pause-review')
  @RequirePermissions('meta-ads.plan')
  materializeMeta(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
  ) {
    return this.service.materializePauseReviewDrafts(
      'meta_ads',
      userId(user),
      { limit: parseLimit(limit) },
    );
  }
}

function parseLimit(value?: string): number | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function userId(user: any): string {
  return String(user?.id || user?._id || user?.sub || '').trim();
}
