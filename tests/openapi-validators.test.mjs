import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const js=ts.transpileModule(readFileSync('src/generated/openapi-validators.ts','utf8'),{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}
}).outputText;
const {validateOperationBody}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const create={title:'Cleanup',location:'Park',timezone:'America/Los_Angeles',
 start:'2026-11-14T09:00',end:'2026-11-14T12:00'};
test('generated Worker validator follows YAML required fields, lengths and date-time shape',()=>{
 assert.equal(validateOperationBody('createAdminEvent',create),true);
 assert.equal(validateOperationBody('createAdminEvent',{...create,title:''}),false);
 assert.equal(validateOperationBody('createAdminEvent',{...create,title:'X'.repeat(201)}),false);
 assert.equal(validateOperationBody('createAdminEvent',{...create,start:'bad'}),false);
 assert.equal(validateOperationBody('createAdminEvent',{...create,unknown:'value'}),false);
 assert.equal(validateOperationBody('createAdminEvent',{...create,location:undefined}),false);
});
test('generated Worker validator checks other YAML operation bodies',()=>{
 assert.equal(validateOperationBody('verifyCode',{email:'user@example.test',code:'12345678'}),true);
 assert.equal(validateOperationBody('verifyCode',{email:'user@example.test'}),false);
 assert.equal(validateOperationBody('acceptAgreements',{accepted:true,termsVersion:'1',privacyVersion:'1'}),true);
 assert.equal(validateOperationBody('acceptAgreements',{accepted:'true',termsVersion:'1',privacyVersion:'1'}),false);
 assert.equal(validateOperationBody('unrecognizedOperation',{}),false);
});
