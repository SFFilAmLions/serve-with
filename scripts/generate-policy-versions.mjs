import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
// Policy IDs change only when the corresponding source file changes in Git.
// Build runners must check out full history, including unchanged policies.
const files={terms:'policies/terms/approved-draft.md',privacy:'policies/privacy/approved-draft.md'};
const versions={};
for(const [kind,path] of Object.entries(files)){
  if(!readFileSync(path,'utf8').trim())throw Error('Empty policy '+path);
  const sha=execFileSync('git',['log','-1','--format=%H','HEAD','--',path],{encoding:'utf8'}).trim();
  const date=execFileSync('git',['log','-1','--format=%cI','HEAD','--',path],{encoding:'utf8'}).trim();
  if(!/^[a-f0-9]{40}$/.test(sha)||!/^\d{4}-\d\d-\d\dT/.test(date))throw Error('Missing policy Git history: '+path);
  versions[kind]={version:date+'@'+sha.slice(0,12),modifiedAt:date,commit:sha};
}
mkdirSync('src/generated',{recursive:true});
writeFileSync('src/generated/policy-versions.json',JSON.stringify(versions,null,2)+'\n');
