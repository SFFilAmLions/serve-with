import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

function db() {
  const database = new DatabaseSync(':memory:');
  database.exec(readFileSync('migrations/0001_auth.sql','utf8'));
  database.exec(readFileSync('migrations/0002_auth_rate_limits.sql','utf8'));
  return database;
}

test('challenge is single use, and cannot be reused by another concurrent verifier', () => {
  const d = db(), now = Date.now();
  d.prepare('INSERT INTO login_challenges (id,email,code_hash,link_hash,expires_at,created_at) VALUES (?,?,?,?,?,?)')
    .run('challenge', 'admin@example.com','codehash','linkhash',now + 600000,now);
  const stmt = d.prepare('UPDATE login_challenges SET consumed_at=? WHERE id=? AND consumed_at IS NULL');
  assert.equal(stmt.run(now,'challenge').changes,1);
  assert.equal(stmt.run(now,'challenge').changes,0);
  d.close();
});

test('expired challenges are rejected and rate buckets cap attempts atomically', () => {
  const d = db(), now = Date.now();
  d.prepare('INSERT INTO login_challenges (id,email,code_hash,link_hash,expires_at,created_at) VALUES (?,?,?,?,?,?)')
    .run('expired','admin@example.com','hash','link',now-1,now-600001);
  assert.equal(d.prepare('SELECT id FROM login_challenges WHERE email=? AND expires_at>?').get('admin@example.com',now),undefined);
  const upsert = d.prepare('INSERT INTO auth_rate_limits(key,window,count) VALUES (?,?,1) ON CONFLICT(key,window) DO UPDATE SET count=count+1 WHERE count < ?');
  for(let i=0;i<3;i++) assert.equal(upsert.run('hashed-id',123,3).changes,1);
  assert.equal(upsert.run('hashed-id',123,3).changes,0);
  assert.equal(upsert.run('hashed-id',124,3).changes,1);
  assert.equal(d.prepare('SELECT count FROM auth_rate_limits WHERE key=? AND window=?').get('hashed-id',123).count,3);
  d.close();
});
