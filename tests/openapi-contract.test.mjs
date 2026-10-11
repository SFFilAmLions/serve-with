import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import YAML from 'yaml';

const spec = YAML.parse(readFileSync(new URL('../openapi/openapi.yaml', import.meta.url), 'utf8'));
test('contract structural validation succeeds', () => {
  const result = spawnSync(process.execPath, ['scripts/validate-openapi.mjs'], {encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
test('public and administrative proof operations have stable IDs and security declarations', () => {
  assert.equal(spec.paths['/api/events/{id}'].get.operationId, 'getEvent');
  assert.deepEqual(spec.paths['/api/events/{id}'].get.security, []);
  const mutation=spec.paths['/api/admin/events'].post;
  assert.equal(mutation.operationId, 'createAdminEvent');
  assert.deepEqual(mutation.security, [{SessionCookie: []}]);
  assert.ok(mutation.parameters.some(p => p.name === 'Origin' && p.required));
  assert.ok(mutation.responses['201']);
  assert.ok(mutation.responses['403']);
});
