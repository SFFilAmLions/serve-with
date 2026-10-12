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
const source = readFileSync('src/worker.ts', 'utf8')
  .replace("import { operations, matchOperation, dispatchOperation, type WorkerHandlers } from './generated/openapi-operations';", "const {operations,matchOperation,dispatchOperation}=globalThis.__testOpenapiRegistry;")
  .replace("import { validateOperationBody } from './generated/openapi-validators';", "const {validateOperationBody}=globalThis.__testOpenapiValidators;")
  .replace("import policyMetadata from './generated/policy-versions.json';", "const policyMetadata = globalThis.__testPolicyMetadata;")
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
  sqlite.exec('BEGIN;'+readFileSync('migrations/0006_unclaimed_users.sql','utf8')+'COMMIT;');
  sqlite.exec('PRAGMA foreign_keys=ON');
  const adapter = { prepare(sql) { const stmt = sqlite.prepare(sql); return {
    bind(...params) { return { first: async () => stmt.get(...params) || null,
      all: async () => ({results:stmt.all(...params)}),
      run: async () => { const result = stmt.run(...params); return { meta: { changes: Number(result.changes) } }; }
    }; }
  }; }, batch: async (statements) => { sqlite.exec('BEGIN'); try { for(const statement of statements) await statement.run(); sqlite.exec('COMMIT'); } catch(e) {sqlite.exec('ROLLBACK');throw e;} } };
  return { sqlite, adapter };
}
function harness() {
  const { sqlite, adapter } = database();
  const env = { AUTH_DB: adapter, AUTH_PEPPER: 'test-secret-not-for-production',
    RESEND_API_KEY:'fake',AUTH_FROM_EMAIL:'login@notify.sffilamlions.org',
    REQUIRED_TERMS_VERSION:JSON.parse(readFileSync('src/generated/policy-versions.json','utf8')).terms.version,REQUIRED_PRIVACY_VERSION:JSON.parse(readFileSync('src/generated/policy-versions.json','utf8')).privacy.version,ENVIRONMENT:'staging',STAGING_REGISTRATION_EMAILS:'guest@example.org',
    ASSETS:{fetch: async () => new Response('asset')} };
  const sent = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (_url,options) => {
    const body = JSON.parse(options.body);
    sent.push(body);
    return new Response('{}',{status:200});
  };
  const req = (path,body,opts={}) => worker.fetch(new Request('https://servewith-beta.sffilamlions.org'+path,{
    method:opts.method || (body ? 'POST':'GET'), headers: {'origin':'https://servewith-beta.sffilamlions.org',
      'content-type':'application/json','CF-Connecting-IP':opts.ip || '192.0.2.1', ...(opts.cookie ? {cookie:opts.cookie}:{}) },
    ...(body ? {body:JSON.stringify(body)}:{}) }),env);
  const close = () => { globalThis.fetch=previousFetch;sqlite.close(); };
  return {req,sent,sqlite,env,close};
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
    const agreement=await h.req('/api/auth/agreements',{accepted:true,termsVersion:JSON.parse(readFileSync('src/generated/policy-versions.json','utf8')).terms.version,privacyVersion:JSON.parse(readFileSync('src/generated/policy-versions.json','utf8')).privacy.version},{cookie});
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
    assert.equal((await accept({accepted:true,termsVersion:JSON.parse(readFileSync('src/generated/policy-versions.json','utf8')).terms.version,privacyVersion:JSON.parse(readFileSync('src/generated/policy-versions.json','utf8')).privacy.version})).status,403);
    assert.equal((await h.req('/api/auth/profile',{firstName:' ',lastName:'Valid',dateOfBirth:'2026-02-30'},{cookie})).status,422);
    assert.equal((await h.req('/api/auth/profile',{firstName:'Alice',lastName:'Example',dateOfBirth:'1990-05-02'},{cookie})).status,200);
    assert.equal((await h.req('/api/auth/profile',{firstName:'New',lastName:'Value',dateOfBirth:'1980-03-02'},{cookie})).status,409);
    assert.equal((await accept({accepted:false,termsVersion:JSON.parse(readFileSync('src/generated/policy-versions.json','utf8')).terms.version,privacyVersion:JSON.parse(readFileSync('src/generated/policy-versions.json','utf8')).privacy.version})).status,409);
    assert.equal((await accept({accepted:true,termsVersion:'old',privacyVersion:JSON.parse(readFileSync('src/generated/policy-versions.json','utf8')).privacy.version})).status,409);
    assert.equal((await accept({accepted:true,termsVersion:JSON.parse(readFileSync('src/generated/policy-versions.json','utf8')).terms.version,privacyVersion:JSON.parse(readFileSync('src/generated/policy-versions.json','utf8')).privacy.version})).status,200);
    assert.equal(h.sqlite.prepare('SELECT count(*) n FROM agreement_acceptances').get().n,1);
    assert.equal((await h.req('/api/admin/dashboard',undefined,{cookie})).status,200);
  }finally{h.close();}
});

