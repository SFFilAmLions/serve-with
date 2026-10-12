import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

const opSource = readFileSync('src/generated/openapi-operations.ts','utf8');
const opJS = ts.transpileModule(opSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
globalThis.__testOpenapiRegistry = await import('data:text/javascript;base64,'+Buffer.from(opJS).toString('base64'));
const validationTS=readFileSync('src/generated/openapi-validators.ts','utf8');
const validationJS=ts.transpileModule(validationTS,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
globalThis.__testOpenapiValidators=await import('data:text/javascript;base64,'+Buffer.from(validationJS).toString('base64'));

globalThis.__testTemporal = (await import('@js-temporal/polyfill')).Temporal;
globalThis.__testEligibility = (await import('data:text/javascript;base64,' + Buffer.from(
  ts.transpileModule(readFileSync('src/registration-eligibility.ts','utf8'),
    {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
).toString('base64'))).isStagingRegistrationEligible;

globalThis.__testPolicyMetadata = JSON.parse(readFileSync('src/generated/policy-versions.json','utf8'));
const source = readFileSync('src/worker.ts','utf8')
  .replace("import { operations, matchOperation, dispatchOperation, type WorkerHandlers } from './generated/openapi-operations';", "const {operations,matchOperation,dispatchOperation}=globalThis.__testOpenapiRegistry;")
  .replace("import { validateOperationBody } from './generated/openapi-validators';", "const {validateOperationBody}=globalThis.__testOpenapiValidators;")
  .replace("import policyMetadata from './generated/policy-versions.json';", "const policyMetadata = globalThis.__testPolicyMetadata;")
  .replace("import { Temporal } from '@js-temporal/polyfill';", "const Temporal = globalThis.__testTemporal;")
  .replace("import { isStagingRegistrationEligible } from './registration-eligibility';", "const isStagingRegistrationEligible = globalThis.__testEligibility;")
  .replace("import admins from './generated/admins.json';", "const admins = [{email:'lionaugust@icloud.com',enabled:true}];");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const worker = (await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))).default;

function harness() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('migrations/0001_auth.sql','utf8'));
  sqlite.exec(readFileSync('migrations/0003_events.sql','utf8'));
  sqlite.exec(readFileSync('migrations/0004_users_and_agreements.sql','utf8'));
  sqlite.exec(readFileSync('migrations/0005_event_signups.sql','utf8'));
  sqlite.exec('BEGIN;'+readFileSync('migrations/0006_unclaimed_users.sql','utf8')+'COMMIT;');
  const versionTerms=JSON.parse(readFileSync('src/generated/policy-versions.json','utf8')).terms.version, versionPrivacy=JSON.parse(readFileSync('src/generated/policy-versions.json','utf8')).privacy.version;
  // Event regressions retain an already-completed authorized administrator session.
  sqlite.prepare('INSERT INTO users(id,email,first_name,last_name,date_of_birth,email_verified_at,created_at,updated_at,terms_accepted_at,accepted_terms_version,accepted_privacy_version) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
    .run('11111111-1111-4111-8111-111111111111','lionaugust@icloud.com','Admin','Example','1990-01-01',1,1,1,1,versionTerms,versionPrivacy);
  const adapter = { prepare(sql) { const statement = sqlite.prepare(sql); return {
    bind(...args) { return {
      all: async () => ({ results: statement.all(...args) }),
      first: async () => statement.get(...args) || null,
      run: async () => ({ meta: { changes: Number(statement.run(...args).changes) } })
    }; }
  }; } };
  const req = (path, method='GET', body, cookie) => worker.fetch(new Request('https://servewith-beta.sffilamlions.org' + path,{
    method, headers:{ origin:'https://servewith-beta.sffilamlions.org', 'content-type':'application/json', ...(cookie ? {cookie}:{}) },
    ...(body ? {body:JSON.stringify(body)}:{})
  }),{
    AUTH_DB:adapter, AUTH_PEPPER:'test', REQUIRED_TERMS_VERSION:versionTerms, REQUIRED_PRIVACY_VERSION:versionPrivacy, ASSETS:{fetch:async()=>new Response('asset')}
  });
  const insert = (id,start,end,deleted=null) => sqlite.prepare(
    'INSERT INTO events (id,title,location,timezone,start_at,end_at,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(id,'Event '+id,'San Jose','America/Los_Angeles',start,end,1,1,deleted);
  return {sqlite,req,insert,adapter};
}

test('public events API handles empty lists, invalid view and methods',async()=>{
  const h=harness();
  try {
    const response=await h.req('/api/events');
    assert.equal(response.status,200);
    assert.deepEqual((await response.json()).events,[]);
    assert.equal((await h.req('/api/events?view=other')).status,400);
    assert.equal((await h.req('/api/events','POST')).status,405);
  }finally{h.sqlite.close();}
});

test('public events include in-progress, hide deleted, sort deterministically and switch at end instant',async()=>{
  const h=harness(), now=Date.now();
  try {
    h.insert('current',now-10000,now+10000);
    h.insert('future-b',now+1000,now+90000);
    h.insert('future-a',now+1000,now+90000);
    h.insert('past',now-20000,now-10000);
    h.insert('boundary',now-10000,now);
    h.insert('deleted',now+4000,now+90000,now);
    const upcoming=await (await h.req('/api/events')).json();
    const past=await (await h.req('/api/events?view=past')).json();
    assert.deepEqual(upcoming.events.map(e=>e.id),['current','future-a','future-b']);
    assert.deepEqual(past.events.map(e=>e.id),['boundary','past']);
    assert.equal(upcoming.events[0].version,1);
    assert.deepEqual(Object.keys(upcoming.events[0]).sort(),['capacity','end_at','id','location','signups_count','spots_available','start_at','timezone','title','version']);
  }finally{h.sqlite.close();}
});

test('database constraints reject invalid and inverted events',()=>{
  const h=harness();
  try{
    assert.throws(()=>h.insert('bad',1000,1000),/CHECK constraint/);
    assert.throws(()=>h.sqlite.prepare(
      'INSERT INTO events (id,title,location,timezone,start_at,end_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)'
    ).run('bad-title','   ','somewhere','UTC',100,200,1,1),/CHECK constraint/);
  }finally{h.sqlite.close();}
});

test('soft delete requires authentication, checks version and retains record',async()=>{
  const h=harness();
  try{
    const id='123e4567-e89b-42d3-a456-426614174000';
    const now=Date.now();
    h.insert(id,now+1000,now+5000);
    assert.equal((await h.req('/api/admin/events/'+id,'DELETE',{version:1})).status,401);
    const session='a'.repeat(64);
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('test:'+session))),b=>b.toString(16).padStart(2,'0')).join('');
    h.sqlite.prepare('INSERT INTO sessions(token_hash,email,expires_at,created_at) VALUES (?,?,?,?)')
      .run(hash,'lionaugust@icloud.com',now+100000,now);
    const cookie='__Host-sw_session='+session;
    const url='/api/admin/events/'+id;
    assert.equal((await h.req(url,'DELETE',{version:5},cookie)).status,409);
    assert.equal((await h.req(url,'DELETE',{version:1},cookie)).status,204);
    const event=h.sqlite.prepare('SELECT deleted_at,version FROM events WHERE id=?').get(id);
    assert.equal(event.version,2);
    assert.ok(event.deleted_at);
    assert.equal((await h.req(url,'DELETE',{version:1},cookie)).status,404);
    assert.deepEqual((await (await h.req('/api/events')).json()).events,[]);
  }finally{h.sqlite.close();}
});

