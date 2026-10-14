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


test('private attendee and user API operations explicitly declare session-cookie security', () => {
 const privatePaths=['/api/users/{id}','/api/me/signups','/api/events/{id}/signups','/api/events/{id}/participants'];
 for(const path of privatePaths){
  assert.ok(spec.paths[path],path+' must be documented');
  for(const [method,op] of Object.entries(spec.paths[path])){
   if(!['get','post','put','patch','delete'].includes(method))continue;
   assert.deepEqual(op.security,[{SessionCookie:[]}],method.toUpperCase()+' '+path+' must require a session');
  }
 }
});


test('event creation and editing contracts preserve optional capacity semantics',()=>{
 const create=spec.components.schemas.EventCreateInput.properties.capacity;
 const update=spec.paths['/api/admin/events/{id}'].put.requestBody.content['application/json'].schema.properties.capacity;
 for(const [kind,value] of [['create',create],['update',update]]){
  assert.deepEqual(value.type,['integer','null'],kind+' must distinguish unlimited and finite capacity');
  assert.equal(value.minimum,0,kind+' cannot allow a negative capacity');
 }
});

test('operation IDs stay unique and public event reads remain anonymous', () => {
 const seen=new Set();
 for(const [path,item] of Object.entries(spec.paths)){
  for(const [method,op] of Object.entries(item)){
   if(!['get','post','put','patch','delete'].includes(method))continue;
   assert.ok(op.operationId,method.toUpperCase()+' '+path+' is missing an operation ID');
   assert.ok(!seen.has(op.operationId),'Duplicate operation ID: '+op.operationId);
   seen.add(op.operationId);
  }
 }
 for(const path of ['/api/events','/api/events/{id}']){
  assert.deepEqual(spec.paths[path].get.security,[],path+' must remain anonymously readable');
 }
});

test('usage metrics distinguish unavailable from zero and deny anonymous requests', () => {
 const op=spec.paths['/api/admin/usage'].get;
 assert.deepEqual(op.security,[{SessionCookie:[]}]);
 assert.ok(op.responses['401']);
 assert.ok(op.responses['403']);
 const schema=op.responses['200'].content['application/json'].schema;
 const provider=schema.properties.providers.items;
 assert.deepEqual(provider.properties.status.enum,['available','stale','unavailable']);
 for(const key of ['used','limit','remaining']){
  assert.ok(provider.required.includes(key),key+' must be explicit');
  assert.ok(provider.properties[key].type.includes('null'),key+' must allow unknown');
 }
});

test('participant roster documents names-only output and active-participant authorization', () => {
 const op=spec.paths['/api/events/{id}/participants'].get;
 assert.deepEqual(op.security,[{SessionCookie:[]}]);
 assert.ok(op.responses['401']);
 assert.ok(op.responses['403']);
 const entry=op.responses['200'].content['application/json'].schema.properties.participants.items;
 assert.deepEqual(entry.required,['name']);
 assert.deepEqual(Object.keys(entry.properties),['name']);
});

test('unclaimed user creation requires admin rights and never accepts consent fields', () => {
 const op=spec.paths['/api/admin/users'].post;
 assert.deepEqual(op.security,[{SessionCookie:[]}]);
 for(const status of ['201','401','403','409','422'])assert.ok(op.responses[status],status+' must be documented');
 const body=op.requestBody.content['application/json'].schema;
 assert.deepEqual(body.required,['firstName','lastName']);
 assert.ok(body.properties.email.type.includes('null'),'email must be optional or null for unclaimed stubs');
 for(const forbidden of ['agreementCurrent','consentAccepted','emailVerified','administratorEligible','privileged']){
  assert.equal(Object.hasOwn(body.properties,forbidden),false,'admin stub input must not explicitly authorize '+forbidden);
 }
});

test('self signup contract requires authentication and origin on every mutation', () => {
 const operations=spec.paths['/api/events/{id}/signups'];
 for(const method of ['post','delete']){
  const op=operations[method];
  assert.deepEqual(op.security,[{SessionCookie:[]}]);
  assert.ok(op.parameters.some(p=>p.in==='header'&&p.name==='Origin'&&p.required),method+' must document origin');
  assert.ok(op.responses['401'],'unauthenticated access must be documented');
  assert.ok(op.responses['403'],'profile and consent gates must be documented');
  assert.ok(op.responses['409'],'capacity and cutoff conflict must be documented');
 }
});

test('delegated signup mutations require admin sessions and explicit CSRF origin', () => {
 const route=spec.paths['/api/admin/events/{id}/signups'];
 for(const method of ['post','delete']){
  const op=route[method];
  assert.deepEqual(op.security,[{SessionCookie:[]}],method+' cannot be anonymous');
  for(const status of ['401','403','409'])assert.ok(op.responses[status],method+' must document '+status);
  const parameters=[...(route.parameters||[]),...(op.parameters||[])];
  assert.ok(parameters.some(p=>p.in==='header'&&p.name==='Origin'&&p.required),method+' must require origin');
 }
});

test('signup success response envelopes match documented client expectations',()=>{
 const cases=[
  ['/api/events/{id}/signups','get','200','signup'],
  ['/api/events/{id}/signups','post','201','signup'],
  ['/api/events/{id}/signups','delete','200','withdrawn'],
  ['/api/admin/events/{id}/signups','get','200','signups'],
  ['/api/admin/events/{id}/signups','post','201','signup'],
  ['/api/admin/events/{id}/signups','delete','200','withdrawn'],
  ['/api/me/signups','get','200','signups']
 ];
 for(const [route,method,status,key] of cases){
  const op=spec.paths[route]?.[method];
  assert.ok(op,method+' '+route+' is missing');
  const schema=op.responses[status]?.content?.['application/json']?.schema;
  assert.ok(schema,method+' '+route+' lacks JSON '+status+' response schema');
  assert.ok(schema.required?.includes(key),method+' '+route+' must require '+key+' in '+status);
  assert.ok(schema.properties?.[key],method+' '+route+' must define '+key);
 }
});
