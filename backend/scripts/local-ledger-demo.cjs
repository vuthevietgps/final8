// Loopback-only demo host and real HTTP/MongoDB verification. No .env or remote DB.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const alternateDemo = process.argv.includes('--alternate-demo');
const apiPort = alternateDemo ? 3002 : 3001;
const webPort = alternateDemo ? 4301 : 4300;
const API = `http://127.0.0.1:${apiPort}/api`;
const ORIGIN = `http://127.0.0.1:${webPort}`;
const URI = 'mongodb://127.0.0.1:27027/erp_ledger_local_20260904';
const root = path.resolve(__dirname, '../..');
const webRoot = path.join(root, 'frontend/dist/management-frontend/browser');
const localDir = path.join(root, '.local-ledger');
const ids = Array.from({ length: 12 }, (_, i) => new ObjectId(`6600000000000000000000${String(i + 1).padStart(2, '0')}`));
// Keep the existing demo account/session valid when opening an alternate preview.
if (alternateDemo) ids[0] = new ObjectId('660000000000000000000099');
const [director, supplier, dealer, category, normal, custom, ...orderIds] = ids;
// Ephemeral demo credential; the loopback login button signs in without exposing it.
const password = crypto.randomBytes(32).toString('base64url');
const email = alternateDemo ? 'director.preview@ledger.local' : 'director@ledger.local';
let token;
const checks = [];
async function request(route, body, expected = body ? 201 : 200, auth = token, method = body ? 'POST' : 'GET') {
  const response = await fetch(API + route, {
    method, headers: { 'content-type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  assert.equal(response.status, expected, `${method} ${route}: ${response.status} ${result.message || ''}`);
  return result;
}
async function login() { return request('/auth/login', { email, password }, 201, null); }
async function runVerification(db) {
  const date = new Date(Date.now() - 3600000).toISOString();
  const day = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const openingAt = new Date(Date.now() - 86400000).toISOString();
  await request('/finance/business-ledger/accounts', undefined, 401, null);
  checks.push('Unauthenticated ledger access returns 401');
  const ledger = '/finance/business-ledger';
  const account = await request(ledger + '/accounts', { code: 'demo-bank', name: 'Ngân hàng thử nghiệm', openingBalance: 1000000, openingAt, evidence: 'Số dư giả lập local' });
  const rows = [
    ['Bán lẻ — NCC thu một phần', normal, null, 'Đang giao', 'Đã trả kết quả', 'LOCAL-RETAIL', 'recoverable'],
    ['Đại lý tự thu tiền', normal, dealer, 'Đang giao', 'Đã trả kết quả', 'LOCAL-DEALER', 'recoverable'],
    ['Hàng hoàn nhập lại kho', normal, null, 'Hàng hoàn', 'Đã trả kết quả', 'LOCAL-RETURN', 'recoverable'],
    ['Đại lý — hàng đặt sản xuất bị hoàn', custom, dealer, 'Hàng hoàn', 'Đã trả kết quả', 'LOCAL-CUSTOM', 'production_committed'],
    ['Bán lẻ — sản xuất xong chưa giao', custom, null, 'Đang giao', 'Đã trả kết quả', 'LOCAL-PENDING', 'production_committed'],
  ];
  for (let i = 0; i < rows.length; i++) {
    const [customerName, productId, agentId, orderStatus, productionStatus, trackingNumber, returnPolicy] = rows[i];
    await db.collection('ordertest2').insertOne({ _id: orderIds[i], customerName, productId, ...(agentId ? { agentId } : {}), supplierId: supplier, orderStatus, productionStatus, trackingNumber, quantity: 1, orderDate: new Date(date), isActive: true, adGroupId: 'LOCAL-ADS', supplierQuote: i === 1 ? 150000 : i >= 3 ? 160000 : 180000, agentQuote: i === 1 ? 250000 : 260000, createdAt: new Date(date), updatedAt: new Date(date) });
    await request(ledger + '/profiles', { orderId: String(orderIds[i]), saleMode: agentId ? 'dealer' : 'retail', fulfillment: 'supplier_direct', returnPolicy, evidence: 'Thỏa thuận giả lập local' });
  }
  const post = (index, kind, amount, extra = {}, expected = 201) => request(ledger + '/entries', { idempotencyKey: `demo-${crypto.randomUUID()}`, kind, amount, orderId: String(orderIds[index]), occurredAt: date, description: `Local: ${kind}`, evidence: 'Chứng từ giả lập local', ...extra }, expected);
  const confirm = (entry, expected = 201) => request(ledger + `/entries/${entry._id}/confirm`, {}, expected);
  const record = async (index, kind, amount, extra) => { const e = await post(index, kind, amount, extra); await confirm(e); return e; };
  await post(0, 'sale', 300000, {}, 400);
  await record(0, 'payment', 100000, { fromParty: 'customer', toParty: 'company', toAccountId: account._id });
  let detail = await request(ledger + `/orders/${orderIds[0]}`);
  assert.equal(detail.entries.reduce((sum, e) => sum + e.effects.revenue, 0), 0);
  checks.push('Retail advance creates cash and advance liability, no revenue before delivery');
  await db.collection('ordertest2').updateOne({ _id: orderIds[0] }, { $set: { orderStatus: 'Giao thành công' } });
  const saleDraft = await post(0, 'sale', 300000);
  await db.collection('ordertest2').updateOne({ _id: orderIds[0] }, { $set: { orderStatus: 'Đang giao' } });
  await confirm(saleDraft, 400);
  await db.collection('ordertest2').updateOne({ _id: orderIds[0] }, { $set: { orderStatus: 'Giao thành công' } });
  await confirm(saleDraft);
  checks.push('Revenue eligibility is checked again at confirmation');
  await record(0, 'direct_cost', 180000);
  await record(0, 'payment', 200000, { fromParty: 'customer', toParty: 'supplier' });
  const remittance = await post(0, 'payment', 20000, { fromParty: 'supplier', toParty: 'company', toAccountId: account._id });
  const confirmations = await Promise.allSettled([confirm(remittance), confirm(remittance)]);
  assert.ok(confirmations.some(r => r.status === 'fulfilled'));
  for (const result of confirmations) {
    if (result.status === 'rejected') assert.match(result.reason.message, /409/);
  }
  checks.push('Concurrent confirmation of supplier remittance counts once');
  await db.collection('ordertest2').updateOne({ _id: orderIds[1] }, { $set: { productionStatus: 'Đang làm' } });
  await post(1, 'sale', 250000, {}, 400);
  await db.collection('ordertest2').updateOne({ _id: orderIds[1] }, { $set: { productionStatus: 'Đã trả kết quả', trackingNumber: ' ' } });
  await post(1, 'sale', 250000, {}, 400);
  await db.collection('ordertest2').updateOne({ _id: orderIds[1] }, { $set: { trackingNumber: 'LOCAL-DEALER' } });
  await record(1, 'sale', 250000);
  await record(1, 'direct_cost', 150000);
  await record(1, 'payment', 350000, { fromParty: 'customer', toParty: 'agent' });
  await record(1, 'payment', 100000, { fromParty: 'agent', toParty: 'company', toAccountId: account._id });
  await record(1, 'payment', 50000, { fromParty: 'company', toParty: 'supplier', fromAccountId: account._id });
  checks.push('Dealer needs production AND tracking; dealer-collected retail price is not company cash or wholesale revenue');
  await post(2, 'sale', 300000, {}, 400);
  await record(2, 'direct_cost', 180000);
  await record(2, 'returned_stock', 180000);
  await record(2, 'expense', 30000, { expenseParty: 'supplier' });
  await record(3, 'sale', 260000);
  await record(3, 'direct_cost', 160000);
  await record(3, 'expense', 30000, { expenseParty: 'supplier' });
  // The agreement retains only production cost from the dealer; explicitly credit the rest.
  await record(3, 'sale_credit', 100000);
  await post(3, 'supplier_credit', 160000, {}, 400);
  await post(3, 'returned_stock', 160000, {}, 400);
  await record(4, 'direct_cost', 160000);
  await post(4, 'sale', 260000, {}, 400);
  checks.push('Recoverable return preserves supplier debt; committed production preserves cost; dealer credit is explicit');
  const adjustment = await record(0, 'cash_adjustment_in', 500, { orderId: undefined, toAccountId: account._id });
  const reversal = await post(0, 'reversal', 500, { orderId: undefined, reversalOf: adjustment._id });
  const reversal2 = await post(0, 'reversal', 500, { orderId: undefined, reversalOf: adjustment._id });
  await confirm(reversal);
  await confirm(reversal2, 409);
  await request(ledger + `/entries/${reversal2._id}/reject`, { reason: 'Bút toán đảo trùng — kiểm tra local' });
  checks.push('Mongo unique index prevents two confirmed reversals');
  await post(0, 'payment', 999000, { fromParty: 'customer', toParty: 'company', toAccountId: account._id });
  await db.collection('advertisingcosts').insertOne({ adGroupId: 'LOCAL-ADS', channel: 'facebook', customerId: 'local', spentAmount: 100000, currency: 'VND', date: new Date(date) });
  await db.collection('adgroups').insertOne({ adGroupId: 'LOCAL-ADS', name: 'Nhóm quảng cáo thử nghiệm', platform: 'facebook', isActive: true });
  const report = await request(ledger + `/report?from=${day}&to=${day}`);
  assert.equal(report.cash.registeredAccountsBalance, 1170000);
  assert.equal(report.totalReceivable, 310000);
  assert.equal(report.totalPayable, 660000);
  for (const dimension of ['products', 'agents', 'adGroups', 'orders']) {
    assert.equal(report[dimension].reduce((s, r) => s + r.recordedNetProfit, 0), -100000, dimension);
    assert.equal(report[dimension].reduce((s, r) => s + r.advertisingCost, 0), 100000, dimension);
  }
  assert.equal(report.pendingCount, 1);
  const retailRow = report.orders.find(r => r.orderId === String(orderIds[0]));
  assert.equal(retailRow.recordedNetProfit, 100000);
  checks.push('Confirmed cash 1,170,000; receivables 310,000; payables 660,000; all profit dimensions reconcile to -100,000 VND');
  // Product policy edits cannot rewrite an already accepted order contract.
  await request(`/products/${normal}`, { ledgerReturnPolicy: 'production_committed' }, 200, token, 'PATCH');
  detail = await request(ledger + `/orders/${orderIds[0]}`);
  assert.equal(detail.profile.context.returnPolicy, 'recoverable');
  await request(`/products/${normal}`, { ledgerReturnPolicy: 'recoverable' }, 200, token, 'PATCH');
  checks.push('Product policy API persists updates without rewriting existing order policy');
  fs.writeFileSync(path.join(localDir, 'verification.json'), JSON.stringify({ passed: checks.length, checks, testedAt: new Date().toISOString(), cash: report.cash.registeredAccountsBalance, receivable: report.totalReceivable, payable: report.totalPayable, netProfit: -100000 }, null, 2));
  console.log(`LOCAL_LEDGER_VERIFICATION: ${checks.length} scenarios passed`);
}

async function main() {
  if (!fs.existsSync(path.join(webRoot, 'index.html'))) throw new Error('Build frontend first');
  const client = await MongoClient.connect(URI);
  const db = client.db();
  assert.equal(db.databaseName, 'erp_ledger_local_20260904');
  const hashed = await bcrypt.hash(password, 12);
  await db.collection('users').updateOne({ _id: director }, { $set: { email, password: hashed, fullName: 'Giám đốc — dữ liệu thử local', role: 'director', isActive: true }, $inc: { tokenVersion: 1 } }, { upsert: true });
  for (const [id, name, role] of [[supplier, 'NCC thử nghiệm', 'external_supplier'], [dealer, 'Đại lý thử nghiệm', 'external_agent']]) {
    await db.collection('users').updateOne({ _id: id }, { $setOnInsert: { email: `${role}@ledger.local`, password: hashed, fullName: name, role, isActive: true } }, { upsert: true });
  }
  await db.collection('productcategories').updateOne({ _id: category }, { $setOnInsert: { name: 'Danh mục thử nghiệm', code: 'LOCAL', color: '#2563EB', icon: '📦' } }, { upsert: true });
  for (const [id, name, policy] of [[normal, 'Hàng thường — hoàn có thể thu hồi giá vốn', 'recoverable'], [custom, 'Hàng đặt sản xuất — đã làm phải trả NCC', 'production_committed']]) {
    await db.collection('products').updateOne({ _id: id }, { $setOnInsert: { name, ledgerReturnPolicy: policy, dealerReturnPolicy: 'full_sale_price', resalePolicy: policy === 'recoverable' ? 'resellable' : 'not_resellable', categoryId: category, status: 'Hoạt động', color: '#2563EB', usageDurationMonths: 12, assumedReturnRatePercent: 20, suppliers: [{ supplierId: supplier }] } }, { upsert: true });
  }
  token = (await login()).access_token;
  if (process.argv.includes('--verify')) {
    if (await db.collection('businessledgerentries').countDocuments()) throw new Error('Verification requires a fresh demo ledger; existing data preserved');
    await runVerification(db);
  }
  await client.close();
  const server = http.createServer(async (req, res) => {
    try {
      if (req.headers.host !== `127.0.0.1:${webPort}`) { res.writeHead(403); return res.end(); }
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
      if (req.url === '/__local/login' && req.method === 'POST') {
        if (req.headers.origin !== ORIGIN) { res.writeHead(403); return res.end(); }
        const auth = await login();
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(auth)); // Normal ERP authentication response; no fixture password exposed.
      }
      if (req.url === '/__local/tracking') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.end(`<!doctype html><html lang="vi"><meta charset="utf-8"><title>Tracking & CRM — local</title><style>body{font:17px system-ui;max-width:680px;margin:80px auto;padding:24px;background:#f5f7fb;color:#17263b}button{padding:14px 22px;background:#2964dc;color:white;border:0;border-radius:8px;font:inherit;cursor:pointer}</style><h1>Tracking & CRM</h1><p>Bản chạy thử trên máy với dữ liệu mẫu. Xem nguồn ads, chọn tài khoản đại lý, kiểm tra báo giá và cập nhật thông tin sang đơn ERP.</p><button id="enter">Mở Tracking & CRM</button><p id="status"></p><script>document.getElementById('enter').onclick=async()=>{try{const r=await fetch('/__local/login',{method:'POST'});if(!r.ok)throw Error();const a=await r.json();localStorage.setItem('access_token',a.access_token);localStorage.setItem('current_user',JSON.stringify(a.user));location.href='/tracking-crm';}catch{document.getElementById('status').textContent='Chưa kết nối được ERP local.'}};</script></html>`);
      }
      if (req.url === '/__local' || req.url === '/__local/') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.end(`<!doctype html><html lang="vi"><meta charset="utf-8"><title>ERP thử nghiệm local</title><style>body{font:18px system-ui;max-width:750px;margin:70px auto;padding:24px;background:#f4f7fb;color:#142039}button{font:inherit;padding:16px;background:#215ed9;color:white;border:0;border-radius:8px;cursor:pointer}li{margin:12px 0}</style><h1>ERP thử nghiệm trên máy này</h1><p>Dữ liệu giả lập riêng. Tiền và công nợ dưới đây dùng để kiểm tra nghiệp vụ.</p><p>Thông tin thực tế lấy từ sổ sau khi đăng nhập. Tạo báo giá, đơn bán và lần giao để kiểm tra luồng mới; dữ liệu thử cũ được giữ riêng và cần đối chiếu.</p><button id="enter">Mở sổ công nợ và tiền thực nhận</button><p id="status"></p><script>document.getElementById('enter').onclick=async()=>{try{const r=await fetch('/__local/login',{method:'POST'});if(!r.ok)throw Error();const a=await r.json();localStorage.setItem('access_token',a.access_token);localStorage.setItem('current_user',JSON.stringify(a.user));location.href='/finance/business-ledger';}catch{document.getElementById('status').textContent='Chưa kết nối được backend local.'}};</script></html>`);
      }
      if (req.url.startsWith('/api/')) {
        const proxy = http.request({ host: '127.0.0.1', port: apiPort, path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${apiPort}` } }, upstream => {
          res.writeHead(upstream.statusCode, upstream.headers); upstream.pipe(res);
        });
        proxy.on('error', () => { res.writeHead(502); res.end('Local backend unavailable'); });
        return req.pipe(proxy);
      }
      const relative = decodeURIComponent(req.url.split('?')[0]);
      const candidate = path.resolve(webRoot, '.' + relative);
      if (!candidate.startsWith(webRoot + path.sep) && candidate !== webRoot) { res.writeHead(403); return res.end(); }
      const file = fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : path.join(webRoot, 'index.html');
      const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
      res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
      fs.createReadStream(file).pipe(res);
    } catch { res.writeHead(500); res.end('Local demo error'); }
  });
  server.listen(webPort, '127.0.0.1', () => console.log(`LOCAL_DEMO_READY ${ORIGIN}/__local`));
}
main().catch(error => { console.error(error.message); process.exit(1); });
