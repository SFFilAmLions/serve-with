import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

globalThis.__testTemporal = (await import('@js-temporal/polyfill')).Temporal;
globalThis.__testEligibility = (await import('data:text/javascript;base64,' + Buffer.from(
  ts.transpileModule(readFileSync('src/registration-eligibility.ts','utf8'),
    {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
).toString('base64'))).isStagingRegistrationEligible;

const source = readFileSync('src/worker.ts', 'utf8')
  .replace("import { Temporal } from '@js-temporal/polyfill';", "const Temporal = globalThis.__testTemporal;")
  .replace("import { isStagingRegistrationEligible } from './registration-eligibility';", "const isStagingRegistrationEligible = globalThis.__testEligibility;")
  .replace("import admins from './generated/admins.json';", "const admins = [{email:'lionaugust@icloud.com',enabled:true},{email:'lsvalera58@gmail.com',enabled:true}];");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const worker = (await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))).default;
function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('migrations/0001_auth.sql','utf8'));
  sqlite.exec(readFileSync('migrations/0002_auth_rate_limits.sql','utf8'));
  sqlite.exec(readFileSync('migrations/0004_users_and_agreements.sql','utf8'));
  sqlite.exec('PRAGMA foreign_keys=ON');
  const adapter = { prepare(sql) { const stmt = sqlite.prepare(sql); return {
    bind(...params) { return { first: async () => stmt.get(...params) || null,
      run: async () => { const result = stmt.run(...params); return { meta: { changes: Number(result.changes) } }; }
    }; }
  }; }, batch: async (statements) => { sqlite.exec('BEGIN'); try { for(const statement of statements) await statement.run(); sqlite.exec('COMMIT'); } catch(e) {sqlite.exec('ROLLBACK');throw e;} } };
  return { sqlite, adapter };
}
function harness() {
  const { sqlite, adapter } = database();
  const env = { AUTH_DB: adapter, AUTH_PEPPER: 'test-secret-not-for-production',
    RESEND_API_KEY:'fake',AUTH_FROM_EMAIL:'login@notify.sffilamlions.org',
    REQUIRED_TERMS_VERSION:'test-terms',REQUIRED_PRIVACY_VERSION:'test-privacy',ENVIRONMENT:'staging',STAGING_REGISTRATION_EMAILS:'guest@example.org',
    ASSETS:{fetch: async () => new Response('asset')} };
  const sent = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (_url,options) => {
    const body = JSON.parse(options.body);
    sent.push(body);
    return new Response('{}',{status:200});
  };
  const req = (path,body,opts={}) => worker.fetch(new Request('https://servewith-beta.sffilamlions.org'+path,{
    method:body ? 'POST':'GET', headers: {'origin':'https://servewith-beta.sffilamlions.org',
      'content-type':'application/json','CF-Connecting-IP':opts.ip || '192.0.2.1', ...(opts.cookie ? {cookie:opts.cookie}:{}) },
    ...(body ? {body:JSON.stringify(body)}:{}) }),env);
  const close = () => { globalThis.fetch=previousFetch;sqlite.close(); };
  return {req,sent,sqlite,close};
}
function credentials(mail) {
  const code = mail.text.match(/one-time code is (\d{8})/)[1];
  const token = new URL(mail.text.match(/https:\/\/[^\s]+/)[0]).searchParams.get('magic');
  return {code,token};
}
test('OTP signs in, creates secure session, protects dashboard and revokes on logout', async () => {
  const h = harness();
  try {
    assert.equal((await h.req('/api/admin/dashboard')).status,401);
    assert.equal((await h.req('/api/auth/request',{email:'LionAugust@icloud.com'})).status,200);
    assert.equal(h.sent.length,1);
    const {code} = credentials(h.sent[0]);
    const login = await h.req('/api/auth/verify',{email:'lionaugust@icloud.com',code});
    assert.equal(login.status,200);
    const cookie = login.headers.get('set-cookie');
    assert.match(cookie,/__Host-sw_session=.*HttpOnly; Secure; SameSite=Strict/);
    assert.equal((await h.req('/api/admin/dashboard',undefined,{cookie})).status,403);
    const profile=await h.req('/api/auth/profile',{firstName:'Example',lastName:'Admin',dateOfBirth:'1990-01-01'},{cookie});
    assert.equal(profile.status,200);
    assert.equal((await h.req('/api/admin/dashboard',undefined,{cookie})).status,403);
    const agreement=await h.req('/api/auth/agreements',{accepted:true,termsVersion:'test-terms',privacyVersion:'test-privacy'},{cookie});
    assert.equal(agreement.status,200);
    assert.equal((await h.req('/api/admin/dashboard',undefined,{cookie})).status,200);
    const me=await (await h.req('/api/auth/me',undefined,{cookie})).json();
    assert.equal(me.privileged,true);
    assert.equal(me.profileComplete,true);
    assert.equal(me.agreementCurrent,true);
    assert.equal((await h.req('/api/auth/verify',{email:'lionaugust@icloud.com',code})).status,400);
    assert.equal((await h.req('/api/auth/logout',{}, {cookie})).status,200);
    assert.equal((await h.req('/api/admin/dashboard',undefined,{cookie})).status,401);
  } finally {h.close();}
});
test('magic link requires POST and is single-use, even after OTP is consumed',async () => {
  const h=harness();
  try {
    await h.req('/api/auth/request',{email:'LSValera58@gmail.com'});
    const {token}=credentials(h.sent[0]);
    assert.equal((await h.req('/api/auth/magic')).status,400);
    assert.equal((await h.req('/api/auth/magic',{token})).status,200);
    assert.equal((await h.req('/api/auth/magic',{email:'lsvalera58@gmail.com',token})).status,400);
  }finally{h.close();}
});
test('unauthorized accounts get indistinguishable response and no email',async () => {
  const h=harness();
  try {
    const result=await h.req('/api/auth/request',{email:'notadmin@example.com'});
    assert.equal(result.status,200);
    assert.equal(h.sent.length,0);
    assert.equal((await h.req('/api/auth/magic',{token:'a'.repeat(64)})).status,400);
  }finally{h.close();}
});
test('expired token fails; repeated incorrect guesses exhaust challenge',async () => {
  const h=harness();
  try {
    await h.req('/api/auth/request',{email:'lionaugust@icloud.com'});
    const {code,token}=credentials(h.sent[0]);
    h.sqlite.prepare('UPDATE login_challenges SET expires_at=0').run();
    assert.equal((await h.req('/api/auth/verify',{email:'lionaugust@icloud.com',code})).status,400);
    await h.req('/api/auth/request',{email:'lionaugust@icloud.com'});
    const fresh=credentials(h.sent.at(-1));
    for(let i=0;i<5;i++) assert.equal((await h.req('/api/auth/verify',{email:'lionaugust@icloud.com',code:'00000000'})).status,400);
    assert.equal((await h.req('/api/auth/magic',{token:fresh.token})).status,400);
    assert.equal((await h.req('/api/auth/magic',{token})).status,400);
  }finally{h.close();}
});
test('per-IP and per-account throttling prevents email floods',async () => {
  const h=harness();
  try {
    for(let i=0;i<5;i++) await h.req('/api/auth/request',{email:'lionaugust@icloud.com'});
    assert.equal(h.sent.length,3);
    for(let i=0;i<20;i++) await h.req('/api/auth/request',{email:'lsvalera58@gmail.com'});
    assert.ok(h.sent.length<=6);
  }finally{h.close();}
});

