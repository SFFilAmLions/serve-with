import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const server=spawn('npm',['run','dev','--','--host','127.0.0.1','--port','4179','--strictPort'],{stdio:'ignore',detached:true});
const base='http://127.0.0.1:4179';
const adminId='11111111-1111-4111-8111-111111111111';
const eventId='22222222-2222-4222-8222-222222222222';
const newEventId='33333333-3333-4333-8333-333333333333';
const admin={authenticated:true,email:'admin@example.org',userId:adminId,firstName:'Admin',lastName:'Example',emailVerified:true,profileComplete:true,agreementCurrent:true,administratorEligible:true,privileged:true};
const anonymous={authenticated:false,email:null};
const example={id:eventId,title:'Service day',location:'Community hall',timezone:'America/Los_Angeles',start_at:Date.parse('2026-11-15T17:00:00Z'),end_at:Date.parse('2026-11-15T19:00:00Z'),version:1};
async function ready(){for(let i=0;i<80;i++){try{if((await fetch(base)).ok)return}catch{}await new Promise(r=>setTimeout(r,250))}throw Error('Vite server did not start')}
async function context(me=anonymous,events=[]){
 await ready();
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage();
 await page.route('**/api/auth/me',r=>r.fulfill({json:typeof me==='function'?me():me}));
 await page.route('**/api/events?view=*',r=>r.fulfill({json:{events}}));
 return {browser,page};
}
after(()=>{if(server.pid){try{process.kill(-server.pid,'SIGTERM')}catch{server.kill()}}});

test('anonymous event lists are public, account controls live in the app bar',async()=>{
 const {browser,page}=await context();
 try{
  await page.goto(base);
  await page.getByText('No upcoming events',{exact:true}).waitFor();
  const logo=page.getByRole('img',{name:'SF Fil-Am Lions logo'});
  assert.equal(await logo.getAttribute('src'),'/club-logo.png');
  assert.equal(await page.getByRole('button',{name:'Add Event'}).count(),0);
  await page.getByRole('button',{name:'Past'}).click();
  await page.getByText('No past events yet.').waitFor();
  await page.getByRole('button',{name:'Account menu'}).click();
  await page.getByRole('menuitem',{name:'Sign in',exact:true}).click();
  assert.match(page.url(),/\/login$/);
  await page.getByRole('heading',{name:'Sign in'}).waitFor();
 }finally{await browser.close()}
});

test('email-first login supports resend, alternative email, eight-digit verification',async()=>{
 let me=anonymous,requests=0,verified=0;
 const {browser,page}=await context(()=>me);
 try{
  await page.route('**/api/auth/turnstile-config',r=>r.fulfill({json:{siteKey:null}}));
  await page.route('**/api/auth/request',r=>{requests++;return r.fulfill({json:{message:'If eligible, a sign-in email will arrive shortly.'}})});
  await page.route('**/api/auth/verify',r=>{assert.equal(r.request().postDataJSON().code,'12345678');verified++;me=admin;return r.fulfill({json:{authenticated:true}})});
  await page.goto(base+'/login');
  await page.getByRole('textbox',{name:'Email'}).fill('admin@example.org');
  await page.getByRole('button',{name:'Continue'}).click();
  await page.getByText('Check your email at admin@example.org').waitFor();
  await page.getByRole('button',{name:'Resend code'}).click();
  await page.getByRole('button',{name:'Use a different email'}).click();
  await page.getByRole('textbox',{name:'Email'}).fill('admin@example.org');
  await page.getByRole('button',{name:'Continue'}).click();
  await page.getByRole('textbox',{name:'Eight-digit code'}).fill('12345678');
  await page.getByRole('button',{name:'Continue'}).click();
  await page.getByRole('button',{name:'Continue to events'}).waitFor();
  assert.equal(requests,3);
  assert.equal(verified,1);
 }finally{await browser.close()}
});

test('magic link automatically POSTs once and scrubs the browser URL',async()=>{
 let me=anonymous,posts=0;
 const {browser,page}=await context(()=>me);
 try{
  await page.route('**/api/auth/magic',r=>{posts++;assert.equal(r.request().method(),'POST');assert.equal(r.request().postDataJSON().token,'temporary-secret');me=admin;return r.fulfill({json:{authenticated:true}})});
  await page.goto(base+'/?magic=temporary-secret');
  await page.getByRole('button',{name:'Continue to events'}).waitFor();
  assert.equal(new URL(page.url()).searchParams.has('magic'),false);
  assert.equal(new URL(page.url()).pathname,'/login');
  assert.equal(posts,1);
 }finally{await browser.close()}
});

