import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Process liveness only. Never use this endpoint as deployment readiness. */
  @Get('live')
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /** Backward-compatible health endpoint that still verifies the database is writable. */
  @Get()
  health() {
    return this.healthService.checkDatabase(false);
  }

  /** Production readiness: DB ping, writable primary, transactions and critical indexes. */
  @Get('ready')
  ready() {
    return this.healthService.checkDatabase(true);
  }

  /** Legacy alias. Response intentionally excludes database name and collection counts. */
  @Get('db')
  database() {
    return this.healthService.checkDatabase(true);
  }
}
