import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync('src/event-form.ts','utf8');
const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {validateDraft,emptyDraft,localInput,timeZones}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
const valid={title:'Community cleanup',location:'San Francisco',timezone:'America/Los_Angeles',start:'2026-11-14T09:00',end:'2026-11-14T12:00'};
test('editor defaults and Pacific zone are available',()=>{assert.equal(emptyDraft().timezone,'America/Los_Angeles');assert.ok(timeZones.includes('America/Los_Angeles'));assert.deepEqual(validateDraft(valid),{});});
test('invalid names, locations, time zones and intervals are rejected',()=>{
 for(const [name,draft] of Object.entries({title:{...valid,title:' '},location:{...valid,location:' '},timezone:{...valid,timezone:'invalid/zone'},start:{...valid,start:'nope'},end:{...valid,end:valid.start}})) assert.ok(validateDraft(draft)[name],name);
 assert.ok(validateDraft({...valid,title:'a'.repeat(201)}).title);
 assert.ok(validateDraft({...valid,location:'a'.repeat(501)}).location);
});
test('cross-midnight events and different IANA zones format correctly',()=>{
 assert.deepEqual(validateDraft({...valid,start:'2026-11-14T23:30',end:'2026-11-15T01:00'}),{});
 const instant=Date.UTC(2026,10,14,17,0);
 assert.equal(localInput(instant,'America/Los_Angeles'),'2026-11-14T09:00');
 assert.equal(localInput(instant,'America/New_York'),'2026-11-14T12:00');
});
