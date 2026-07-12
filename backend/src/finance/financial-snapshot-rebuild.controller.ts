import { Controller, Post, UseGuards } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { FeatureModule } from '../plan/feature-module.decorator';
import { FinanceEventListenerService } from './events/finance-event-listener.service';

@FeatureModule('finance')
@Controller('financial-control/snapshots')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermissions('finance')
export class FinancialSnapshotRebuildController {
  constructor(private readonly listener: FinanceEventListenerService) {}

  @Post('rebuild')
  @RequirePermissions('finance.policy.manage')
  rebuild() {
    return this.listener.rebuildCanonicalSnapshots();
  }
}