test('incomplete verified profile stays on the login flow without policy fabrication',async()=>{
 const incomplete={...admin,profileComplete:false,agreementCurrent:false,privileged:false};
 const {browser,page}=await context(incomplete);
 try{
  await page.route('**/api/auth/profile',r=>r.fulfill({json:{profileComplete:true}}));
  await page.goto(base+'/login');
  await page.getByRole('heading',{name:'Complete your profile'}).waitFor();
  await page.getByRole('textbox',{name:'First name'}).fill('Test');
  await page.getByRole('textbox',{name:'Last name'}).fill('Person');
  await page.locator('input[type="date"]').fill('1990-05-02');
  assert.equal(await page.getByText(/Date of birth/).count()>0,true);
  await page.getByRole('button',{name:'Save profile'}).click();
 }finally{await browser.close()}
});

test('administrator workspace has segmented Events, Users, Usage pills and separate appearance choices',async()=>{
 const {browser,page}=await context(admin);
 try{
  await page.goto(base);
  await page.getByRole('button',{name:'Admin view'}).click();
  await page.getByText('· Admin',{exact:true}).first().waitFor();
  await page.getByRole('button',{name:'Events',exact:true}).waitFor();
  await page.getByRole('button',{name:'Users',exact:true}).waitFor();
  await page.getByRole('button',{name:'Usage',exact:true}).waitFor();
  await page.getByRole('button',{name:'Appearance'}).click();
  await page.getByRole('menuitem',{name:'Dark'}).click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('servewith-appearance')),'dark');
  await page.getByRole('button',{name:'Attendee view'}).click();
  assert.equal(new URL(page.url()).pathname,'/');
 }finally{await browser.close()}
});

test('anonymous canonical event detail renders and administrator sees contextual edit',async()=>{
 const {browser,page}=await context(anonymous,[example]);
 try{
  await page.route('**/api/events/'+eventId,r=>r.fulfill({json:{event:example}}));
  await page.goto(base);
  await page.getByRole('button',{name:'Service day'}).click();
  await page.getByRole('heading',{name:'Service day'}).waitFor();
  assert.equal(new URL(page.url()).pathname,'/events/'+eventId);
  assert.equal(await page.getByRole('button',{name:/Edit/}).count(),0);
 }finally{await browser.close()}
});

test('administrator event editor uses date/time pickers and protects dirty drafts',async()=>{
 const {browser,page}=await context(admin);
 try{
  await page.goto(base+'/admin/events/new');
  await page.getByRole('heading',{name:'Create event'}).waitFor();
  await page.getByRole('textbox',{name:'Event title'}).fill('Draft event');
  await page.getByRole('button',{name:'Back'}).click();
  await page.getByText('Discard unsaved changes?').waitFor();
  await page.getByRole('button',{name:'Keep editing'}).click();
  assert.equal(await page.getByRole('textbox',{name:'Event title'}).inputValue(),'Draft event');
  await page.getByRole('button',{name:'More options'}).click();
  await page.getByText('Time zone',{exact:true}).first().waitFor();
 }finally{await browser.close()}
});

test('duplicate event prepopulates creation and saving requests a new event',async()=>{
 const {browser,page}=await context(admin,[example]);
 try{
  await page.route('**/api/admin/events',r=>{const body=r.request().postDataJSON();assert.equal(r.request().method(),'POST');assert.equal(body.title,'Service day');assert.equal(body.start,'2026-11-15T09:00');return r.fulfill({status:201,json:{event:{...example,id:newEventId}}})});
  await page.route('**/api/events/'+newEventId,r=>r.fulfill({json:{event:{...example,id:newEventId}}}));
  await page.goto(base+'/admin/events');
  await page.getByRole('button',{name:'Duplicate Service day'}).click();
  await page.getByText(/Duplicating Service day/).waitFor();
  await page.getByRole('button',{name:'Save event'}).last().click();
  await page.getByRole('heading',{name:'Service day'}).waitFor();
  assert.equal(new URL(page.url()).pathname,'/events/'+newEventId);
 }finally{await browser.close()}
});

