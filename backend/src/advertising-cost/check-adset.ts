/**
 * Script: check-adset.ts
 * Mục đích: Kiểm tra 1 adset (adGroupId) có truy cập được bằng token hiện tại không.
 * Cách chạy (PowerShell):
 *   $env:FB_ADS_ACCESS_TOKEN="<token>"; npx ts-node -r tsconfig-paths/register src/advertising-cost/check-adset.ts --id 120234808394010255
 */
import axios from 'axios';

function parseArgs(){
  const argv = process.argv.slice(2);
  let id: string | undefined;
  let date: string | undefined;
  for (let i=0;i<argv.length;i++){
    const a = argv[i];
    if(a==='--id' && i+1<argv.length){ id = String(argv[++i]); }
    else if(a==='--date' && i+1<argv.length){ date = String(argv[++i]); }
  }
  return { id, date };
}

async function main(){
  const { id, date } = parseArgs();
  const token = process.env.FB_ADS_ACCESS_TOKEN;
  if(!id) throw new Error('Missing --id');
  if(!token) throw new Error('Missing FB_ADS_ACCESS_TOKEN');
  const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(id)}`;
  const params: any = {
    fields: 'id,name,account_id,campaign_id,status,configured_status,created_time',
    access_token: token,
  };
  try{
    const res = await axios.get(url, { params });
    console.log('✅ Adset accessible:', res.data);
  } catch(err: any){
    const e = err?.response?.data || err?.message;
    console.log('❌ Cannot access adset', id, 'error:', e);
  }

  if(date){
    const insightsUrl = `https://graph.facebook.com/v19.0/${encodeURIComponent(id)}/insights`;
    const insightsParams: any = {
      fields: 'spend,cpm,cpc,frequency,date_start,date_stop',
      time_range: JSON.stringify({ since: date, until: date }),
      time_increment: 1,
      level: 'adset',
      access_token: token,
    };
    try{
      const insRes = await axios.get(insightsUrl, { params: insightsParams });
      console.log('📊 Insights data:', insRes.data);
    } catch(err: any){
      const e = err?.response?.data || err?.message;
      console.log('❌ Insights error:', e);
    }
  }
}

main().catch(e=>{ console.error('Failed:', e); process.exit(1); });
