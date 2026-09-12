// Current regression verification; the original failing audit is preserved in
// .local-ledger/quotes-counterparty-audit.json and docs/finance.
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
if (process.env.ERP_LOCAL_SANDBOX !== 'true' || !process.execArgv.some(a => a.includes('local-ledger-guard.cjs'))) {
  throw new Error('Run with --require ./scripts/local-ledger-guard.cjs');
}
const backend = path.resolve(__dirname, '..');
const output = path.resolve(backend, '../.local-ledger/quotes-counterparty-regression.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
const suites = [
  'src/quote/quote.commercial.spec.ts',
  'src/supplier-quote/supplier-quote.service.spec.ts',
  'src/test-order2/services/order-price-snapshot.regression.spec.ts',
  'src/business-ledger/counterparty-balances.spec.ts',
  'src/business-ledger/counterparty-compatibility.spec.ts',
  'src/business-ledger/settlement.rules.spec.ts',
  'src/business-ledger/settlement.service.spec.ts',
  'src/business-ledger/business-ledger.service.spec.ts',
  'src/finance/cashflow-counterparty.spec.ts',
  'src/finance/financial-control-core-safety.service.spec.ts',
  'src/ops-action/ops-action.service.spec.ts',
];
const result = spawnSync(process.execPath, [
  '--require', path.join(__dirname, 'local-ledger-guard.cjs'),
  path.join(backend, 'node_modules/jest/bin/jest.js'),
  '--runInBand', '--silent', '--json', '--outputFile', output, ...suites,
], { cwd: backend, stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