test('admin event creation and edits validate Temporal, preserve versions, and reject stale updates',async()=>{
 const h=harness(); try {
   const now=Date.now(),session='b'.repeat(64);
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('test:'+session))),b=>b.toString(16).padStart(2,'0')).join('');
   h.sqlite.prepare('INSERT INTO sessions(token_hash,email,expires_at,created_at) VALUES (?,?,?,?)').run(hash,'lionaugust@icloud.com',now+600000,now);
   const cookie='__Host-sw_session='+session;
   const value={title:'  Cleanup  ',location:' Park ',timezone:'America/Los_Angeles',start:'2026-11-14T09:00',end:'2026-11-14T12:00'};
   assert.equal((await h.req('/api/admin/events','POST',value)).status,401);
   const created=await h.req('/api/admin/events','POST',value,cookie);
   assert.equal(created.status,201);
   const body=await created.json();
   assert.equal(body.event.title,'Cleanup');
   assert.equal(body.event.version,1);
   const id=body.event.id;
   const invalid=await h.req('/api/admin/events','POST',{...value,start:'2026-03-08T02:30'},cookie);
   assert.equal(invalid.status,422);
   assert.ok((await invalid.json()).fields.start);
   const ambiguous=await h.req('/api/admin/events','POST',{...value,start:'2026-11-01T01:30'},cookie);
   assert.equal(ambiguous.status,422);
   const edited=await h.req('/api/admin/events/'+id,'PUT',{...value,location:'New Park',version:1},cookie);
   assert.equal(edited.status,200);
   assert.equal((await edited.json()).event.version,2);
   assert.equal((await h.req('/api/admin/events/'+id,'PUT',{...value,version:1},cookie)).status,409);
   assert.equal((await h.req('/api/admin/events/'+id,'DELETE',{version:1},cookie)).status,409);
   assert.equal((await h.req('/api/admin/events/'+id,'DELETE',{version:2},cookie)).status,204);
 } finally {h.sqlite.close();}
});

