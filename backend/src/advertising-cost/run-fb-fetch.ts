/**
 * Script: run-fb-fetch.ts
 * Mục đích: Chạy đồng bộ chi phí Facebook 1 lần (không cần gọi qua controller/auth).
 * Cách chạy (PowerShell):
 *   $env:FB_ADS_ACCESS_TOKEN="<token>"; npx ts-node -r tsconfig-paths/register src/advertising-cost/run-fb-fetch.ts --days 1
 *   # hoặc chỉ định ngày:
 *   $env:FB_ADS_ACCESS_TOKEN="<token>"; npx ts-node -r tsconfig-paths/register src/advertising-cost/run-fb-fetch.ts --date 2025-10-28
 */
import mongoose from 'mongoose';
import { AdvertisingCost, AdvertisingCostSchema } from './schemas/advertising-cost.schema';
import { AdGroup, AdGroupSchema } from '../ad-group/schemas/ad-group.schema';
import { AdAccount, AdAccountSchema } from '../ad-account/schemas/ad-account.schema';
import { ApiToken, ApiTokenSchema } from '../api-token/schemas/api-token.schema';
import { AdvertisingCostFacebookSyncService } from './advertising-cost.facebook-sync.service';

try { require('dotenv').config(); } catch {}

const DEFAULT_CONN = process.env.MONGODB_URI || 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/smarterp-dev';

async function main(){
  const argv = process.argv.slice(2);
  let date: string | undefined = undefined;
  let days: number | undefined = undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--date' && i+1 < argv.length) { date = String(argv[++i]); }
    else if (a === '--days' && i+1 < argv.length) { const n = Number(argv[++i]); if(!Number.isNaN(n)) days = n; }
  }

  console.log('FB Fetch one-off starting...', { date, days });
  await mongoose.connect(DEFAULT_CONN);
  const costModel = mongoose.model(AdvertisingCost.name, AdvertisingCostSchema);
  const adGroupModel = mongoose.model(AdGroup.name, AdGroupSchema);
  const adAccountModel = mongoose.model(AdAccount.name, AdAccountSchema);
  const tokenModel = mongoose.model(ApiToken.name, ApiTokenSchema);

  const svc = new AdvertisingCostFacebookSyncService(costModel as any, adGroupModel as any, adAccountModel as any, tokenModel as any);
  const res = await svc.syncRange({ date, days });
  console.log('Sync results:', res);
  await mongoose.disconnect();
  console.log('Done');
}

main().catch(err=>{ console.error('Run failed:', err); process.exit(1); });
