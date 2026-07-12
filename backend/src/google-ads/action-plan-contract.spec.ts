import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import AdmZip = require('adm-zip');
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

type ActionPlan = { actions?: Array<{ actionId?: string; idempotencyKey?: string }> };

const docsRoot = resolve(process.cwd(), '..', 'docs', 'ai-ads-v2');
const schemaPath = resolve(docsRoot, 'contracts', 'action-plan.schema.json');
const manifestSchemaPath = resolve(docsRoot, 'contracts', 'manifest.schema.json');
const fixtureRoot = resolve(docsRoot, 'validation-fixtures');
const fixtureManifestPath = resolve(fixtureRoot, 'validation-fixtures.json');
const sampleZipPath = resolve(docsRoot, 'samples', 'ads_execution_plan_PLAN-20260612-001.zip');

const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

const semanticErrors = (plan: ActionPlan) => {
  const errors: string[] = [];
  const actionIds = new Set<string>();
  const idempotencyKeys = new Set<string>();
  for (const action of plan.actions || []) {
    if (action.actionId && actionIds.has(action.actionId)) errors.push('DUPLICATE_ACTION_ID');
    if (action.idempotencyKey && idempotencyKeys.has(action.idempotencyKey)) errors.push('DUPLICATE_IDEMPOTENCY_KEY');
    if (action.actionId) actionIds.add(action.actionId);
    if (action.idempotencyKey) idempotencyKeys.add(action.idempotencyKey);
  }
  return [...new Set(errors)];
};

describe('AI Ads V2 action plan contract artifacts', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(json(schemaPath));
  const validateManifest = ajv.compile(json(manifestSchemaPath));
  const fixtureManifest = json(fixtureManifestPath);

  it.each(fixtureManifest.fixtures)('$file matches its expected validation result', (fixture: any) => {
    const plan = json(resolve(fixtureRoot, fixture.file));
    const schemaValid = validate(plan);
    const errors = [
      ...(schemaValid ? [] : ['SCHEMA_VALIDATION_FAILED']),
      ...semanticErrors(plan),
    ];

    expect(errors.length === 0).toBe(fixture.expectedValid);
    expect(errors).toEqual(expect.arrayContaining(fixture.expectedErrorCodes));
  });

  it('provides a complete sample ZIP whose action_plan.json validates', () => {
    expect(existsSync(sampleZipPath)).toBe(true);
    const zip = new AdmZip(sampleZipPath);
    const required = [
      'manifest.json',
      'action_plan.json',
      'executive_summary.md',
      'human_review_checklist.md',
      'creative_variants.csv',
      'keyword_plan.csv',
      'validation_rules.json',
      'risk_register.md',
      'rollback_plan.md',
    ];
    const names = zip.getEntries().map((entry) => entry.entryName);
    const plan = JSON.parse(zip.readAsText('action_plan.json'));
    const manifest = JSON.parse(zip.readAsText('manifest.json'));

    expect(names).toEqual(expect.arrayContaining(required));
    expect(names).toHaveLength(required.length);
    expect(validate(plan)).toBe(true);
    expect(semanticErrors(plan)).toEqual([]);
    expect(validateManifest(manifest)).toBe(true);
    expect(Object.entries(manifest.hashes).every(([name, expectedHash]) => {
      const entry = zip.getEntry(name);
      return entry && createHash('sha256').update(entry.getData()).digest('hex') === expectedHash;
    })).toBe(true);
  });
});