test('expired sessions lose admin access',async () => {
  const h=harness();
  try {
    await h.req('/api/auth/request',{email:'lionaugust@icloud.com'});
    const {code}=credentials(h.sent[0]);
    const response=await h.req('/api/auth/verify',{email:'lionaugust@icloud.com',code});
    const cookie=response.headers.get('set-cookie');
    assert.equal((await h.req('/api/admin/dashboard',undefined,{cookie})).status,403);
    h.sqlite.prepare('UPDATE sessions SET expires_at=0').run();
    assert.equal((await h.req('/api/admin/dashboard',undefined,{cookie})).status,401);
  } finally {h.close();}
});
test('cross-origin POST is rejected without sending an email',async () => {
  const h=harness();
  try {
    const response=await worker.fetch(new Request('https://servewith-beta.sffilamlions.org/api/auth/request',{
      method:'POST',headers:{'origin':'https://attacker.example','content-type':'application/json'},
      body:JSON.stringify({email:'lionaugust@icloud.com'})
    }),{
      AUTH_DB:{prepare:()=>{throw Error('Database should not be touched');}},
      AUTH_PEPPER:'pepper',RESEND_API_KEY:'test',AUTH_FROM_EMAIL:'login@notify.sffilamlions.org',
      ASSETS:{fetch:async()=>new Response('asset')}
    });
    assert.equal(response.status,400);
    assert.equal(h.sent.length,0);
  }finally{h.close();}
});