async function complete(h,email,name){
  await h.req('/api/auth/request',{email});
  const mail=h.sent.at(-1);
  const login=await h.req('/api/auth/verify',{email,code:credentials(mail).code});
  assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie');
  assert.equal((await h.req('/api/auth/profile',{firstName:name,lastName:'Example',dateOfBirth:'1990-01-01'},{cookie})).status,200);
  assert.equal((await h.req('/api/auth/agreements',{accepted:true,termsVersion:JSON.parse(readFileSync('src/generated/policy-versions.json','utf8')).terms.version,privacyVersion:JSON.parse(readFileSync('src/generated/policy-versions.json','utf8')).privacy.version},{cookie})).status,200);
  const me=await (await h.req('/api/auth/me',undefined,{cookie})).json();
  return {cookie,id:me.userId};
}
test('directory is admin-only and excludes DOB from every result',async()=>{
  const h=harness();try{
    const admin=await complete(h,'lionaugust@icloud.com','Lina');
    const guest=await complete(h,'guest@example.org','Guest');
    assert.equal((await h.req('/api/admin/users',undefined,{cookie:guest.cookie})).status,403);
    const response=await h.req('/api/admin/users?sort=last&letter=E',undefined,{cookie:admin.cookie});
    assert.equal(response.status,200);
    const users=(await response.json()).users;
    assert.equal(users.length,2);
    assert.ok(users.every(u=>!Object.hasOwn(u,'date_of_birth')));
    assert.equal((await h.req('/api/admin/users?sort=unknown&letter=ab',undefined,{cookie:admin.cookie})).status,400);
  }finally{h.close()}
});
test('canonical user reads are owner/admin only, owner cannot correct DOB or edit email',async()=>{
  const h=harness();try{
    const admin=await complete(h,'lionaugust@icloud.com','Admin');
    const guest=await complete(h,'guest@example.org','Guest');
    const outsider=await complete(h,'lsvalera58@gmail.com','Other');
    assert.equal((await h.req('/api/users/'+admin.id,undefined,{cookie:guest.cookie})).status,404);
    assert.equal((await h.req('/api/users/'+guest.id,undefined,{cookie:admin.cookie})).status,200);
    assert.equal((await h.req('/api/users/'+guest.id,undefined,{cookie:guest.cookie})).status,200);
    assert.equal((await h.req('/api/users/'+guest.id,{firstName:'Updated',lastName:'Example',dateOfBirth:'1980-01-01'},{cookie:guest.cookie,method:'PUT'})).status,403);
    assert.equal((await h.req('/api/users/'+guest.id,{firstName:'Updated',lastName:'Example',email:'stolen@example.org'},{cookie:guest.cookie,method:'PUT'})).status,200);
    assert.equal(h.sqlite.prepare('SELECT email FROM users WHERE id=?').get(guest.id).email,'guest@example.org');
    assert.equal((await h.req('/api/users/'+guest.id,{firstName:'Updated',lastName:'Example',dateOfBirth:'1980-01-01'},{cookie:admin.cookie,method:'PUT'})).status,200);
    const audit=h.sqlite.prepare('SELECT actor_user_id,subject_user_id,changed_at FROM user_dob_audit').all();
    assert.equal(audit.length,1);
    assert.equal(audit[0].actor_user_id,admin.id);
    assert.equal(audit[0].subject_user_id,guest.id);
    assert.equal((await h.req('/api/users/'+guest.id,{firstName:'Updated',lastName:'Example',dateOfBirth:'1980-01-01'},{cookie:admin.cookie,method:'PUT'})).status,200);
    assert.equal(h.sqlite.prepare('SELECT count(*) n FROM user_dob_audit').get().n,1);
    assert.equal((await h.req('/api/users/'+guest.id,undefined,{cookie:outsider.cookie})).status,200);
  }finally{h.close()}
});

