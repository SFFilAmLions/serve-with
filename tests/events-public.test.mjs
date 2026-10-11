import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

globalThis.__testTemporal = (await import('@js-temporal/polyfill')).Temporal;
const source = readFileSync('src/worker.ts','utf8')
  .replace("import { Temporal } from '@js-temporal/polyfill';", "const Temporal = globalThis.__testTemporal;")
  .replace("import admins from './generated/admins.json';", "const admins = [{email:'lionaugust@icloud.com',enabled:true}];");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const worker = (await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))).default;

function harness() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('migrations/0001_auth.sql','utf8'));
  sqlite.exec(readFileSync('migrations/0003_events.sql','utf8'));
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
    AUTH_DB:adapter, AUTH_PEPPER:'test', ASSETS:{fetch:async()=>new Response('asset')}
  });
  const insert = (id,start,end,deleted=null) => sqlite.prepare(
    'INSERT INTO events (id,title,location,timezone,start_at,end_at,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(id,'Event '+id,'San Jose','America/Los_Angeles',start,end,1,1,deleted);
  return {sqlite,req,insert};
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
    assert.deepEqual(Object.keys(upcoming.events[0]).sort(),['end_at','id','location','start_at','timezone','title','version']);
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
