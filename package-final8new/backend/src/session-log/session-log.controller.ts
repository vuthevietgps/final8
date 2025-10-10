import { Controller, Get, Post, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { SessionLogService } from './session-log.service';

@UseGuards(JwtAuthGuard)
@Controller('session-logs')
export class SessionLogController {
  constructor(private service: SessionLogService) {}

  @Get('me')
  async myLogs(@Req() req: any) {
    const userId = req.user?.id || req.user?._id;
    return this.service['model'].find({ userId }).sort({ loginAt: -1 }).lean();
  }

  // Endpoint logout: đóng session gần nhất của tôi
  @Post('logout')
  async logout(@Req() req: any) {
    const userId = req.user?.id || req.user?._id;
    await this.service.logLogout(userId);
    return { ok: true };
  }

  @Post('create-demo')
  async createDemo() {
    return this.service.createDemoSessions();
  }
}