test('minimum age rejects under-13 profile completion without storing supplied DOB', async () => {
  const h=harness();
  try {
    await h.req('/api/auth/request',{email:'lionaugust@icloud.com'});
    const {code}=credentials(h.sent.at(-1));
    const login=await h.req('/api/auth/verify',{email:'lionaugust@icloud.com',code});
    const cookie=login.headers.get('set-cookie');
    const today=new Date().toISOString().slice(0,10);
    const birth=(age)=>{const d=new Date(today+'T12:00:00Z');d.setUTCFullYear(d.getUTCFullYear()-age);return d.toISOString().slice(0,10)};
    const child=birth(12);
    assert.equal((await h.req('/api/auth/profile',{firstName:'Minor',lastName:'Test',dateOfBirth:child},{cookie})).status,422);
    assert.equal(h.sqlite.prepare('SELECT date_of_birth FROM users').get().date_of_birth,null);
    assert.equal((await h.req('/api/auth/profile',{firstName:'Allowed',lastName:'Test',dateOfBirth:birth(13)},{cookie})).status,200);
  } finally { h.close(); }
});

test('previously stored underage profile cannot regain privileged access', async () => {
  const h=harness();
  try {
    await h.req('/api/auth/request',{email:'lionaugust@icloud.com'});
    const {code}=credentials(h.sent.at(-1));
    const login=await h.req('/api/auth/verify',{email:'lionaugust@icloud.com',code});
    const cookie=login.headers.get('set-cookie');
    h.sqlite.prepare("UPDATE users SET first_name='Young',last_name='Member',date_of_birth='2020-01-01'").run();
    const me=await (await h.req('/api/auth/me',undefined,{cookie})).json();
    assert.equal(me.profileComplete,false);
    assert.equal(me.privileged,false);
    assert.equal((await h.req('/api/admin/dashboard',undefined,{cookie})).status,403);
  } finally { h.close(); }
});

test('Turnstile blocks email issuance unless Siteverify confirms hostname and action',async()=>{
 const h=harness();
 const originalFetch=globalThis.fetch;
 try {
  h.env.TURNSTILE_SITE_KEY='test-public-key';
  h.env.TURNSTILE_SECRET_KEY='test-private-key';
  let verification={success:true,hostname:'servewith-beta.sffilamlions.org',action:'request-login'};
  let calls=0;
  globalThis.fetch=async(url,options)=>{
   if(String(url).includes('/siteverify')) {
    calls++;
    assert.equal(new URLSearchParams(options.body).get('secret'),'test-private-key');
    return Response.json(verification);
   }
   h.sent.push(JSON.parse(options.body));
   return new Response('{}',{status:200});
  };
  const request=(turnstileToken)=>h.req('/api/auth/request',{email:'lionaugust@icloud.com',turnstileToken});
  assert.equal((await request(undefined)).status,403);
  assert.equal(h.sent.length,0);
  verification={success:false};
  assert.equal((await request('bad')).status,403);
  verification={success:true,hostname:'wrong.example.org',action:'request-login'};
  assert.equal((await request('wrong-host')).status,403);
  verification={success:true,hostname:'servewith-beta.sffilamlions.org',action:'wrong-action'};
  assert.equal((await request('wrong-action')).status,403);
  verification={success:true,hostname:'servewith-beta.sffilamlions.org',action:'request-login'};
  assert.equal((await request('valid')).status,200);
  assert.equal(h.sent.length,1);
  assert.ok(calls>=4);
  globalThis.fetch=async()=>{throw new Error('Siteverify unavailable')};
  assert.equal((await request('siteverify-outage')).status,403);
  assert.equal(h.sent.length,1);
 }finally{globalThis.fetch=originalFetch;h.close();}
});
