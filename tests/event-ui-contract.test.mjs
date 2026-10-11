import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync('src/main.tsx','utf8');
test('admin dialogs retain guarded close and conflict recovery controls',()=>{
 assert.match(source,/Discard unsaved changes\?/);
 assert.match(source,/Keep editing/);
 assert.match(source,/Reload current event/);
 assert.match(source,/response\.status===409/);
 assert.match(source,/setReloadConfirm\(true\)/);
 assert.match(source,/setConflict\(true\)/);
});
test('event UI supplies create update delete feedback and accessible labels',()=>{
 for(const label of ['Event created','Event updated','Event deleted','Add Event','Edit Event','Delete event','Start date and time','End date and time']){
  assert.ok(source.includes(label),label);
 }
 assert.match(source,/aria-labelledby="event-editor-title"/);
 assert.match(source,/aria-labelledby="delete-event-title"/);
 assert.match(source,/Snackbar/);
});
test('public event states remain independent of auth and footer keeps source links',()=>{
 for(const term of ['No upcoming events','No past events yet.','Retry','GitHub repository','VITE_DEPLOY_ENV','VITE_RELEASE_TAG']){
 assert.ok(source.includes(term),term);
 }
});

test('event dialogs restore focus to their action triggers',()=>{
 assert.match(source,/editorTrigger=useRef/);
 assert.match(source,/deleteTrigger=useRef/);
 assert.match(source,/requestAnimationFrame\(\(\)=>target\.current\?\.focus\(\)\)/);
 assert.match(source,/onClose=\{closeEditor\}/);
 assert.match(source,/onClick=\{closeDelete\}/);
});

test('dialog accessibility descriptions and close guards are retained',()=>{
 for(const id of ['event-editor-description','discard-description','delete-event-description']){
  assert.ok(source.includes(id),id);
 }
 assert.match(source,/if\(saving\|\|discard\|\|reloadConfirm\)return/);
});
