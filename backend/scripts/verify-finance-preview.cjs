const assert = require('node:assert/strict');
async function main() {
  const origin='http://127.0.0.1:4301';
  const login = await fetch(`${origin}/__local/login`,{method:'POST',headers:{Origin:origin}});
  assert.equal(login.status,200,'local login');
  const session = await login.json();
  const token = session.access_token || session.accessToken || session.token;
  assert.ok(token,'local session available');
  async function get(path) {
    const response = await fetch(`http://127.0.0.1:3002/api/${path}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(60000)});
    assert.equal(response.status,200,path);return response.json();
  }
  const [ledger,daily,accounts,control] = await Promise.all([
    get('finance/business-ledger/report?from=2026-09-01&to=2026-09-09'),
    get('ad-group-daily-report?fromDate=2026-09-01&toDate=2026-09-09'),
    get('finance/business-ledger/accounts'),get('financial-control/dashboard'),
  ]);
  assert.equal(daily.basis,'business_ledger_live');
  assert.equal(daily.summary.totalAdsCost,ledger.adGroups.reduce((s,r)=>s+r.advertisingCost,0));
  assert.equal(daily.summary.totalNetProfit,ledger.adGroups.reduce((s,r)=>s+r.recordedNetProfit,0));
  assert.ok(Array.isArray(accounts));
  console.log(JSON.stringify({status:'PASS',basis:daily.basis,adsCost:daily.summary.totalAdsCost,profit:daily.summary.totalNetProfit,
    accounts:accounts.length,decisionLocked:control.dataQuality?.isDecisionLocked},null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
