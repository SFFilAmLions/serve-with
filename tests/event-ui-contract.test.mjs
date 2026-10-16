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

test('SDDW-005 Material controls preserve the approved UI choices',()=>{
 assert.match(source,/<ToggleButtonGroup exclusive/);
 assert.match(source,/<Card variant="outlined"/);
 assert.match(source,/gridTemplateColumns:\{xs:'1fr',md:'repeat\(2,minmax\(0,1fr\)\)'\}/);
 assert.match(source,/aria-label="Appearance"/);
 assert.match(source,/AccountAvatar/);
 assert.match(source,/https:\/\/www\.gravatar\.com\/avatar\//);
 assert.match(source,/timeZoneOffsetMinutes\(event\.start_at,event\.timezone\)/);
 assert.match(source,/timeZoneOffsetMinutes\(event\.start_at,Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone\)/);
 assert.doesNotMatch(source,/Alphabetical directory navigation/);
 assert.equal((source.match(/>Save event<\/Button>/g)||[]).length,1);
});
test('Turnstile UI requests a fresh token for each login email',()=>{
 assert.match(source,/action:'request-login'/);
 assert.match(source,/siteKey=\{turnstileKey\}/);
 assert.match(source,/turnstileToken:captchaToken/);
 assert.match(source,/setCaptchaRound\(n=>n\+1\)/);
 assert.match(source,/captchaReady/);
});

test('SDDW-006 navigation and registration controls retain contextual, accessible actions',()=>{
 for(const label of ['Copy public event link','Copy link to ','Cancel registration as ','View events','My signups','Attendee sections','Administrator sections']){
  assert.ok(source.includes(label),label);
 }
 assert.match(source,/workspaceSwitchPath=eventContextId/);
 assert.match(source,/\/admin\/events\/'\+eventContextId/);
 assert.match(source,/navigator\.clipboard\.writeText/);
});

test('SDDW-006 profile and admin event sections expose roster and activity history',()=>{
 for(const label of ['Edit profile picture in Gravatar','Details','Roster (','History','Confirm signup','aria-label="Edit event"']){
  assert.ok(source.includes(label),label);
 }
 assert.match(source,/active=entries\.filter\(entry=>entry\.deleted_at===null\)/);
 assert.match(source,/timeline=entries\.flatMap/);
 assert.match(source,/sort\(\(a,b\)=>b\.time-a\.time\)/);
 assert.match(source,/component="ol"/);
 assert.match(source,/component="section" aria-labelledby="admin-event-history-heading"/);
 assert.match(source,/<Fab variant="extended"/);
 assert.match(source,/maxWidth:480/);
});

test('staging builds show a prominent route to production without affecting production builds',()=>{
 assert.match(source,/function StagingNotice/);
 assert.match(source,/buildEnvironment!=='staging'/);
 assert.match(source,/https:\/\/servewith\.sffilamlions\.org\//);
 assert.match(source,/Main site/);
 assert.match(source,/<StagingNotice\/>/);
});

test('tab icons are present in the subsetted Google Material Symbols font',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 for(const icon of ['event','group','monitoring','how_to_reg'])assert.match(html,new RegExp('(?:,|=)'+icon+'(?:,|&amp;)'),icon);
});

test('profile picture edit uses an accessible pencil control only for the profile owner',()=>{
 assert.match(source,/canEditAvatar=\{userRoute\[1\]===me\.userId\}/);
 assert.match(source,/canEditAvatar&&u\.email&&<Tooltip/);
 assert.match(source,/aria-label="Edit profile picture in Gravatar"/);
 assert.match(source,/position:'absolute',right:-4,bottom:-4/);
 assert.doesNotMatch(source,/>Edit profile picture in Gravatar<\/Button>/);
});
