import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const a='11111111-1111-4111-8111-111111111111', b='22222222-2222-4222-8222-222222222222';
function setup(){
 const d=new DatabaseSync(':memory:');d.exec('PRAGMA foreign_keys=ON');
 for(const m of ['0001_auth','0002_auth_rate_limits','0003_events','0004_users_and_agreements','0005_event_signups'])
  d.exec(readFileSync('migrations/'+m+'.sql','utf8'));
 for(const [id,email] of [[a,'a@example.org'],[b,'b@example.org']])
  d.prepare('INSERT INTO users(id,email,created_at,updated_at) VALUES(?,?,?,?)').run(id,email,1,1);
 d.prepare('INSERT INTO events(id,title,location,timezone,start_at,end_at,created_at,updated_at,capacity) VALUES(?,?,?,?,?,?,?,?,?)')
  .run('e','Service','Park','UTC',1000,2000,1,1,1);
 return d;
}
function add(d,id,user){return d.prepare('INSERT INTO event_signups(id,event_id,user_id,created_at) VALUES(?,?,?,?)').run(id,'e',user,100);}
test('enforces at-capacity signups atomically in INSERT trigger',()=>{
 const d=setup();try{
  add(d,'s1',a);
  assert.throws(()=>add(d,'s2',b),/Event full/);
  assert.equal(d.prepare('SELECT count(*) n FROM event_signups WHERE deleted_at IS NULL').get().n,1);
  assert.throws(()=>add(d,'s3',a),/UNIQUE constraint|Event full/);
 }finally{d.close()}
});
test('withdrawal frees capacity and rejoining creates a distinct historical row',()=>{
 const d=setup();try{
  add(d,'s1',a);
  d.prepare('UPDATE event_signups SET deleted_at=? WHERE id=? AND deleted_at IS NULL').run(101,'s1');
  add(d,'s2',b);
  assert.throws(()=>add(d,'s3',a),/Event full/);
  d.prepare('UPDATE event_signups SET deleted_at=102 WHERE id=?').run('s2');
  add(d,'s3',a);
  const rows=d.prepare('SELECT id,deleted_at FROM event_signups WHERE user_id=? ORDER BY created_at,id').all(a);
  assert.deepEqual(rows.map(row=>({...row})),[{id:'s1',deleted_at:101},{id:'s3',deleted_at:null}]);
  assert.throws(()=>add(d,'s4',a),/UNIQUE constraint|Event full/);
 }finally{d.close()}
});
test('unlimited and zero-capacity events, below-roster edits, FK, deleted event',()=>{
 const d=setup();try{
  d.prepare('UPDATE events SET capacity=NULL WHERE id=?').run('e');
  add(d,'s1',a);add(d,'s2',b);
  assert.throws(()=>d.prepare('UPDATE events SET capacity=1 WHERE id=?').run('e'),/Capacity below active signups/);
  d.prepare('UPDATE events SET capacity=2 WHERE id=?').run('e');
  assert.throws(()=>d.prepare('UPDATE events SET capacity=-1 WHERE id=?').run('e'),/CHECK constraint|Capacity below active signups/);
  d.prepare('UPDATE events SET capacity=NULL WHERE id=?').run('e');
  assert.throws(()=>d.prepare('INSERT INTO event_signups(id,event_id,user_id,created_at) VALUES(?,?,?,?)').run('bad','e','unknown',50),/FOREIGN KEY/);
  d.prepare('UPDATE event_signups SET deleted_at=101 WHERE event_id=?').run('e');
  d.prepare('UPDATE events SET capacity=0 WHERE id=?').run('e');
  assert.throws(()=>add(d,'s3',a),/Event full/);
  d.prepare('UPDATE events SET deleted_at=100 WHERE id=?').run('e');
  assert.throws(()=>add(d,'s4',a),/Event unavailable/);
 }finally{d.close()}
});
