import {readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import YAML from 'yaml';

// Fails for removed paths/methods and removed successful statuses.
// More nuanced incompatible schema changes are review-gated; this is a
// conservative baseline, not a complete semantic OpenAPI diff engine.
const current=YAML.parse(readFileSync('openapi/openapi.yaml','utf8'));
const previous=spawnSync('git',['show','origin/main:openapi/openapi.yaml'],{encoding:'utf8'});
if(previous.status!==0){
 console.log('No baseline OpenAPI document on main; initial contract review required.');
 process.exit(0);
}
const baseline=YAML.parse(previous.stdout);
const violations=[];
for(const [path,item] of Object.entries(baseline.paths??{})){
 const next=current.paths?.[path];
 if(!next){violations.push('Removed path '+path);continue;}
 for(const [method,op] of Object.entries(item)){
  if(!['get','post','put','patch','delete','head','options','trace'].includes(method))continue;
  const replacement=next[method];
  if(!replacement){violations.push('Removed method '+method.toUpperCase()+' '+path);continue;}
  const previousSuccess=Object.keys(op.responses??{}).filter(code=>/^2\d\d$/.test(code));
  for(const status of previousSuccess)
   if(!replacement.responses?.[status])violations.push('Removed successful HTTP status '+status+' '+method+' '+path);
 }
}
if(violations.length){console.error(violations.join('\n'));process.exit(1);}
console.log('OpenAPI baseline compatibility gate passed (paths, methods and success codes)');
