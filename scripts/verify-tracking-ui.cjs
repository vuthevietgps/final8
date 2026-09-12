// Isolated browser against the local demo; never reads the user's browser/session.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { MongoClient, ObjectId } = require('mongodb');
async function main() {
  const browser = await chromium.launch({ headless: true });
  const mongo = new MongoClient('mongodb://127.0.0.1:27027/erp_ledger_local_20260904');
  const visitId = new ObjectId();
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const requests = [];
    page.on('request', request => {
      if (request.url().includes('/api/tracking-crm')) requests.push(new URL(request.url()).pathname);
    });
    await page.goto('http://127.0.0.1:4300/__local/tracking');
    await page.getByRole('button', { name: 'Mở Tracking & CRM', exact: true }).click();
    await page.locator('.crm table tbody .open').first().waitFor();
    await page.getByRole('button', { name: 'Áp dụng bộ lọc', exact: true }).waitFor();
    await page.getByRole('button', { name: /Bộ lọc nâng cao/ }).click();
    await page.locator('.crm .filter-grid label').filter({ hasText: 'IP chính xác' }).locator('input').fill('203.0.113.10');
    await page.getByRole('button', { name: 'Áp dụng bộ lọc', exact: true }).click();
    await page.locator('.list-help').filter({ hasText: '2 lượt truy cập phù hợp' }).waitFor();
    assert.equal(await page.locator('.crm table tbody .open').count(), 2);
    const before = requests.length;
    const start = performance.now();
    await page.locator('.crm table tbody .open').first().click();
    await page.locator('.crm .drawer').waitFor({ state: 'visible' });
    const openMs = Math.round(performance.now() - start);
    assert.equal(requests.length, before, 'opening a row must not wait for another API call');
    assert.ok(await page.locator('.drawer').innerText().then(t => t.includes('203.0.113.10')));
    await page.locator('.drawer .evidence summary').click();
    await page.locator('.drawer .evidence li').first().waitFor();
    await page.getByRole('button', { name: 'Đóng hồ sơ', exact: true }).click();
    await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
    await page.locator('.crm table tbody .open').nth(6).waitFor();
    assert.equal(await page.locator('label').filter({ hasText: 'Lọc thời gian theo' }).locator('select').inputValue(), 'visit');
    assert.equal(requests.filter(url => url.endsWith('/options')).length, 1, 'filters must reuse loaded options');
    await page.screenshot({ path: path.resolve('.local-ledger/tracking-ui.png'), fullPage: true });
    await mongo.connect();
    const db = mongo.db();
    await db.collection('tracking_crm_visits').insertOne({ _id: visitId,
      sourceId: new ObjectId('670000000000000000000001'), externalVisitId: `ui-test-${visitId}`,
      landingHost: 'ui-test.example', landingPath: '/', occurredAt: new Date(),
      ipAddress: '192.0.2.77', ads: { provider: 'google' } });
    await page.locator('.crm .filter-grid label').filter({ hasText: 'IP chính xác' }).locator('input').fill('192.0.2.77');
    await page.getByRole('button', { name: 'Áp dụng bộ lọc', exact: true }).click();
    await page.locator('.list-help').filter({ hasText: '1 lượt truy cập phù hợp' }).waitFor();
    await page.locator('.crm table tbody .open').first().click();
    await page.locator('input[name="customerName"]').fill('Khách kiểm tra giao diện');
    await page.locator('textarea[name="notes"]').fill('Ghi chú thử nghiệm riêng');
    await page.locator('input[name="contactedAt"]').fill('2026-09-08T09:15');
    await page.locator('select[name="contactChannel"]').selectOption('phone');
    await page.locator('input[name="nextFollowUpAt"]').fill('2026-09-09T10:30');
    await page.getByRole('button', { name: 'Lưu cập nhật', exact: true }).click();
    await page.locator('.drawer .notice.success').filter({ hasText: 'Đã lưu thông tin tư vấn.' }).waitFor();
    await page.locator('.crm table tbody').getByText('Khách kiểm tra giao diện', { exact: true }).waitFor();
    assert.equal(await db.collection('tracking_crm_leads').countDocuments({ visitId }), 1);
    const savedLead = await db.collection('tracking_crm_leads').findOne({ visitId });
    assert.equal(savedLead.contactChannel, 'phone'); assert.equal(savedLead.contactedAt.toISOString(), '2026-09-08T02:15:00.000Z');
    assert.equal(await page.getByRole('button', { name: 'Tạo đơn chính thức · OrderTest2', exact: true }).isDisabled(), true);
    await page.screenshot({ path: path.resolve('.local-ledger/tracking-quick-entry.png'), fullPage: true });
    assert.deepEqual(errors, [], 'Angular runtime must have no page errors');
    console.log(JSON.stringify({ verified: true, openMs, filter: 'IP returns exactly 2 visits', opening: 'no API wait', optionsRequests: 1,
      save: 'creates one lead; drawer and table refresh without extra click; promotion disabled until closed', runtimeErrors: 0 }));
  } finally {
    await mongo.connect();
    await mongo.db().collection('tracking_crm_leads').deleteMany({ visitId });
    await mongo.db().collection('tracking_crm_visits').deleteOne({ _id: visitId });
    await mongo.close(); await browser.close();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

