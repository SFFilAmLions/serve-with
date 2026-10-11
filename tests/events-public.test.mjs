import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

const source = readFileSync('src/worker.ts','utf8')
  .replace("import admins from './generated/admins.json';", "const admins = [];");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const worker = (await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))).default;

function harness() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('migrations/0003_events.sql','utf8'));
  const adapter = { prepare(sql) { const statement = sqlite.prepare(sql); return {
    bind(...args) { return {
      all: async () => ({ results: statement.all(...args) }),
      first: async () => statement.get(...args) || null,
      run: async () => ({ meta: { changes: Number(statement.run(...args).changes) } })
    }; }
  }; } };
  const req = (path, method='GET') => worker.fetch(new Request('https://servewith-beta.sffilamlions.org' + path,{method}),{
    AUTH_DB:adapter,ASSETS:{fetch:async()=>new Response('asset')}
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