test('event inputs accept overnight and multiple IANA zones, reject invalid fields and missing IDs',async()=>{
  const h=harness();
  try {
    const now=Date.now(),session='c'.repeat(64);
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('test:'+session))),b=>b.toString(16).padStart(2,'0')).join('');
    h.sqlite.prepare('INSERT INTO sessions(token_hash,email,expires_at,created_at) VALUES (?,?,?,?)').run(hash,'lionaugust@icloud.com',now+600000,now);
    const cookie='__Host-sw_session='+session;
    const event={title:'Overnight service',location:'Community Center',timezone:'America/New_York',start:'2026-11-14T23:00',end:'2026-11-15T01:00'};
    const created=await h.req('/api/admin/events','POST',event,cookie);
    assert.equal(created.status,201);
    const parsed=(await created.json()).event;
    assert.equal(parsed.end_at-parsed.start_at,2*60*60*1000);
    assert.equal(parsed.timezone,'America/New_York');
    const invalids=[
      {...event,title:'   '},
      {...event,location:'x'.repeat(501)},
      {...event,timezone:'Invalid/Timezone'},
      {...event,end:event.start},
      {...event,start:'2026-11-14 23:00'},
    ];
    for (const input of invalids) {
      const response=await h.req('/api/admin/events','POST',input,cookie);
      assert.equal(response.status,422);
      assert.ok(Object.keys((await response.json()).fields).length>0);
    }
    const missing='123e4567-e89b-42d3-a456-426614174001';
    assert.equal((await h.req('/api/admin/events/'+missing,'PUT',{...event,version:1},cookie)).status,404);
    assert.equal((await h.req('/api/admin/events/'+missing,'DELETE',{version:1},cookie)).status,404);
    assert.equal((await h.req('/api/admin/events/'+parsed.id,'PUT',{...event,version:0},cookie)).status,422);
  } finally { h.sqlite.close(); }
});

test('past events remain editable, DST overlaps are rejected, and bad requests preserve data', async () => {
  const h = harness();
  try {
    const now = Date.now(), session = 'd'.repeat(64);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('test:'+session))), b => b.toString(16).padStart(2,'0')).join('');
    h.sqlite.prepare('INSERT INTO sessions(token_hash,email,expires_at,created_at) VALUES (?,?,?,?)').run(hash,'lionaugust@icloud.com',now+600000,now);
    const cookie = '__Host-sw_session=' + session;
    const value = {title:'Past clean-up',location:'SF',timezone:'America/Los_Angeles',start:'2025-01-14T09:00',end:'2025-01-14T11:00'};
    const created = await h.req('/api/admin/events','POST',value,cookie);
    assert.equal(created.status,201);
    const event = (await created.json()).event;
    assert.equal((await h.req('/api/events?view=past')).status,200);
    const invalid = await h.req('/api/admin/events/'+event.id,'PUT',{...value,start:'2026-11-01T01:30',version:1},cookie);
    assert.equal(invalid.status,422);
    assert.ok((await invalid.json()).fields.start);
    assert.equal(h.sqlite.prepare('SELECT version FROM events WHERE id=?').get(event.id).version,1);
    const modified = await h.req('/api/admin/events/'+event.id,'PUT',{...value,title:'Updated past clean-up',version:1},cookie);
    assert.equal(modified.status,200);
    assert.equal((await modified.json()).event.version,2);
    assert.equal((await h.req('/api/admin/events/'+event.id,'DELETE',{version:2},cookie)).status,204);
    assert.equal(h.sqlite.prepare('SELECT version FROM events WHERE id=?').get(event.id).version,3);
    assert.equal((await h.req('/api/admin/events/'+event.id,'PUT',{...value,version:3},cookie)).status,404);
    assert.equal((await h.req('/api/admin/events/'+event.id,'DELETE',{version:3},cookie)).status,404);
  } finally { h.sqlite.close(); }
});

