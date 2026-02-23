import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  @Get()
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('db')
  async db() {
    try {
      const state = this.conn.readyState; // 1 connected, 2 connecting, 0 disconnected
      const name = this.conn.name;
      const collections = await this.conn.db.listCollections().toArray();
      // Quick counts for a few known collections (ignore errors)
      const colNames = ['testorders2', 'summary4', 'summary5'];
      const counts: Record<string, number | string> = {};
      for (const c of colNames) {
        try {
          counts[c] = await this.conn.db.collection(c).countDocuments();
        } catch {
          counts[c] = 'n/a';
        }
      }
      return { status: 'ok', state, dbName: name, counts };
    } catch (e: any) {
      return { status: 'error', message: String(e?.message || e) };
    }
  }
}
