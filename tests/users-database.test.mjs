import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

function db() {
  const d=new DatabaseSync(':memory:');
  d.exec('PRAGMA foreign_keys=ON');
  for(const path of ['migrations/0001_auth.sql','migrations/0002_auth_rate_limits.sql','migrations/0003_events.sql','migrations/0004_users_and_agreements.sql']) d.exec(readFileSync(path,'utf8'));
  return d;
}
const user=(d,id,email)=>d.prepare('INSERT INTO users(id,email,created_at,updated_at) VALUES(?,?,?,?)').run(id,email,1,1);
const uuid1='11111111-1111-4111-8111-111111111111';
const uuid2='22222222-2222-4222-8222-222222222222';
test('additive migration preserves legacy sessions and events',()=>{
  const d=db();
  d.prepare('INSERT INTO sessions(token_hash,email,expires_at,created_at) VALUES(?,?,?,?)').run('token','admin@example.org',100,1);
  assert.equal(d.prepare('SELECT user_id FROM sessions WHERE token_hash=?').get('token').user_id,null);
  assert.ok(d.prepare("SELECT name FROM sqlite_master WHERE name='events'").get());
  d.close();
});
test('email uniqueness and canonical casing reject duplicate identities',()=>{
  const d=db(); user(d,uuid1,'admin@example.org');
  assert.throws(()=>user(d,uuid2,'admin@example.org'));
  assert.throws(()=>user(d,uuid2,'ADMIN@example.org'));
  const insert=d.prepare('INSERT OR IGNORE INTO users(id,email,created_at,updated_at) VALUES(?,?,?,?)');
  assert.equal(insert.run(uuid2,'admin@example.org',2,2).changes,0);
  assert.equal(d.prepare('SELECT id FROM users WHERE email=?').get('admin@example.org').id,uuid1);
  assert.throws(()=>d.prepare('UPDATE users SET created_at=2 WHERE id=?').run(uuid1));
  d.close();
});
test('acceptance history is immutable and references existing users',()=>{
  const d=db(); user(d,uuid1,'admin@example.org');
  assert.throws(()=>d.prepare('INSERT INTO agreement_acceptances VALUES(?,?,?,?,?)').run('a',uuid2,'t1','p1',10));
  d.prepare('INSERT INTO agreement_acceptances VALUES(?,?,?,?,?)').run('a',uuid1,'t1','p1',10);
  assert.throws(()=>d.prepare("UPDATE agreement_acceptances SET terms_version='t2'").run());
  assert.throws(()=>d.prepare('DELETE FROM agreement_acceptances').run());
  assert.throws(()=>d.prepare("UPDATE users SET terms_accepted_at=3,accepted_terms_version='t1' WHERE id=?").run(uuid1));
  d.prepare("UPDATE users SET terms_accepted_at=3,accepted_terms_version='t1',accepted_privacy_version='p1' WHERE id=?").run(uuid1);
  d.close();
});
test('legacy DOB audit was originally reference-only',()=>{
  const d=db();user(d,uuid1,'admin@example.org');user(d,uuid2,'actor@example.org');
  d.prepare('INSERT INTO user_dob_audit(id,subject_user_id,actor_user_id,changed_at) VALUES(?,?,?,?)').run('audit',uuid1,uuid2,42);
  assert.deepEqual(d.prepare('PRAGMA table_info(user_dob_audit)').all().map(x=>x.name),['id','subject_user_id','actor_user_id','changed_at']);
  assert.throws(()=>d.prepare('INSERT INTO user_dob_audit(id,subject_user_id,actor_user_id,changed_at) VALUES(?,?,?,?)').run('other',uuid1,'missing',42));
  d.close();
});
