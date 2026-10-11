import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source=readFileSync('src/registration-eligibility.ts','utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {isStagingRegistrationEligible:eligible}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const admins=new Set(['enabled@example.org']);
test('staging allowlist is independent of administrator role and production is closed',()=>{
  const env={ENVIRONMENT:'staging',STAGING_REGISTRATION_EMAILS:' invited@example.org; other@example.org '};
  assert.equal(eligible(' Invited@Example.org ',env,admins),true);
  assert.equal(eligible('enabled@example.org',env,admins),true);
  assert.equal(eligible('blocked@example.org',env,admins),false);
  assert.equal(eligible('invited@example.org',{...env,ENVIRONMENT:'production'},admins),false);
  assert.equal(eligible('enabled@example.org',{...env,ENVIRONMENT:'production'},admins),false);
  assert.equal(eligible('invited@example.org',{ENVIRONMENT:'staging'},admins),false);
});
test('private staging email list does not appear in client sources or generated admin artifact',()=>{
  for(const p of ['src/main.tsx','src/generated/admins.json','scripts/generate-admins.mjs']) {
    assert.equal(readFileSync(p,'utf8').includes('STAGING_REGISTRATION_EMAILS'),false);
  }
});
