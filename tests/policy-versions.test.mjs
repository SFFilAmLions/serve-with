import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const metadata=JSON.parse(readFileSync('src/generated/policy-versions.json','utf8'));
for(const [kind,path] of Object.entries({terms:'policies/terms/approved-draft.md',privacy:'policies/privacy/approved-draft.md'})){
 test(kind+' policy revision derives from last change to its own file',()=>{
  const commit=execFileSync('git',['log','-1','--format=%H','HEAD','--',path],{encoding:'utf8'}).trim();
  const date=execFileSync('git',['log','-1','--format=%cI','HEAD','--',path],{encoding:'utf8'}).trim();
  assert.deepEqual(metadata[kind],{version:date+'@'+commit.slice(0,12),modifiedAt:date,commit});
  assert.notEqual(metadata[kind].version,JSON.parse(readFileSync('package.json','utf8')).version);
 });
}
test('no app release version is used as policy acceptance identity',()=>{
 const code=readFileSync('src/worker.ts','utf8');
 assert.match(code,/policyMetadata\.terms\.version/);
 assert.match(code,/policyMetadata\.privacy\.version/);
 assert.doesNotMatch(code,/packageJson\.version/);
});