test('admin writes enforce CSRF origin even with a valid authenticated session',async()=>{
 const h=harness();
 try{
  const session='e'.repeat(64),now=Date.now();
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('test:'+session))),b=>b.toString(16).padStart(2,'0')).join('');
  h.sqlite.prepare('INSERT INTO sessions(token_hash,email,expires_at,created_at) VALUES (?,?,?,?)').run(hash,'lionaugust@icloud.com',now+600000,now);
  const event={title:'Service',location:'San Francisco',timezone:'America/Los_Angeles',start:'2026-11-14T09:00',end:'2026-11-14T11:00'};
  const response=await worker.fetch(new Request('https://servewith-beta.sffilamlions.org/api/admin/events',{
   method:'POST',headers:{origin:'https://malicious.example','content-type':'application/json',cookie:'__Host-sw_session='+session},body:JSON.stringify(event)
  }),{AUTH_DB:h.adapter,AUTH_PEPPER:'test',REQUIRED_TERMS_VERSION:JSON.parse(readFileSync('src/generated/policy-versions.json','utf8')).terms.version,REQUIRED_PRIVACY_VERSION:JSON.parse(readFileSync('src/generated/policy-versions.json','utf8')).privacy.version,ASSETS:{fetch:async()=>new Response('asset')}});
  assert.equal(response.status,400);
  assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM events').get().n,0);
 }finally{h.sqlite.close()}
});

test('Temporal rejects gaps and ambiguous overlaps in distinct time zones',async()=>{
 const Temporal=globalThis.__testTemporal;
 for(const [zone,gap,overlap] of [
  ['America/Los_Angeles','2026-03-08T02:30','2026-11-01T01:30'],
  ['America/New_York','2026-03-08T02:30','2026-11-01T01:30']
 ]){
  for(const timestamp of [gap,overlap]){
   assert.throws(()=>Temporal.PlainDateTime.from(timestamp).toZonedDateTime(zone,{disambiguation:'reject'}));
  }
  const summer=Temporal.PlainDateTime.from('2026-07-04T09:00').toZonedDateTime(zone,{disambiguation:'reject'});
  assert.equal(summer.timeZoneId,zone);
 }
});

test('OpenAPI-generated route table reaches real Worker event handlers with auth and origin parity', async () => {
  const {mkdtempSync,rmSync,readFileSync:read} = await import('node:fs');
  const {tmpdir} = await import('node:os');
  const {join} = await import('node:path');
  const {spawnSync} = await import('node:child_process');
  const folder=mkdtempSync(join(tmpdir(),'serve-with-real-worker-'));
  let routes;
  try {
    const output=join(folder,'server-contract.ts');
    const generated=spawnSync(process.execPath,['scripts/generate-server-contract.mjs','openapi/openapi.yaml',output],{encoding:'utf8'});
    assert.equal(generated.status,0,generated.stderr||generated.stdout);
    const js=ts.transpileModule(read(output,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
    routes=(await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))).operationRoutes;
  } finally {rmSync(folder,{recursive:true,force:true});}
  const dispatch=(request,env)=>{
    const url=new URL(request.url);
    const matched=routes.some(route=>route.method===request.method &&
      new RegExp('^'+route.path.replace(/\{[^}]+\}/g,'[^/]+')+'$').test(url.pathname));
    return matched ? worker.fetch(request,env) : new Response(null,{status:404});
  };
  const h=harness();
  try {
    const origin='https://servewith-beta.sffilamlions.org';
    const eventUrl=origin+'/api/events';
    const publicResponse=await dispatch(new Request(eventUrl),{AUTH_DB:h.adapter});
    assert.equal(publicResponse.status,200);
    assert.deepEqual((await publicResponse.json()).events,[]);
    const value={title:'Generated contract integration',location:'Park',timezone:'America/Los_Angeles',start:'2026-11-14T09:00',end:'2026-11-14T12:00'};
    const req=(headers)=>new Request(origin+'/api/admin/events',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(value)});
    const env={AUTH_DB:h.adapter,AUTH_PEPPER:'test',ASSETS:{fetch:async()=>new Response('asset')}};
    assert.equal((await dispatch(req({origin}),env)).status,401);
    const session='f'.repeat(64),now=Date.now();
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('test:'+session))),b=>b.toString(16).padStart(2,'0')).join('');
    h.sqlite.prepare('INSERT INTO sessions(token_hash,email,expires_at,created_at) VALUES (?,?,?,?)').run(digest,'lionaugust@icloud.com',now+600000,now);
    const cookie='__Host-sw_session='+session;
    assert.equal((await dispatch(req({origin:'https://attacker.example',cookie}),env)).status,400);
    assert.equal((await dispatch(req({origin,cookie,'sec-fetch-site':'cross-site'}),env)).status,400);
    const created=await dispatch(req({origin,cookie}),env);
    assert.equal(created.status,201);
    const event=(await created.json()).event;
    assert.equal(event.title,value.title);
    const detail=await dispatch(new Request(origin+'/api/events/'+event.id),env);
    assert.equal(detail.status,200);
    assert.equal((await detail.json()).event.id,event.id);
  } finally {h.sqlite.close();}
});

