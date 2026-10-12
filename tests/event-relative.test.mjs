import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(readFileSync('src/event-relative.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {eventRelativeLabel}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const d=60*60*1000;
test('event countdown is a single UTC-based unit and changes exactly at start/end',()=>{
 assert.equal(eventRelativeLabel(14*24*d,15*24*d,0),'In 2 weeks');
 assert.equal(eventRelativeLabel(8*24*d,9*24*d,0),'In 1 week');
 assert.equal(eventRelativeLabel(2*24*d,3*24*d,0),'In 2 days');
 assert.equal(eventRelativeLabel(4*d,5*d,0),'In 4 hours');
 assert.equal(eventRelativeLabel(50*60*1000,2*d,0),'In 50 minutes');
 assert.equal(eventRelativeLabel(30*1000,2*d,0),'Starting soon');
 assert.equal(eventRelativeLabel(1000,2000,1000),'Event in progress');
 assert.equal(eventRelativeLabel(1000,2000,2000),'Event ended');
});
test('DST transitions do not change elapsed-time arithmetic',()=>{
 const now=Date.parse('2026-03-08T09:00:00Z');
 assert.equal(eventRelativeLabel(now+2*d,now+3*d,now),'In 2 hours');
});
