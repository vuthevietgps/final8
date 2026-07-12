const { createHash } = require('crypto');
const { mkdirSync, readFileSync, writeFileSync } = require('fs');
const { join, resolve } = require('path');
const AdmZip = require(resolve(__dirname, '../../../backend/node_modules/adm-zip'));

const docsRoot = resolve(__dirname, '..');
const fixturePath = join(docsRoot, 'validation-fixtures', 'valid', 'action_plan.valid.json');
const packageDir = join(docsRoot, 'samples', 'valid-package');
const zipPath = join(docsRoot, 'samples', 'ads_execution_plan_PLAN-20260612-001.zip');
const actionPlanPath = join(packageDir, 'action_plan.json');
const manifestPath = join(packageDir, 'manifest.json');
const packageFiles = [
  'action_plan.json',
  'executive_summary.md',
  'human_review_checklist.md',
  'creative_variants.csv',
  'keyword_plan.csv',
  'validation_rules.json',
  'risk_register.md',
  'rollback_plan.md',
];

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

mkdirSync(packageDir, { recursive: true });
writeFileSync(actionPlanPath, readFileSync(fixturePath));

const hashes = Object.fromEntries(
  packageFiles.map((name) => [name, sha256(readFileSync(join(packageDir, name)))]),
);
const manifest = {
  schemaVersion: '2.0',
  planId: 'PLAN-20260612-001',
  sourceExportId: 'EXP-20260612-001',
  generatedAt: '2026-06-12T10:00:00+07:00',
  generator: 'chatgpt-web',
  targetProvider: 'google',
  currency: 'VND',
  timezone: 'Asia/Ho_Chi_Minh',
  executionMode: 'pending_approval',
  hashes,
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const zip = new AdmZip();
for (const name of ['manifest.json', ...packageFiles]) {
  zip.addFile(name, readFileSync(join(packageDir, name)));
}
zip.writeZip(zipPath);
console.log(JSON.stringify({ zipPath, entries: zip.getEntries().map((entry) => entry.entryName) }));
