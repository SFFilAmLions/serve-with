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

test('YAML generates typed Cloudflare Worker operation registry and dispatch', () => {
  const result = spawnSync(process.execPath, ['scripts/generate-openapi-operations.mjs'], {encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const generated = readFileSync('src/generated/openapi-operations.ts', 'utf8');
  const declared = Object.values(spec.paths).flatMap(item => Object.values(item).filter(op=>op?.operationId).map(op=>op.operationId));
  for (const id of declared) assert.ok(generated.includes('id: "'+id+'"'), id);
  assert.match(generated, /export type WorkerHandlers =/);
  assert.match(generated, /export function dispatchOperation/);
});

test('YAML generates a typed same-origin browser client', () => {
  const result = spawnSync(process.execPath, ['scripts/generate-openapi-client.mjs'], {encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const generated = readFileSync('src/generated/openapi-client.ts', 'utf8');
  for (const id of ['listEvents','getEvent','createAdminEvent','getCurrentSession','requestSignIn'])
    assert.ok(generated.includes('async '+id+'('), id);
  assert.match(generated, /credentials: "same-origin"/);
  assert.match(generated, /export type EventCreateInput/);
});

test('generated dispatcher matches dynamic paths and routes requests to handlers', async () => {
  const ts = await import('typescript');
  const source = readFileSync('src/generated/openapi-operations.ts', 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText;
  const registry = await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
  const match = registry.matchOperation('GET','/api/events/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  assert.equal(match.id, 'getEvent');
  assert.equal(match.params.id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  assert.equal(registry.matchOperation('POST','/api/events/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), null);
  const handlers = Object.fromEntries(registry.operations.map(op=>[op.id, (_req, params) => Response.json({operation:op.id,params})]));
  const response = await registry.dispatchOperation(new Request('https://example.test/api/events/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), handlers);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {operation:'getEvent',params:{id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}});
});
test('generated browser client sends same-origin JSON mutation and captures typed path', async () => {
  const ts = await import('typescript');
  const source = readFileSync('src/generated/openapi-client.ts', 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText;
  const client = await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
  let seen;
  const api = client.createApiClient({fetcher: async (url,init) => {
    seen={url,init};
    return Response.json({event:{id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',title:'Test',location:'Park',timezone:'UTC',start_at:1,end_at:2,version:1}},{status:201});
  }});
  const body={title:'Test',location:'Park',timezone:'UTC',start:'2026-11-14T09:00',end:'2026-11-14T10:00'};
  const result=await api.createAdminEvent({body});
  assert.equal(seen.url,'/api/admin/events');
  assert.equal(seen.init.method,'POST');
  assert.equal(seen.init.credentials,'same-origin');
  assert.equal(JSON.parse(seen.init.body).title,'Test');
  assert.equal(result.status,201);
});


test('administrative OpenAPI endpoints explicitly require session authentication', () => {
 const methods=new Set(['get','post','put','patch','delete']);
 for(const [path,item] of Object.entries(spec.paths)){
  if(!path.startsWith('/api/admin/'))continue;
  for(const [method,operation] of Object.entries(item)){
   if(!methods.has(method))continue;
   assert.deepEqual(operation.security,[{SessionCookie:[]}],method.toUpperCase()+' '+path+' must not be public');
  }
 }
});