test('compatibility normalizer forwards legacy event-create bodies to real Worker without changing authorization', async () => {
  const {normalizeLegacyEventCreate}=await import('../scripts/normalize-openapi-spike.mjs');
  const h=harness();
  try {
    const origin='https://servewith-beta.sffilamlions.org',now=Date.now(),session='7'.repeat(64);
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('test:'+session))),b=>b.toString(16).padStart(2,'0')).join('');
    h.sqlite.prepare('INSERT INTO sessions(token_hash,email,expires_at,created_at) VALUES (?,?,?,?)')
      .run(hash,'lionaugust@icloud.com',now+600000,now);
    const value={title:'  Cleanup  ',location:' Park ',timezone:'America/Los_Angeles',start:'2026-11-14T09:00',end:'2026-11-14T12:00',unexpected:'ignored'};
    const original=structuredClone(value);
    const req=(body,headers={})=>new Request(origin+'/api/admin/events',{method:'POST',
      headers:{'content-type':'application/json',origin,cookie:'__Host-sw_session='+session,...headers},
      body:JSON.stringify(body)});
    const env={AUTH_DB:h.adapter,AUTH_PEPPER:'test',ASSETS:{fetch:async()=>new Response('asset')}};
    const normalized=normalizeLegacyEventCreate(value);
    assert.deepEqual(value,original,'normalizer does not mutate browser input');
    assert.deepEqual(Object.keys(normalized).sort(),['end','location','start','timezone','title']);
    const response=await worker.fetch(req(normalized),env);
    assert.equal(response.status,201);
    const event=(await response.json()).event;
    assert.equal(event.title,'Cleanup');
    assert.equal(event.location,'Park');
    assert.equal((await worker.fetch(req(normalized,{origin:'https://attacker.example'}),env)).status,400);
    assert.equal((await worker.fetch(req(normalized,{'sec-fetch-site':'cross-site'}),env)).status,400);
    assert.equal((await worker.fetch(req({...normalized,title:'  '}),env)).status,422);
    assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM events').get().n,1);
  } finally {h.sqlite.close();}
});