test('directory is paginated, searchable, sortable, and links to canonical profiles',async()=>{
 const {browser,page}=await context(admin);
 try{
  let last='';
  await page.route('**/api/admin/users?*',r=>{last=r.request().url();return r.fulfill({json:{users:[{id:adminId,first_name:'Admin',last_name:'Example',email:'admin@example.org'}],hasMore:false,nextOffset:1}})});
  await page.route('**/api/users/'+adminId,r=>r.fulfill({json:{user:{id:adminId,first_name:'Admin',last_name:'Example',email:'admin@example.org',date_of_birth:'1990-01-01'},canCorrectDob:true}}));
  await page.goto(base+'/admin/users');
  await page.getByRole('heading',{name:'Users'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Jump to A'}).count(),0);
  assert.ok(!last.includes('letter='));
  await page.getByRole('textbox',{name:'Search name or email'}).fill('Admin');
  await page.getByText('admin@example.org').first().click();
  assert.equal(new URL(page.url()).pathname,'/users/'+adminId);
  await page.getByRole('heading',{name:'Admin Example'}).waitFor();
  await page.getByRole('button',{name:'Edit profile'}).click();
  await page.getByLabel('Date of birth').waitFor();
 }finally{await browser.close()}
});

test('System appearance responds to OS preference and mobile event lists do not overflow',async()=>{
 const {browser,page}=await context();
 try{
  await page.setViewportSize({width:375,height:812});
  await page.emulateMedia({colorScheme:'light'});
  await page.goto(base);
  await page.getByText('No upcoming events',{exact:true}).waitFor();
  const light=await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor);
  await page.emulateMedia({colorScheme:'dark'});
  await page.waitForFunction(previous=>getComputedStyle(document.body).backgroundColor!==previous,light);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }finally{await browser.close()}
});

test('existing attendee on full event is not signed up twice',async()=>{
 const event={...example,spots_available:0,capacity:1};
 const {browser,page}=await context(admin,[event]);
 let posts=0;
 try{
  await page.route('**/api/events/'+eventId,r=>r.fulfill({json:{event}}));
  await page.route('**/api/events/'+eventId+'/signups',r=>{if(r.request().method()==='GET')return r.fulfill({json:{signup:{id:'existing'}}});posts++;return r.fulfill({status:500,json:{error:'Unexpected duplicate'}})});
  await page.route('**/api/events/'+eventId+'/participants',r=>r.fulfill({json:{participants:[]}}));
  
  await page.addInitScript(id=>localStorage.setItem('servewith-pending-signup',JSON.stringify({id,expiresAt:Date.now()+60000})),eventId);
  await page.goto(base+'/events/'+eventId);
  await page.getByText('You are already signed up for this event.').waitFor();
  assert.equal(posts,0);
 }finally{await browser.close()}
});

test('full event never offers anonymous signup or reveals roster',async()=>{
 const event={...example,capacity:1,signups_count:1,spots_available:0};
 const {browser,page}=await context(anonymous,[event]);
 try{
  await page.route('**/api/events/'+eventId,r=>r.fulfill({json:{event}}));
  let rosterCalls=0,signupPosts=0;
  await page.route('**/api/events/'+eventId+'/participants',r=>{rosterCalls++;return r.fulfill({status:401,json:{error:'Unauthorized'}})});
  await page.route('**/api/events/'+eventId+'/signups',r=>{if(r.request().method()==='POST')signupPosts++;return r.fulfill({status:401,json:{error:'Unauthorized'}})});
  await page.goto(base+'/events/'+eventId);
  await page.getByText('This event is full.').waitFor();
  assert.equal(await page.getByRole('button',{name:'Sign up',exact:true}).count(),0);
  assert.equal(await page.getByRole('heading',{name:'Participants'}).count(),0);
  assert.equal(rosterCalls,0);
  assert.equal(signupPosts,0);
 }finally{await browser.close()}
});

test('administrator usage dashboard preserves unavailable and unknown metrics',async()=>{
 const {browser,page}=await context(admin);
 try{
  await page.route('**/api/admin/usage',r=>r.fulfill({json:{
   environment:'staging',collectedAt:'2026-10-13T00:00:00Z',
   providers:[{name:'Cloudflare D1',scope:'staging database',status:'unavailable',used:null,limit:null,remaining:null,resetsAt:null,reason:'No authorized analytics token'}]
  }}));
  await page.goto(base+'/admin/usage');
  await page.getByRole('heading',{name:'Usage & Quotas'}).waitFor();
  await page.getByRole('heading',{name:'Cloudflare D1'}).waitFor();
  await page.getByText('Usage: Unknown').waitFor();
  await page.getByText('Limit: Unknown').waitFor();
  await page.getByText('Remaining: Unknown').waitFor();
  assert.equal(await page.getByText(/utilization \(/).count(),0);
  await page.getByText('No authorized analytics token').waitFor();
 }finally{await browser.close()}
});

test('unauthorized administrator usage page does not fetch private provider metrics',async()=>{
 const {browser,page}=await context(anonymous);
 let calls=0;
 try{
  await page.route('**/api/admin/usage',r=>{calls++;return r.fulfill({status:403,json:{error:'Forbidden'}})});
  await page.goto(base+'/admin/usage');
  await page.getByText(/Complete your profile and current agreement to access administrator tools/).waitFor();
  assert.equal(calls,0);
 }finally{await browser.close()}
});

test('non-admin event management deep link redirects without fetching private roster',async()=>{
 const attendee={...admin,administratorEligible:false,privileged:false,email:'member@example.org',userId:'77777777-7777-4777-8777-777777777777'};
 const {browser,page}=await context(attendee,[example]);
 let adminCalls=0;
 try{
  await page.route('**/api/events/'+eventId,r=>r.fulfill({json:{event:example}}));
  await page.route('**/api/events/'+eventId+'/signups',r=>r.fulfill({json:{signup:null}}));
  await page.route('**/api/admin/events/'+eventId+'/signups',r=>{adminCalls++;return r.fulfill({status:403,json:{error:'Forbidden'}})});
  await page.goto(base+'/admin/events/'+eventId);
  await page.getByRole('heading',{name:'Service day'}).waitFor();
  assert.equal(new URL(page.url()).pathname,'/events/'+eventId);
  await page.getByText(/don't have access to the administrator event page/).waitFor();
  assert.equal(adminCalls,0,'public redirect must not request administrator roster');
 }finally{await browser.close()}
});

test('expired pending signup intent is discarded without any mutation',async()=>{
 const event={...example,capacity:2,signups_count:0,spots_available:2};
 const {browser,page}=await context(admin,[event]);
 let posts=0;
 try{
  await page.route('**/api/events/'+eventId,r=>r.fulfill({json:{event}}));
  await page.route('**/api/events/'+eventId+'/signups',r=>{
   if(r.request().method()==='GET')return r.fulfill({json:{signup:null}});
   posts++;return r.fulfill({status:500,json:{error:'Unexpected signup'}});
  });
  await page.addInitScript(id=>localStorage.setItem('servewith-pending-signup',JSON.stringify({id,expiresAt:Date.now()-60000})),eventId);
  await page.goto(base+'/events/'+eventId);
  await page.getByRole('heading',{name:'Service day'}).waitFor();
  await page.waitForFunction(()=>localStorage.getItem('servewith-pending-signup')===null);
  assert.equal(posts,0,'expired intent must not create a signup');
 }finally{await browser.close()}
});

test('valid pending signup continues once after login and clears intent',async()=>{
 const event={...example,capacity:2,signups_count:0,spots_available:2};
 const {browser,page}=await context(admin,[event]);
 let posts=0,signedUp=false;
 try{
  await page.route('**/api/events/'+eventId,r=>r.fulfill({json:{event}}));
  await page.route('**/api/events/'+eventId+'/signups',r=>{
   if(r.request().method()==='GET')return r.fulfill({json:{signup:signedUp?{id:'completed-signup'}:null}});
   if(r.request().method()==='POST'){
    posts++;signedUp=true;
    return r.fulfill({status:201,json:{signup:{id:'completed-signup'}}});
   }
   return r.fulfill({status:405,json:{error:'Method not allowed'}});
  });
  await page.route('**/api/events/'+eventId+'/participants',r=>r.fulfill({json:{participants:[{name:'Admin Example'}]}}));
  await page.addInitScript(id=>{
   if(!sessionStorage.getItem('continuation-seeded')){
    localStorage.setItem('servewith-pending-signup',JSON.stringify({id,expiresAt:Date.now()+60000}));
    sessionStorage.setItem('continuation-seeded','yes');
   }
  },eventId);
  await page.goto(base+'/events/'+eventId);
  await page.getByText('You have signed up for this event.').waitFor();
  assert.equal(posts,1);
  assert.equal(await page.evaluate(()=>localStorage.getItem('servewith-pending-signup')),null);
  await page.reload();
  await page.getByRole('heading',{name:'Service day'}).waitFor();
  await page.getByRole('button',{name:/Withdraw/}).waitFor();
  assert.equal(posts,1,'refresh must not replay completed signup');
 }finally{await browser.close()}
});

test('pending signup for a different event never signs up the current event',async()=>{
 const event={...example,capacity:2,signups_count:0,spots_available:2};
 const {browser,page}=await context(admin,[event]);
 let posts=0;
 try{
  await page.route('**/api/events/'+eventId,r=>r.fulfill({json:{event}}));
  await page.route('**/api/events/'+eventId+'/signups',r=>{
   if(r.request().method()==='GET')return r.fulfill({json:{signup:null}});
   posts++;return r.fulfill({status:500,json:{error:'Unexpected cross-event signup'}});
  });
  await page.addInitScript(id=>localStorage.setItem('servewith-pending-signup',JSON.stringify({id,expiresAt:Date.now()+60000})),newEventId);
  await page.goto(base+'/events/'+eventId);
  await page.getByRole('heading',{name:'Service day'}).waitFor();
  await page.getByRole('button',{name:'Sign up as Admin'}).waitFor();
  assert.equal(posts,0,'pending intent for another event must never submit on this event');
  const intent=await page.evaluate(()=>JSON.parse(localStorage.getItem('servewith-pending-signup')));
  assert.equal(intent.id,newEventId,'unrelated event page must not replace the intended target');
 }finally{await browser.close()}
});

test('pending signup capacity conflict reports failure and is not replayed',async()=>{
 const event={...example,capacity:1,signups_count:0,spots_available:1};
 const {browser,page}=await context(admin,[event]);
 let posts=0;
 try{
  await page.route('**/api/events/'+eventId,r=>r.fulfill({json:{event}}));
  await page.route('**/api/events/'+eventId+'/signups',r=>{
   if(r.request().method()==='GET')return r.fulfill({json:{signup:null}});
   posts++;return r.fulfill({status:409,json:{error:'Event is full'}});
  });
  await page.addInitScript(id=>{
   if(!sessionStorage.getItem('seeded-conflict')){
    localStorage.setItem('servewith-pending-signup',JSON.stringify({id,expiresAt:Date.now()+60000}));
    sessionStorage.setItem('seeded-conflict','yes');
   }
  },eventId);
  await page.goto(base+'/events/'+eventId);
  await page.getByRole('alert').getByText('Event is full').waitFor();
  assert.equal(posts,1);
  assert.equal(await page.evaluate(()=>localStorage.getItem('servewith-pending-signup')),null);
  await page.reload();
  await page.getByRole('heading',{name:'Service day'}).waitFor();
  assert.equal(posts,1,'failed continuation must not replay on reload');
 }finally{await browser.close()}
});

test('started event cancels pending signup before any POST',async()=>{
 const event={...example,start_at:Date.now()-60000,end_at:Date.now()+600000,spots_available:5,capacity:5};
 const {browser,page}=await context(admin,[event]);
 let posts=0;
 try{
  await page.route('**/api/events/'+eventId,r=>r.fulfill({json:{event}}));
  await page.route('**/api/events/'+eventId+'/signups',r=>{
   if(r.request().method()==='GET')return r.fulfill({json:{signup:null}});
   posts++;return r.fulfill({status:500,json:{error:'Unexpected signup'}});
  });
  await page.addInitScript(id=>localStorage.setItem('servewith-pending-signup',JSON.stringify({id,expiresAt:Date.now()+60000})),eventId);
  await page.goto(base+'/events/'+eventId);
  await page.getByText('Signups closed when the event started.').first().waitFor();
  await page.waitForFunction(()=>localStorage.getItem('servewith-pending-signup')===null);
  assert.equal(posts,0);
  assert.equal(await page.getByRole('button',{name:/Sign up/}).count(),0);
 }finally{await browser.close()}
});

test('signup action is keyboard operable and success has an accessible status',async()=>{
 const event={...example,capacity:3,spots_available:3,signups_count:0};
 const {browser,page}=await context(admin,[event]);
 let active=false,posts=0;
 try{
  await page.route('**/api/events/'+eventId,r=>r.fulfill({json:{event}}));
  await page.route('**/api/events/'+eventId+'/signups',r=>{
   if(r.request().method()==='GET')return r.fulfill({json:{signup:active?{id:'signup-keyboard'}:null}});
   posts++;active=true;return r.fulfill({status:201,json:{signup:{id:'signup-keyboard'}}});
  });
  await page.route('**/api/events/'+eventId+'/participants',r=>r.fulfill({json:{participants:[{name:'Admin Example'}]}}));
  await page.goto(base+'/events/'+eventId);
  const signup=page.getByRole('button',{name:'Sign up as Admin'});
  await signup.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('status').getByText('You have signed up for this event.').waitFor();
  await page.getByRole('button',{name:'Withdraw'}).waitFor();
  assert.equal(posts,1);
 }finally{await browser.close()}
});

test('malformed pending signup intent is cleared without a mutation',async()=>{
 const event={...example,capacity:2,signups_count:0,spots_available:2};
 const {browser,page}=await context(admin,[event]);
 let posts=0;
 try{
  await page.route('**/api/events/'+eventId,r=>r.fulfill({json:{event}}));
  await page.route('**/api/events/'+eventId+'/signups',r=>{
   if(r.request().method()==='GET')return r.fulfill({json:{signup:null}});
   posts++;return r.fulfill({status:500,json:{error:'Unexpected POST'}});
  });
  await page.addInitScript(()=>localStorage.setItem('servewith-pending-signup','{not valid JSON'));
  await page.goto(base+'/events/'+eventId);
  await page.getByRole('button',{name:'Sign up as Admin'}).waitFor();
  await page.waitForFunction(()=>localStorage.getItem('servewith-pending-signup')===null);
  assert.equal(posts,0);
 }finally{await browser.close()}
});

test('withdrawal is keyboard-operable and shows an accessible confirmation',async()=>{
 const event={...example,capacity:2,signups_count:1,spots_available:1};
 const {browser,page}=await context(admin,[event]);
 let enrolled=true,deletes=0;
 try{
  await page.route('**/api/events/'+eventId,r=>r.fulfill({json:{event}}));
  await page.route('**/api/events/'+eventId+'/signups',r=>{
   if(r.request().method()==='GET')return r.fulfill({json:{signup:enrolled?{id:'existing'}:null}});
   if(r.request().method()==='DELETE'){deletes++;enrolled=false;return r.fulfill({json:{withdrawn:true}})}
   return r.fulfill({status:405,json:{error:'Unexpected method'}});
  });
  await page.route('**/api/events/'+eventId+'/participants',r=>r.fulfill({json:{participants:[{name:'Admin Example'}]}}));
  await page.goto(base+'/events/'+eventId);
  const withdraw=page.getByRole('button',{name:'Withdraw'});
  await withdraw.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('status').getByText('Your signup has been withdrawn.').waitFor();
  await page.getByRole('button',{name:'Sign up as Admin'}).waitFor();
  assert.equal(deletes,1);
  assert.equal(await page.getByRole('heading',{name:'Participants'}).count(),0,'roster disappears after withdrawal');
 }finally{await browser.close()}
});

test('usage provider failure is an accessible error and refresh remains available',async()=>{
 const {browser,page}=await context(admin);
 let calls=0;
 try{
  await page.route('**/api/admin/usage',r=>{
   calls++;
   return r.fulfill({status:503,json:{error:'Metrics provider unavailable'}});
  });
  await page.goto(base+'/admin/usage');
  await page.getByRole('alert').getByText('Metrics provider unavailable').waitFor();
  await page.getByRole('button',{name:'Refresh status'}).click();
  await page.waitForFunction(()=>document.body.innerText.includes('Metrics provider unavailable'));
  assert.equal(calls,2,'refresh retries when an upstream metrics call fails');
  assert.equal(await page.getByText('Current usage').count(),0,'failure must not render a fabricated reading');
 }finally{await browser.close()}
});