test('verified login resolves stable user ID, while a legacy email session upgrades without logout', async () => {
  const h=harness();
  try {
    await h.req('/api/auth/request',{email:'lionaugust@icloud.com'});
    const {code}=credentials(h.sent[0]);
    const login=await h.req('/api/auth/verify',{email:'lionaugust@icloud.com',code});
    const cookie=login.headers.get('set-cookie');
    const first=h.sqlite.prepare('SELECT user_id,email FROM sessions').get();
    assert.ok(first.user_id);
    assert.equal(first.email,'lionaugust@icloud.com');
    h.sqlite.prepare('UPDATE sessions SET user_id=NULL').run();
    assert.equal((await h.req('/api/admin/dashboard',undefined,{cookie})).status,403);
    assert.equal(h.sqlite.prepare('SELECT user_id FROM sessions').get().user_id,first.user_id);
    assert.equal((await h.req('/api/admin/dashboard',undefined,{cookie})).status,403);
    assert.equal(h.sqlite.prepare('SELECT count(*) n FROM users').get().n,1);
  } finally { h.close(); }
});

test('staging invitation can verify, but is never authorized as administrator',async()=>{
  const h=harness();try{
    assert.equal((await h.req('/api/auth/request',{email:' Guest@Example.org '})).status,200);
    assert.equal(h.sent.length,1);
    const {code}=credentials(h.sent[0]);
    const login=await h.req('/api/auth/verify',{email:'guest@example.org',code});
    assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie');
    assert.equal((await h.req('/api/admin/dashboard',undefined,{cookie})).status,403);
    assert.equal((await (await h.req('/api/auth/me',undefined,{cookie})).json()).administratorEligible,false);
  }finally{h.close();}
});
test('agreement is rejected without profile and rejects mismatched or unchecked versions',async()=>{
  const h=harness();try{
    await h.req('/api/auth/request',{email:'lionaugust@icloud.com'});
    const login=await h.req('/api/auth/verify',{email:'lionaugust@icloud.com',code:credentials(h.sent[0]).code});
    const cookie=login.headers.get('set-cookie');
    const accept=(body)=>h.req('/api/auth/agreements',body,{cookie});
    assert.equal((await accept({accepted:true,termsVersion:'test-terms',privacyVersion:'test-privacy'})).status,403);
    assert.equal((await h.req('/api/auth/profile',{firstName:' ',lastName:'Valid',dateOfBirth:'2026-02-30'},{cookie})).status,422);
    assert.equal((await h.req('/api/auth/profile',{firstName:'Alice',lastName:'Example',dateOfBirth:'1990-05-02'},{cookie})).status,200);
    assert.equal((await h.req('/api/auth/profile',{firstName:'New',lastName:'Value',dateOfBirth:'1980-03-02'},{cookie})).status,409);
    assert.equal((await accept({accepted:false,termsVersion:'test-terms',privacyVersion:'test-privacy'})).status,409);
    assert.equal((await accept({accepted:true,termsVersion:'old',privacyVersion:'test-privacy'})).status,409);
    assert.equal((await accept({accepted:true,termsVersion:'test-terms',privacyVersion:'test-privacy'})).status,200);
    assert.equal(h.sqlite.prepare('SELECT count(*) n FROM agreement_acceptances').get().n,1);
    assert.equal((await h.req('/api/admin/dashboard',undefined,{cookie})).status,200);
  }finally{h.close();}
});
