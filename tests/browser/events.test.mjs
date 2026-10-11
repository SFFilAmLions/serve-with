import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const server=spawn('npm',['run','dev','--','--host','127.0.0.1','--port','4179','--strictPort'],{stdio:'ignore'});
const base='http://127.0.0.1:4179';
async function ready(){for(let i=0;i<80;i++){try{if((await fetch(base)).ok)return;}catch{}await new Promise(r=>setTimeout(r,250));}throw Error('Vite test server did not start')}
test('anonymous visitor browses empty upcoming and past views',async()=>{
 await ready();
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  await page.route('**/api/auth/me',route=>route.fulfill({json:{authenticated:false}}));
  await page.route('**/api/events?view=*',route=>route.fulfill({json:{events:[]}}));
  await page.goto(base);
  await page.getByText('No upcoming events',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Add Event'}).count(),0);
  await page.getByRole('tab',{name:'Past Events'}).click();
  await page.getByText('No past events yet.').waitFor();
  await page.getByRole('tab',{name:'Upcoming Events'}).click();
  await page.getByText('Check back soon for new opportunities to serve.').waitFor();
 }finally{await browser.close()}
});
test('authenticated admin can open editor and receives unsaved changes guard',async()=>{
 await ready();
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  await page.route('**/api/auth/me',route=>route.fulfill({json:{authenticated:true,email:'admin@example.org'}}));
  await page.route('**/api/admin/dashboard',route=>route.fulfill({json:{ok:true}}));
  await page.route('**/api/events?view=*',route=>route.fulfill({json:{events:[]}}));
  await page.goto(base);
  await page.getByRole('button',{name:'Add Event'}).click();
  await page.getByRole('textbox',{name:'Title'}).fill('Changed');
  await page.getByRole('button',{name:'Cancel'}).click();
  await page.getByText('Discard unsaved changes?').waitFor();
  await page.getByRole('button',{name:'Keep editing'}).click();
  assert.equal(await page.getByRole('textbox',{name:'Title'}).inputValue(),'Changed');
  await page.getByRole('button',{name:'Cancel'}).click();
  await page.getByRole('button',{name:'Discard changes'}).click();
  await page.getByRole('button',{name:'Add Event'}).focus();
  assert.equal(await page.getByRole('dialog').count(),0);
 }finally{await browser.close()}
});
process.on('exit',()=>server.kill());
