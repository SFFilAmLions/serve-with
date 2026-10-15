import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import YAML from 'yaml';

// Baseline-compatible changes only. This conservative gate catches common
// breaking HTTP and JSON schema changes; human OpenAPI review is still required.
const args=process.argv.slice(2);
const option=(name)=>{const i=args.indexOf(name);return i<0?null:args[i+1]};
const current=YAML.parse(readFileSync(option('--current')||'openapi/openapi.yaml','utf8'));
const baselinePath=option('--baseline');
const previous=baselinePath?{status:0,stdout:readFileSync(baselinePath,'utf8')}
  :spawnSync('git',['show','origin/main:openapi/openapi.yaml'],{encoding:'utf8'});
if(previous.status!==0){
 console.log('No baseline OpenAPI document on main; initial contract review required.');
 process.exit(0);
}
const baseline=YAML.parse(previous.stdout);
const violations=[];
const methods=new Set(['get','post','put','patch','delete','head','options','trace']);
function deref(document,schema){
 let value=schema;
 for(let i=0;i<8&&value?.$ref;i++){
  if(!value.$ref.startsWith('#/'))return null;
  value=value.$ref.slice(2).split('/').reduce((obj,key)=>obj?.[key],document);
 }
 return value??null;
}
function shapeType(schema){
 if(!schema)return null;
 return (Array.isArray(schema.type)?schema.type:[schema.type]).filter(Boolean).sort();
}
function compareFields(previousSchema,currentSchema,context,kind){
 const before=deref(baseline,previousSchema),after=deref(current,currentSchema);
 if(!before||!after)return;
 const oldRequired=new Set(before.required||[]);
 const newRequired=new Set(after.required||[]);
 if(kind==='response'){
  for(const key of oldRequired)if(!newRequired.has(key))violations.push('Response removed required field '+key+' at '+context);
  for(const [key,field] of Object.entries(before.properties||{})){
   if(!Object.hasOwn(after.properties||{},key)){violations.push('Response removed property '+key+' at '+context);continue}
   const oldType=shapeType(deref(baseline,field)),newType=shapeType(deref(current,after.properties[key]));
   if(oldType?.length&&newType?.length&&oldType.join('|')!==newType.join('|'))violations.push('Response changed type of '+key+' at '+context);
  }
 }else{
  for(const key of newRequired)if(!oldRequired.has(key))violations.push('Request added required field '+key+' at '+context);
  for(const [key,oldField] of Object.entries(before.properties||{})){
   const newField=after.properties?.[key];
   if(!newField)continue;
   const oldType=shapeType(deref(baseline,oldField)),newType=shapeType(deref(current,newField));
   if(oldType?.length&&newType?.length&&!oldType.every(t=>newType.includes(t)))violations.push('Request narrowed type of '+key+' at '+context);
  }
 }
}
for(const [path,item] of Object.entries(baseline.paths??{})){
 const next=current.paths?.[path];
 if(!next){violations.push('Removed path '+path);continue}
 for(const [method,op] of Object.entries(item)){
  if(!methods.has(method))continue;
  const replacement=next[method],where=method.toUpperCase()+' '+path;
  if(!replacement){violations.push('Removed method '+where);continue}
  if(op.operationId!==replacement.operationId)violations.push('Changed operationId '+where);
  if((op.security||[]).length&&!(replacement.security||[]).length)violations.push('Removed operation security '+where);
  const oldBody=op.requestBody?.content?.['application/json']?.schema;
  const newBody=replacement.requestBody?.content?.['application/json']?.schema;
  if(oldBody&&newBody)compareFields(oldBody,newBody,where,'request');
  for(const [status,oldResponse] of Object.entries(op.responses??{})){
   if(!/^2[0-9][0-9]$/.test(status))continue;
   const newResponse=replacement.responses?.[status];
   if(!newResponse){violations.push('Removed successful HTTP status '+status+' '+where);continue}
   compareFields(oldResponse.content?.['application/json']?.schema,newResponse.content?.['application/json']?.schema,where+' '+status,'response');
  }
 }
}
if(violations.length){console.error(violations.join('\n'));process.exit(1)}
console.log('OpenAPI baseline compatibility passed (routes, operations, security, JSON body shapes)');
