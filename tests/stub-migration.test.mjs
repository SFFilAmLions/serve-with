import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

const legacyId='11111111-1111-4111-8111-111111111111';
const stubId='22222222-2222-4222-8222-222222222222';
test('additive nullable-email stubs preserve existing identity foreign keys and history',()=>{
 const d=new DatabaseSync(':memory:');try{
  d.exec('PRAGMA foreign_keys=ON');
  for(const name of ['0001_auth','0002_auth_rate_limits','0003_events','0004_users_and_agreements','0005_event_signups'])
   d.exec(readFileSync('migrations/'+name+'.sql','utf8'));
  d.prepare('INSERT INTO users(id,email,first_name,last_name,created_at,updated_at) VALUES(?,?,?,?,?,?)')
   .run(legacyId,'registered@example.org','Old','User',1,1);
  d.prepare('INSERT INTO sessions(token_hash,email,user_id,expires_at,created_at) VALUES(?,?,?,?,?)')
   .run('hashed','registered@example.org',legacyId,10000,1);
  d.prepare('INSERT INTO agreement_acceptances(id,user_id,terms_version,privacy_version,accepted_at) VALUES(?,?,?,?,?)')
   .run('acceptance',legacyId,'terms-v1','privacy-v1',10);
  d.prepare('INSERT INTO events(id,title,location,timezone,start_at,end_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
   .run('event','Community','Park','UTC',1000,2000,1,1);
  d.prepare('INSERT INTO event_signups(id,event_id,user_id,created_at) VALUES(?,?,?,?)')
   .run('signup','event',legacyId,20);
  d.prepare('INSERT INTO user_dob_audit(id,subject_user_id,actor_user_id,changed_at) VALUES(?,?,?,?)')
   .run('audit',legacyId,legacyId,30);
  d.exec('BEGIN;'+readFileSync('migrations/0006_unclaimed_users.sql','utf8')+'COMMIT;');
  assert.deepEqual(d.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.equal(d.prepare('SELECT email FROM users WHERE id=?').get(legacyId).email,'registered@example.org');
  assert.equal(d.prepare('SELECT user_id FROM sessions').get().user_id,legacyId);
  assert.equal(d.prepare('SELECT user_id FROM agreement_acceptances').get().user_id,legacyId);
  assert.equal(d.prepare('SELECT user_id FROM event_signups').get().user_id,legacyId);
  assert.equal(d.prepare('SELECT subject_user_id FROM user_dob_audit').get().subject_user_id,legacyId);
  d.prepare('INSERT INTO participation_identities(id) VALUES(?)').run(stubId);
  d.prepare('INSERT INTO user_stubs(id,email,first_name,last_name,created_at,updated_at) VALUES(?,?,?,?,?,?)')
   .run(stubId,null,'Alex','Volunteer',50,50);
  assert.equal(d.prepare('SELECT email FROM user_stubs WHERE id=?').get(stubId).email,null);
  assert.equal(d.prepare('SELECT COUNT(*) n FROM users WHERE id=?').get(stubId).n,0);
  assert.deepEqual(d.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.throws(()=>d.prepare('UPDATE users SET created_at=2 WHERE id=?').run(legacyId),/immutable/);
 }finally{d.close();}
});