test('generated OpenAPI dispatcher delegates to actual Worker without bypassing CSRF or admin checks', async () => {
  const {spawnSync}=await import('node:child_process');
  const generated=spawnSync(process.execPath,['scripts/generate-openapi-operations.mjs'],{encoding:'utf8'});
  assert.equal(generated.status,0,generated.stderr||generated.stdout);
  const source=readFileSync('src/generated/openapi-operations.ts','utf8');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  const {operations,dispatchOperation}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  const h=harness();
  try {
    const origin='https://servewith-beta.sffilamlions.org';
    const env={AUTH_DB:h.adapter,AUTH_PEPPER:'test',ASSETS:{fetch:async()=>new Response('asset')}};
    const handlers=Object.fromEntries(operations.map(op=>[op.id,(request)=>worker.fetch(request,env)]));
    const send=(headers)=>dispatchOperation(new Request(origin+'/api/admin/events',{
      method:'POST',headers:{'content-type':'application/json',...headers},
      body:JSON.stringify({title:'Service',location:'Park',timezone:'America/Los_Angeles',start:'2026-11-14T09:00',end:'2026-11-14T12:00'})
    }),handlers);
    assert.equal((await dispatchOperation(new Request(origin+'/api/events'),handlers)).status,200);
    assert.equal((await send({origin})).status,401);
    const session='8'.repeat(64),now=Date.now();
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('test:'+session))),b=>b.toString(16).padStart(2,'0')).join('');
    h.sqlite.prepare('INSERT INTO sessions(token_hash,email,expires_at,created_at) VALUES (?,?,?,?)')
      .run(hash,'lionaugust@icloud.com',now+600000,now);
    const cookie='__Host-sw_session='+session;
    assert.equal((await send({origin:'https://attacker.example',cookie})).status,400);
    assert.equal((await send({origin,cookie,'sec-fetch-site':'cross-site'})).status,400);
    const created=await send({origin,cookie});
    assert.equal(created.status,201);
    assert.equal((await created.json()).event.title,'Service');
    assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM events').get().n,1);
  } finally {h.sqlite.close();}
});

test('self signup API enforces identity, capacity, withdrawal history and origin using real Worker',async()=>{
 const h=harness();
 try {
  const eventId='123e4567-e89b-42d3-a456-426614174987',now=Date.now();
  h.insert(eventId,now+300000,now+600000);
  h.sqlite.prepare('UPDATE events SET capacity=1 WHERE id=?').run(eventId);
  const root='/api/events/'+eventId+'/signups';
  assert.equal((await h.req(root,'POST',{})).status,401);
  const session='9'.repeat(64);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('test:'+session))),b=>b.toString(16).padStart(2,'0')).join('');
  h.sqlite.prepare('INSERT INTO sessions(token_hash,email,expires_at,created_at) VALUES(?,?,?,?)')
   .run(hash,'lionaugust@icloud.com',now+600000,now);
  const cookie='__Host-sw_session='+session;
  assert.equal((await h.req(root,'POST',{},cookie)).status,201);
  const rosterUrl='/api/events/'+eventId+'/participants';
  assert.equal((await h.req(rosterUrl)).status,401);
  const roster=(await (await h.req(rosterUrl,'GET',undefined,cookie)).json()).participants;
  assert.deepEqual(roster.map(x=>({...x})),[{name:'Admin Example'}]);
  assert.equal(JSON.stringify(roster).includes('@'),false);
  const publicEvent=(await (await h.req('/api/events/'+eventId)).json()).event;
  assert.equal(publicEvent.signups_count,1);
  assert.equal(publicEvent.spots_available,0);
  assert.equal(publicEvent.capacity,1);
  assert.equal(JSON.stringify(publicEvent).includes('lionaugust@icloud.com'),false);
  assert.equal((await h.req(root,'POST',{},cookie)).status,409);
  const own=await (await h.req(root,'GET',undefined,cookie)).json();
  assert.ok(own.signup.id);
  const history=await (await h.req('/api/me/signups','GET',undefined,cookie)).json();
  assert.equal(history.signups.length,1);
  assert.equal(history.signups[0].event_id,eventId);
  assert.equal((await h.req(root,'DELETE',{},cookie)).status,200);
  assert.equal((await h.req(rosterUrl,'GET',undefined,cookie)).status,403);
  assert.equal((await (await h.req(root,'GET',undefined,cookie)).json()).signup,null);
  assert.equal((await h.req(root,'POST',{},cookie)).status,201);
  assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM event_signups WHERE event_id=?').get(eventId).n,2);
  assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM event_signups WHERE event_id=? AND deleted_at IS NULL').get(eventId).n,1);
  h.sqlite.prepare('UPDATE events SET start_at=? WHERE id=?').run(Date.now()-1000,eventId);
  assert.equal((await h.req(root,'DELETE',{},cookie)).status,409);
  assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM event_signups WHERE event_id=? AND deleted_at IS NULL').get(eventId).n,1);
 }finally{h.sqlite.close();}
});

