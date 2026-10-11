import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import YAML from 'yaml';
import createClient from 'openapi-fetch';
import Ajv2020 from 'ajv/dist/2020.js';

const contract=YAML.parse(readFileSync('openapi/openapi.yaml','utf8'));
const seen=[];
const client=createClient({
  baseUrl:'https://servewith-beta.sffilamlions.org',
  credentials:'include',
  fetch:async (request) => {
    seen.push({method:request.method,path:new URL(request.url).pathname,credentials:request.credentials,origin:request.headers.get('origin')});
    if (request.method==='GET') return Response.json({event:{id:'123e4567-e89b-42d3-a456-426614174000',title:'Test',location:'Park',timezone:'UTC',start_at:1,end_at:2,version:1}});
    return Response.json({event:{id:'123e4567-e89b-42d3-a456-426614174000',title:'Test',location:'Park',timezone:'UTC',start_at:1,end_at:2,version:1}},{status:201});
  },
});
const id='123e4567-e89b-42d3-a456-426614174000';
const get=await client.GET('/api/events/{id}',{params:{path:{id}}});
assert.equal(get.response.status,200);
assert.equal(get.data.event.id,id);
const post=await client.POST('/api/admin/events',{
  headers:{origin:'https://servewith-beta.sffilamlions.org'},
  body:{title:'Test',location:'Park',timezone:'UTC',start:'2026-11-14T09:00',end:'2026-11-14T12:00'},
});
assert.equal(post.response.status,201);
assert.deepEqual(seen.map(x=>x.method),['GET','POST']);
assert.deepEqual(seen.map(x=>x.path),['/api/events/'+id,'/api/admin/events']);
assert.ok(seen.every(x=>x.credentials==='include'));
assert.equal(seen[1].origin,'https://servewith-beta.sffilamlions.org');

// The schema is authoritative; validate the body with OpenAPI 3.1/JSON Schema
// 2020-12 semantics. A full server middleware integration remains a later gate.
const create=contract.paths['/api/admin/events'].post;
const definition=contract.components.schemas.EventCreateInput;
const ajv=new Ajv2020({strict:false,allErrors:true,validateFormats:false});
const validate=ajv.compile(definition);
assert.equal(validate({title:'Test',location:'Park',timezone:'UTC',start:'2026-11-14T09:00',end:'2026-11-14T12:00'}),true);
assert.equal(validate({title:'Test',location:'Park',timezone:'UTC',start:'bad',end:'2026-11-14T12:00'}),false);
assert.equal(create.operationId,'createAdminEvent');
console.log('Callable OpenAPI client and schema validation spike passed');
