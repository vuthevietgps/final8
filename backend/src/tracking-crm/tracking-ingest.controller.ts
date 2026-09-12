import { Body, CanActivate, Controller, ExecutionContext, Injectable, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { readFileSync } from 'fs';
import { TrackingIngestBatchDto } from './tracking-ingest.dto';
import { TrackingIngestService } from './tracking-ingest.service';

@Injectable()
export class TrackingIngestGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    let secret = '';
    try { secret = readFileSync('/run/secrets/tracking_ingest_token', 'utf8').trim(); } catch { /* Disabled without secret. */ }
    const supplied = context.switchToHttp().getRequest().headers['x-tracking-key'];
    if (secret.length < 32 || typeof supplied !== 'string' || supplied.length > 256 || !timingSafeEqual(
      createHash('sha256').update(secret).digest(), createHash('sha256').update(supplied).digest(),
    )) throw new UnauthorizedException('Tracking source authentication failed');
    return true;
  }
}

@Controller('tracking-ingest')
@UseGuards(TrackingIngestGuard)
export class TrackingIngestController {
  constructor(private readonly service: TrackingIngestService) {}
  @Post('visits') ingest(@Body() dto: TrackingIngestBatchDto) { return this.service.ingest(dto); }
}