test('admin delegated signup allows explicit attendee selection and preserves history',async()=>{
 const h=harness();
 try{
  const eventId='123e4567-e89b-42d3-a456-426614174989', now=Date.now();
  h.insert(eventId,now+300000,now+600000);
  const targetId='22222222-2222-4222-8222-222222222222';
  h.sqlite.prepare('INSERT INTO users(id,email,first_name,last_name,created_at,updated_at,is_stub) VALUES(?,?,?,?,?,?,1)')
   .run(targetId,'attendee@example.org','Alex','Volunteer',1,1);
  const path='/api/admin/events/'+eventId+'/signups';
  assert.equal((await h.req(path,'GET')).status,401);
  const token='a'.repeat(64);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('test:'+token))),b=>b.toString(16).padStart(2,'0')).join('');
  h.sqlite.prepare('INSERT INTO sessions(token_hash,email,expires_at,created_at) VALUES(?,?,?,?)')
    .run(hash,'lionaugust@icloud.com',now+600000,now);
  const cookie='__Host-sw_session='+token;
  assert.equal((await h.req(path,'POST',{userId:targetId},cookie)).status,201);
  assert.equal((await h.req(path,'POST',{userId:targetId},cookie)).status,409);
  const roster=await (await h.req(path,'GET',undefined,cookie)).json();
  assert.equal(roster.signups.length,1);
  assert.equal(roster.signups[0].email,'attendee@example.org');
  assert.equal((await h.req(path,'DELETE',{userId:targetId},cookie)).status,200);
  assert.equal((await h.req(path,'POST',{userId:targetId},cookie)).status,201);
  assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM event_signups WHERE event_id=?').get(eventId).n,2);
  h.sqlite.prepare('UPDATE events SET start_at=? WHERE id=?').run(Date.now()-1,eventId);
  assert.equal((await h.req(path,'DELETE',{userId:targetId},cookie)).status,409);
 }finally{h.sqlite.close();}
});

test('usage endpoint hides provider credentials and never fabricates limits',async()=>{
 const h=harness();try{
  assert.equal((await h.req('/api/admin/usage')).status,401);
  const now=Date.now(),token='b'.repeat(64);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('test:'+token))),b=>b.toString(16).padStart(2,'0')).join('');
  h.sqlite.prepare('INSERT INTO sessions(token_hash,email,expires_at,created_at) VALUES(?,?,?,?)')
   .run(hash,'lionaugust@icloud.com',now+600000,now);
  const response=await h.req('/api/admin/usage','GET',undefined,'__Host-sw_session='+token);
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.providers.length,4);
  assert.ok(data.providers.every(p=>p.status==='unavailable'&&p.used===null&&p.limit===null&&p.remaining===null));
  assert.equal(JSON.stringify(data).includes('fake'),false);
 }finally{h.sqlite.close();}
});

test('admin creates email-optional unverified user without consent or login',async()=>{
 const h=harness();try{
  const path='/api/admin/users';
  assert.equal((await h.req(path,'POST',{firstName:'Alex',lastName:'Volunteer'})).status,401);
  const now=Date.now(),token='c'.repeat(64);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('test:'+token))),b=>b.toString(16).padStart(2,'0')).join('');
  h.sqlite.prepare('INSERT INTO sessions(token_hash,email,expires_at,created_at) VALUES(?,?,?,?)')
   .run(hash,'lionaugust@icloud.com',now+600000,now);
  const cookie='__Host-sw_session='+token;
  assert.equal((await h.req(path,'POST',{firstName:'',lastName:'Volunteer'},cookie)).status,422);
  const response=await h.req(path,'POST',{firstName:'Alex',lastName:'Volunteer'},cookie);
  assert.equal(response.status,201);
  const created=(await response.json()).user;
  assert.equal(created.email,null);assert.equal(created.isStub,true);
  const saved=h.sqlite.prepare('SELECT is_stub,email,email_verified_at,terms_accepted_at,accepted_terms_version,accepted_privacy_version FROM users WHERE id=?').get(created.id);
  assert.equal(saved.is_stub,1);assert.equal(saved.email,null);assert.equal(saved.email_verified_at,null);
  assert.equal(saved.terms_accepted_at,null);assert.equal(saved.accepted_terms_version,null);
  assert.equal(saved.accepted_privacy_version,null);
  assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM sessions WHERE user_id=?').get(created.id).n,0);
  assert.equal((await h.req(path,'POST',{firstName:'Other',lastName:'Person',email:'lionaugust@icloud.com'},cookie)).status,409);
 }finally{h.sqlite.close();}
});
