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
 for(const icon of ['event','group','monitoring','how_to_reg','link','schedule'])assert.match(html,new RegExp('(?:,|=)'+icon+'(?:,|&amp;)'),icon);
});

test('profile picture edit uses an accessible pencil control only for the profile owner',()=>{
 assert.match(source,/canEditAvatar=\{userRoute\[1\]===me\.userId\}/);
 assert.match(source,/canEditAvatar&&u\.email&&<Tooltip/);
 assert.match(source,/aria-label="Edit profile picture in Gravatar"/);
 assert.match(source,/position:'absolute',right:-4,bottom:-4/);
 assert.doesNotMatch(source,/>Edit profile picture in Gravatar<\/Button>/);
 assert.match(source,/GravatarQuickEditorCore/);
 assert.match(source,/scope:\['avatars'\]/);
 assert.match(source,/email,scope:/);
 assert.match(source,/onProfileUpdated:\(\)=>setAvatarRevision/);
 assert.match(source,/revision=\{avatarRevision\}/);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/@gravatar-com\/quick-editor@0\.8\.0/);
});
test('admin event details link and creation history remain available without redundant menu signup',()=>{
 assert.match(source,/key:'event-created'/);
 assert.match(source,/action:'Event created'/);
 assert.match(source,/eventDetails\?\.created_at/);
 assert.match(source,/new URL\('\/events\/'\+id,location\.origin\)/);
 assert.match(source,/>Copy link<\/Button>/);
 assert.doesNotMatch(source,/<MenuItem[^>]*>My signups<\/MenuItem>/);
 assert.match(source,/<ToggleButton value="signups">/);
});

test('edit routes return to their owning detail screens, not generic event pages',()=>{
 assert.match(source,/onClick=\{\(\)=>go\(edit\?'\/users\/'\+id:backPath\)\}/);
 assert.match(source,/edit\?'Back to profile'/);
 assert.match(source,/const editorReturnPath=id\?'\/admin\/events\/'\+id:'\/admin\/events'/);
 assert.match(source,/go\('\/admin\/events\/'\+saved\.event\.id\)/);
 assert.match(source,/onClick=\{\(\)=>go\(editorReturnPath\)\}>Discard changes/);
 assert.match(source,/onClick=\{\(\)=>\{if\(!dirty\|\|confirm\('Discard changes\?'\)\)go\('\/users\/'\+id\)\}\}/);
});

test('My Signups mirrors the event grid and separates active, past and unrejoined withdrawals',()=>{
 assert.match(source,/const activeEventIds=new Set\(items\.filter\(item=>item\.deleted_at===null\)/);
 assert.match(source,/const latestByEvent=new Map<string,SignupHistoryItem>/);
 assert.match(source,/view==='cancelled'\?!activeEventIds\.has\(item\.event_id\)&&item\.deleted_at!==null/);
 assert.match(source,/view==='upcoming'\?item\.end_at>now:item\.end_at<=now/);
 assert.match(source,/value="cancelled">Cancelled/);
 assert.match(source,/gridTemplateColumns:\{xs:'1fr',md:'repeat\(2,minmax\(0,1fr\)\)'\}/);
 assert.match(source,/<EventWhen event=\{event\}\/>/);
});

test('the GitHub build footer is placed after flex-growing main content',()=>{
 assert.match(source,/minHeight:'100dvh',display:'flex',flexDirection:'column'/);
 assert.match(source,/component="main" sx=\{\{flex:1,width:'100%'\}\}/);
 assert.match(source,/<BuildFooter\/><\/Container><\/Box><\/ThemeProvider>/);
});

test('event listings and details show accessible visual cues without location chip',()=>{
 assert.match(source,/<Glyph type="calendar"\/>/);
 assert.match(source,/<Glyph type="pin"\/><Typography variant="body2"/);
 assert.doesNotMatch(source,/<Chip icon=\{<Glyph type="pin"\/>\}/);
 assert.match(source,/<Glyph type="attendance" size=\{24\}\/>/);
 assert.match(source,/startIcon=\{<Glyph type=\{signup\?'withdraw':'signups'\}\/>\}/);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 for(const name of ['calendar_month','groups','person_remove'])assert.ok(html.includes(name),name);
});

test('admin users directory provides a create-user floating action button',()=>{
 assert.match(source,/<Fab variant="extended" color="primary" aria-label="Create user" onClick=\{\(\)=>go\('\/admin\/users\/new'\)\}/);
 assert.match(source,/position:'fixed',bottom:\{xs:24,sm:32\},right:\{xs:24,sm:32\}/);
});

test('all back navigation controls display a prominent arrow',()=>{
 assert.match(source,/startIcon=\{<Glyph type="back" size=\{24\}\/>\}/);
 assert.match(source,/<IconButton aria-label="Back" onClick=\{close\}><Glyph type="back" size=\{24\}\/><\/IconButton>/);
 assert.match(source,/Back to admin events<\/Button>/);
 assert.doesNotMatch(source,/startIcon=\{<Glyph type="back"\/>\}/);
});

test('event time displays a clock glyph instead of raw ligature text',()=>{
 assert.match(source,/clock:'schedule'/);
 assert.match(source,/<Glyph type="clock"\/>/);
 assert.match(source,/link:'link'/);
});

test('admin event roster has one attendee search input with live user lookup',()=>{
 const section=source.slice(source.indexOf('function AdminEventSignups('),source.indexOf('\nfunction ',source.indexOf('function AdminEventSignups(')+10));
 assert.match(section,/label="Search and select attendee"/);
 assert.match(section,/onInputChange=\{/);
 assert.match(section,/generatedApi\.listAdminUsers\(\{q:query\}\)/);
 assert.doesNotMatch(section,/label="Search attendees by name or email"/);
 assert.doesNotMatch(section,/>Search users<\/Button>/);
});


test('initial profile date of birth supports typed YYYY-MM-DD entry',()=>{
 const section=source.slice(source.indexOf('function AuthScreen('),source.indexOf('function UserView('));
 assert.match(section,/label="Date of birth" type="text"/);
 assert.match(section,/placeholder="YYYY-MM-DD"/);
 assert.match(section,/pattern:"\[0-9\]\{4\}-\[0-9\]\{2\}-\[0-9\]\{2\}"/);
 assert.doesNotMatch(section,/label="Date of birth" type="date"/);
});
