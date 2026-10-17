import { operations, matchOperation, dispatchOperation, type WorkerHandlers } from './generated/openapi-operations';
import { validateOperationBody } from './generated/openapi-validators';
interface D1Statement { bind(...values: unknown[]): D1Statement; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; run(): Promise<{ meta: { changes: number } }> }
interface D1Database { prepare(query: string): D1Statement; batch(statements: D1Statement[]): Promise<unknown> }
import admins from './generated/admins.json';
import policyMetadata from './generated/policy-versions.json';
import { Temporal } from '@js-temporal/polyfill';
import { isStagingRegistrationEligible } from './registration-eligibility';

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  AUTH_DB?: D1Database;
  AUTH_PEPPER?: string;
  RESEND_API_KEY?: string;
  // This key is intentionally separate from the send-only authentication key.
  // Resend's usage endpoint requires a full-access key.
  RESEND_USAGE_API_KEY?: string;
  CLOUDFLARE_ANALYTICS_API_TOKEN?: string;
  USAGE_CLOUDFLARE_ACCOUNT_ID?: string;
  AUTH_FROM_EMAIL?: string;
  ENVIRONMENT?: string;
  STAGING_REGISTRATION_EMAILS?: string;
  REQUIRED_TERMS_VERSION?: string;
  REQUIRED_PRIVACY_VERSION?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
}

type UsageProvider = {
  name:string; scope:string; status:'available'|'stale'|'unavailable';
  used:number|null; limit:number|null; remaining:number|null; resetsAt:string|null; reason?:string;
};
type UsageSnapshot = { collectedAt:string; expiresAt:number; providers:UsageProvider[] };
// This is deliberately an isolate-local cache. It reduces provider traffic without
// turning a provider outage into a fabricated zero, and does not persist any secret.
const usageCache=new Map<string,UsageSnapshot>();
const USAGE_CACHE_MS=5*60*1000;
const USAGE_STALE_MS=15*60*1000;
const unavailableUsage=(name:string,scope:string,reason:string):UsageProvider=>({
  name,scope,status:'unavailable',used:null,limit:null,remaining:null,resetsAt:null,reason
});
const recordOf=(value:unknown):Record<string,unknown>|null=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
const usageNumber=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
const usageTime=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))?value:null;
const usageEnvironment=(env:Env)=>env.ENVIRONMENT==='production'?'production':env.ENVIRONMENT==='staging'?'staging':'unknown';
async function resendUsage(env:Env):Promise<UsageProvider>{
  if(!env.RESEND_USAGE_API_KEY)return unavailableUsage('Resend','account','A dedicated full-access usage credential has not been configured');
  try{
    const response=await fetch('https://api.resend.com/usage',{headers:{authorization:'Bearer '+env.RESEND_USAGE_API_KEY}});
    if(!response.ok){console.info('usage-provider-debug',JSON.stringify({provider:'resend',event:'http-error',status:response.status}));return unavailableUsage('Resend','account','The Resend usage service is currently unavailable');}
    const payload=recordOf(await response.json());
    const emails=recordOf(payload?.emails),daily=recordOf(emails?.daily);
    const used=usageNumber(daily?.used),limit=daily?.limit;
    if(used===null||(limit!==null&&usageNumber(limit)===null))return unavailableUsage('Resend','account','The Resend usage response did not contain a usable daily email quota');
    const confirmedLimit=limit===null?null:usageNumber(limit);
    return {
      name:'Resend',scope:'account · daily email quota',status:'available',used,limit:confirmedLimit,
      remaining:confirmedLimit===null?null:Math.max(0,confirmedLimit-used),resetsAt:usageTime(daily?.resets_at),
      reason:confirmedLimit===null?'No daily email cap on the current Resend plan':'Daily email usage across the Resend account'
    };
  }catch{console.info('usage-provider-debug',JSON.stringify({provider:'resend',event:'network-or-parse-error'}));return unavailableUsage('Resend','account','The Resend usage service could not be reached');}
}
const cloudflareUnavailable=(scope:string,reason:string):UsageProvider[]=>[
  unavailableUsage('Cloudflare Workers',scope,reason),
  unavailableUsage('Cloudflare D1 rows read',scope,reason),
  unavailableUsage('Cloudflare D1 rows written',scope,reason)
];
const nextUtcMidnight=(now:Date)=>new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1));
async function cloudflareUsage(env:Env):Promise<UsageProvider[]>{
  const environment=usageEnvironment(env),scope='Cloudflare account · current UTC day';
  const unavailable=cloudflareUnavailable(scope,'A read-only Cloudflare analytics credential has not been configured');
  if(!env.CLOUDFLARE_ANALYTICS_API_TOKEN||!env.USAGE_CLOUDFLARE_ACCOUNT_ID)return unavailable;
  const end=new Date(),start=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth(),end.getUTCDate())),resetAt=nextUtcMidnight(end).toISOString();
  const query=`query ServeWithUsage($accountTag: string!, $datetimeStart: string!, $datetimeEnd: string!, $start: Date, $end: Date) {
    viewer { accounts(filter: {accountTag: $accountTag}) {
      workersInvocationsAdaptive(limit: 10000, filter: {datetime_geq: $datetimeStart, datetime_leq: $datetimeEnd}) { sum { requests } }
      d1AnalyticsAdaptiveGroups(limit: 10000, filter: {date_geq: $start, date_leq: $end}) { sum { rowsRead rowsWritten } }
    } }
  }`;
  try{
    const response=await fetch('https://api.cloudflare.com/client/v4/graphql',{
      method:'POST',headers:{authorization:'Bearer '+env.CLOUDFLARE_ANALYTICS_API_TOKEN,'content-type':'application/json'},
      body:JSON.stringify({query,variables:{accountTag:env.USAGE_CLOUDFLARE_ACCOUNT_ID,datetimeStart:start.toISOString(),datetimeEnd:end.toISOString(),start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)}})
    });
    if(!response.ok){console.info('usage-provider-debug',JSON.stringify({provider:'cloudflare',event:'http-error',status:response.status,environment}));return cloudflareUnavailable(scope,'The Cloudflare analytics service is currently unavailable');}
    const payload=recordOf(await response.json());
    if(!payload||Array.isArray(payload.errors)&&payload.errors.length>0)return cloudflareUnavailable(scope,'Cloudflare analytics returned an incomplete or unsuccessful query');
    const data=recordOf(payload.data),viewer=recordOf(data?.viewer),accounts=viewer?.accounts;
    const account=Array.isArray(accounts)?recordOf(accounts[0]):null;
    const workerRows=account?.workersInvocationsAdaptive,d1Rows=account?.d1AnalyticsAdaptiveGroups;
    const workerRequests=Array.isArray(workerRows)?workerRows.reduce((total,row)=>total+(usageNumber(recordOf(recordOf(row)?.sum)?.requests)??0),0):null;
    const d1RowsRead=Array.isArray(d1Rows)?d1Rows.reduce((total,row)=>total+(usageNumber(recordOf(recordOf(row)?.sum)?.rowsRead)??0),0):null;
    const d1RowsWritten=Array.isArray(d1Rows)?d1Rows.reduce((total,row)=>total+(usageNumber(recordOf(recordOf(row)?.sum)?.rowsWritten)??0),0):null;
    if(workerRequests===null||d1RowsRead===null||d1RowsWritten===null)return cloudflareUnavailable(scope,'The Cloudflare analytics response did not contain usable account usage metrics');
    console.info('usage-provider-debug',JSON.stringify({provider:'cloudflare',event:'metrics-loaded',environment,workerRows:Array.isArray(workerRows)?workerRows.length:0,d1Rows:Array.isArray(d1Rows)?d1Rows.length:0}));
    return [
      {name:'Cloudflare Workers',scope,status:'available',used:workerRequests,limit:100000,remaining:Math.max(0,100000-workerRequests),resetsAt:resetAt,reason:'All Worker requests in this Cloudflare account; Workers Free daily limit'},
      {name:'Cloudflare D1 rows read',scope,status:'available',used:d1RowsRead,limit:5000000,remaining:Math.max(0,5000000-d1RowsRead),resetsAt:resetAt,reason:'All D1 rows read in this Cloudflare account; Workers Free daily limit'},
      {name:'Cloudflare D1 rows written',scope,status:'available',used:d1RowsWritten,limit:100000,remaining:Math.max(0,100000-d1RowsWritten),resetsAt:resetAt,reason:'All D1 rows written in this Cloudflare account; Workers Free daily limit'}
    ];
  }catch{console.info('usage-provider-debug',JSON.stringify({provider:'cloudflare',event:'network-or-parse-error',environment}));return cloudflareUnavailable(scope,'The Cloudflare analytics service could not be reached');}
}
const usageCacheKey=(env:Env)=>[
  usageEnvironment(env),env.USAGE_CLOUDFLARE_ACCOUNT_ID||'',
  env.CLOUDFLARE_ANALYTICS_API_TOKEN?'cloudflare-configured':'cloudflare-missing',
  env.RESEND_USAGE_API_KEY?'resend-configured':'resend-missing'
].join('|');
const staleProvider=(provider:UsageProvider):UsageProvider=>({
  ...provider,status:'stale',reason:'Last confirmed reading; the current provider request did not succeed'
});
async function usageSnapshot(env:Env):Promise<{collectedAt:string;providers:UsageProvider[]}>{
  const now=Date.now(),key=usageCacheKey(env),cached=usageCache.get(key);
  if(cached&&cached.expiresAt>now){
    console.info('usage-provider-debug',JSON.stringify({provider:'all',event:'cache-hit',environment:usageEnvironment(env)}));
    return {collectedAt:cached.collectedAt,providers:cached.providers};
  }
  const [cloudflare,resend]=await Promise.all([cloudflareUsage(env),resendUsage(env)]);
  const environment=usageEnvironment(env);
  const current:UsageProvider[]=[
    ...cloudflare,resend,
    unavailableUsage('Turnstile',environment+' widget','No supported programmatic Turnstile quota endpoint is configured')
  ];
  const canUseStale=Boolean(cached&&now-cached.expiresAt<USAGE_STALE_MS-USAGE_CACHE_MS);
  const providers=current.map(provider=>{
    if(provider.status==='available'||!canUseStale)return provider;
    const previous=cached?.providers.find(candidate=>candidate.name===provider.name&&candidate.status==='available');
    return previous?staleProvider(previous):provider;
  });
  const collectedAt=new Date().toISOString();
  if(current.some(provider=>provider.status==='available')){
    usageCache.set(key,{collectedAt,expiresAt:now+USAGE_CACHE_MS,providers:current});
  }
  console.info('usage-provider-debug',JSON.stringify({provider:'all',event:canUseStale?'refresh-with-stale-fallback':'refresh',environment,available:current.filter(provider=>provider.status==='available').length,stale:providers.filter(provider=>provider.status==='stale').length}));
  return {collectedAt,providers};
}

async function verifyTurnstile(request:Request,env:Env,token:unknown):Promise<boolean>{
  // The public site key enables Turnstile; missing secret is a hard failure, not a bypass.
  if (!env.TURNSTILE_SITE_KEY) return true; // Legacy environments remain unchanged until rollout.
  if (!env.TURNSTILE_SECRET_KEY || typeof token!=='string' || !token || token.length>2048) return false;
  try {
    const form=new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:token});
    const ip=request.headers.get('CF-Connecting-IP');
    if(ip)form.set('remoteip',ip);
    const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:form});
    if(!response.ok)return false;
    const result=await response.json() as {success?:boolean;hostname?:string;action?:string};
    return result.success===true&&result.hostname===new URL(request.url).hostname&&result.action==='request-login';
  }catch{return false;}
}
const allowed = new Set(admins.filter(a => a.enabled).map(a => a.email));
// SDDW-004 Batch 1: resolve identities only after an existing valid session or
// a consumed verification challenge; do not make profile/consent a gate yet.
async function resolveUser(db: D1Database, email: string, now: number): Promise<string> {
  const normalized = normalize(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) throw new Error('Invalid verified email');
  const existing=await db.prepare('SELECT id FROM users WHERE email=?').bind(normalized).first<{id:string}>();
  if(existing)return existing.id;
  const stub=await db.prepare('SELECT id FROM user_stubs WHERE email=?').bind(normalized).first<{id:string}>();
  // Registered users and user stubs share a stable participation identity.
  // Email ownership is verified before this method is called by OTP flow.
  await db.prepare('INSERT OR IGNORE INTO users(id,email,email_verified_at,created_at,updated_at) VALUES(?,?,?,?,?)')
    .bind(stub?.id||crypto.randomUUID(),normalized,now,now,now).run();
  const user=await db.prepare('SELECT id FROM users WHERE email=?').bind(normalized).first<{id:string}>();
  if(!user || (stub&&user.id!==stub.id))throw Error('Identity collision requires administrator review');
  return user.id;
}

const encoder = new TextEncoder();
const json = (body: unknown, status = 200, headers?: HeadersInit) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', ...headers } });
const normalize = (email: unknown) => typeof email === 'string' ? email.trim().toLowerCase() : '';
const random = (bytes = 32) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), n => n.toString(16).padStart(2, '0')).join('');
const digest = async (value: string, pepper: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(pepper + ':' + value))), n => n.toString(16).padStart(2, '0')).join('');
const cookie = (value: string, age: number) => `__Host-sw_session=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${age}`;
const originOk = (request: Request) => request.headers.get('origin') === new URL(request.url).origin;
const error = () => json({ error: 'Unable to complete request' }, 400);
const WINDOW = 10 * 60 * 1000;
const bucket = (now: number) => Math.floor(now / WINDOW);
async function allowRate(db: D1Database, pepper: string, dimension: string, identity: string, limit: number, now: number): Promise<boolean> {
  const key = await digest(dimension + ':' + identity, pepper);
  const result = await db.prepare(
    'INSERT INTO auth_rate_limits(key, window, count) VALUES (?, ?, 1) ON CONFLICT(key, window) DO UPDATE SET count=count+1 WHERE count < ?'
  ).bind(key, bucket(now), limit).run();
  return result.meta.changes === 1;
}
async function withinLimits(request: Request, db: D1Database, pepper: string, email: string, action: string, now: number) {
  // Cloudflare sets CF-Connecting-IP at the edge. Missing addresses share a conservative fallback bucket.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  // Both gates are charged on each request. This blocks flooding across many addresses.
  const ipAllowed = await allowRate(db, pepper, action + ':ip', ip, action === 'request' ? 12 : 40, now);
  const emailAllowed = await allowRate(db, pepper, action + ':email', email, action === 'request' ? 3 : 12, now);
  return ipAllowed && emailAllowed;
}
const bodyOf = async (request: Request): Promise<Record<string, unknown>> => {
  if ((Number(request.headers.get('content-length') || 0) > 2048) || !request.headers.get('content-type')?.startsWith('application/json')) throw new Error('Bad body');
  const body: unknown = await request.json();
  if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error('Bad body');
  return body as Record<string, unknown>;
};

type EventFields = { title: string; location: string; timezone: string; start_at: number; end_at: number; capacity: number|null };
function eventInput(body: Record<string,unknown>): { event?: EventFields; errors?: Record<string,string> } {
  const errors: Record<string,string> = {};
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const location = typeof body.location === 'string' ? body.location.trim() : '';
  const timezone = typeof body.timezone === 'string' ? body.timezone : '';
  if (!title || title.length > 200) errors.title = 'Title must contain 1–200 characters';
  if (!location || location.length > 500) errors.location = 'Location must contain 1–500 characters';
  if (!timezone || timezone.length > 100) errors.timezone = 'Select a valid IANA time zone';
  const capacity=body.capacity===undefined||body.capacity===null||body.capacity===''?null:body.capacity;
  if(capacity!==null&&(!Number.isSafeInteger(capacity)||(capacity as number)<0))errors.capacity='Capacity must be a nonnegative whole number';
  const resolve = (field: 'start'|'end'): number | undefined => {
    const value = body[field];
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
      errors[field] = 'Enter a valid local date and time';
      return undefined;
    }
    try {
      const plain = Temporal.PlainDateTime.from(value);
      const zoned = plain.toZonedDateTime(timezone, { disambiguation: 'reject' });
      return zoned.epochMilliseconds;
    } catch {
      errors[field] = 'Invalid or ambiguous local time for this time zone';
      return undefined;
    }
  };
  const start = resolve('start');
  const end = resolve('end');
  if (start !== undefined && end !== undefined && end <= start) errors.end = 'End must be after start';
  return Object.keys(errors).length ? { errors } : { event: { title, location, timezone, start_at: start!, end_at: end!, capacity: capacity as number|null } };
}

async function sendEmail(env: Env, email: string, code: string, link: string): Promise<boolean> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'authorization': `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.AUTH_FROM_EMAIL, to: [email], subject: 'Sign in to Serve With', text: `Click this link to sign in to Serve With:\n${link}\n\nOr enter this eight-digit verification code on the sign-in page you opened earlier:\n${code}\n\nThe link and code expire in 10 minutes. If you did not request this email, you can safely ignore it.` }),
  });
  if (!response.ok) {
    // Avoid logging the request payload, email recipient, OTP, magic link, API key, or raw provider response.
    let providerCode = 'unknown';
    try {
      const errorBody: unknown = await response.json();
      if (errorBody && typeof errorBody === 'object' && 'name' in errorBody &&
        typeof errorBody.name === 'string' && /^[a-z_]{1,64}$/.test(errorBody.name)) {
        providerCode = errorBody.name;
      }
    } catch { /* The status alone is sufficient to diagnose transport-level errors. */ }
    console.error('auth.email.provider_failure', { provider: 'resend', httpStatus: response.status, code: providerCode });
  }
  return response.ok;
}

type UserRow = {
  id: string; email: string; first_name: string | null; last_name: string | null;
  email_verified_at: number | null;
  terms_accepted_at: number | null; accepted_terms_version: string | null; accepted_privacy_version: string | null;
};
type Subject = { user: UserRow; admin: boolean };
const sessionTokenHash = async (request: Request, env: Env): Promise<string | null> => {
  const match = request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-sw_session=([a-f0-9]{64})(?:;|$)/);
  return match && env.AUTH_PEPPER ? digest(match[1], env.AUTH_PEPPER) : null;
};
async function sessionSubject(request: Request, env: Env): Promise<Subject | null> {
  if (!env.AUTH_DB) return null;
  const hash = await sessionTokenHash(request, env);
  if (!hash) return null;
  const now = Date.now(), db = env.AUTH_DB;
  const session = await db.prepare('SELECT email,user_id FROM sessions WHERE token_hash=? AND expires_at>?')
    .bind(hash,now).first<{email:string;user_id:string|null}>();
  if (!session) return null;
  const email = normalize(session.email);
  const id = session.user_id || await resolveUser(db,email,now);
  if (!session.user_id) await db.prepare('UPDATE sessions SET user_id=? WHERE token_hash=? AND user_id IS NULL AND expires_at>?')
    .bind(id,hash,now).run();
  const user = await db.prepare('SELECT id,email,first_name,last_name,email_verified_at,terms_accepted_at,accepted_terms_version,accepted_privacy_version FROM users WHERE id=?')
    .bind(id).first<UserRow>();
  if (!user || normalize(user.email) !== email) return null;
  return {user,admin:allowed.has(email)};
}
const policyVersions = (_env: Env) => ({terms:policyMetadata.terms.version,privacy:policyMetadata.privacy.version});
const profileReady = (u: UserRow) => Boolean(u.first_name && u.last_name);
const agreementReady = (u: UserRow, versions: {terms:string;privacy:string}|null) =>
  Boolean(versions && u.terms_accepted_at && u.accepted_terms_version === versions.terms && u.accepted_privacy_version === versions.privacy);
const privilegeReady = (subject: Subject, env: Env) => Boolean(subject.user.email_verified_at && profileReady(subject.user) && agreementReady(subject.user,policyVersions(env)));
const registrationEligible = (email: string, env: Env) => allowed.has(email) || isStagingRegistrationEligible(email,env,allowed);
async function loginEligible(email:string,env:Env,db:D1Database):Promise<boolean>{
 if(registrationEligible(email,env))return true;
 if(!email)return false;
 // A verified-email claimant may use the same normal OTP flow to claim
 // a matching unclaimed stub; names are deliberately never claim keys.
 const stub=await db.prepare('SELECT id FROM user_stubs WHERE email=?').bind(email).first();
 return Boolean(stub);
}

const validName = (x: unknown): x is string => typeof x === 'string' && x.trim().length >= 1 && x.trim().length <= 100;
async function legacyFetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === '/api/events') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
      if (!env.AUTH_DB) return json({ error: 'Service unavailable' }, 503);
      const view = url.searchParams.get('view') || 'upcoming';
      if (view !== 'upcoming' && view !== 'past') return json({ error: 'Invalid event view' }, 400);
      const now = Date.now();
      const comparison = view === 'upcoming' ? '>' : '<=';
      const direction = view === 'upcoming' ? 'ASC' : 'DESC';
      const events = await env.AUTH_DB.prepare(
        `SELECT e.id,e.title,e.location,e.timezone,e.start_at,e.end_at,e.version,e.capacity,
          (SELECT COUNT(*) FROM event_signups s WHERE s.event_id=e.id AND s.deleted_at IS NULL) AS signups_count
         FROM events e WHERE e.deleted_at IS NULL AND e.end_at ${comparison} ?
         ORDER BY e.start_at ${direction}, e.id ${direction}`
      ).bind(now).all<{id:string;title:string;location:string;timezone:string;start_at:number;end_at:number;version:number;capacity:number|null;signups_count:number}>();
      return json({view,events:events.results.map(e=>({...e,spots_available:e.capacity===null?null:Math.max(0,e.capacity-e.signups_count)}))});
    }
    // SDDW-006 participation: all decisions are rechecked at the write instant.
    if (path === '/api/me/signups' || /^\/api\/events\/[0-9a-f-]{36}\/signups$/.test(path)) {
      if (!env.AUTH_DB || !env.AUTH_PEPPER) return json({error:'Service unavailable'},503);
      const subject=await sessionSubject(request,env);
      if (!subject) return json({error:'Authentication required'},401);
      if (!privilegeReady(subject,env)) return json({error:'Profile or current agreement required',code:'account_completion_required'},403);
      const db=env.AUTH_DB, now=Date.now();
      if (path === '/api/me/signups') {
        if (request.method!=='GET') return json({error:'Method not allowed'},405);
        const rows=await db.prepare(`SELECT s.id,s.event_id,s.created_at,s.deleted_at,e.title,e.start_at,e.end_at,e.location,e.timezone,e.capacity,
          (SELECT COUNT(*) FROM event_signups active WHERE active.event_id=s.event_id AND active.deleted_at IS NULL) AS signups_count
          FROM event_signups s JOIN events e ON e.id=s.event_id WHERE s.user_id=?
          ORDER BY s.created_at DESC,s.id DESC`).bind(subject.user.id).all();
        return json({signups:rows.results});
      }
      const eventId=path.slice('/api/events/'.length,-'/signups'.length);
      const event=await db.prepare('SELECT id,start_at,deleted_at,capacity FROM events WHERE id=?').bind(eventId)
        .first<{id:string;start_at:number;deleted_at:number|null;capacity:number|null}>();
      if (!event || event.deleted_at!==null) return json({error:'Event not found'},404);
      if (request.method==='GET') {
        const record=await db.prepare('SELECT id,created_at FROM event_signups WHERE event_id=? AND user_id=? AND deleted_at IS NULL')
          .bind(eventId,subject.user.id).first();
        return json({signup:record});
      }
      if (request.method!=='POST' && request.method!=='DELETE') return json({error:'Method not allowed'},405);
      if (!originOk(request) || request.headers.get('sec-fetch-site')==='cross-site') return error();
      if (now>=event.start_at) return json({error:'Signups are closed'},409);
      if (request.method==='DELETE') {
        try {
          const removed=await db.prepare('UPDATE event_signups SET deleted_at=? WHERE event_id=? AND user_id=? AND deleted_at IS NULL')
            .bind(now,eventId,subject.user.id).run();
          return json({withdrawn:removed.meta.changes===1});
        } catch {
          // The D1 cutoff trigger can reject an in-flight write after our
          // precheck. Return an explicit conflict instead of an unhandled error.
          return json({error:'Withdrawals are closed',code:'withdrawal_conflict'},409);
        }
      }
      const existing=await db.prepare('SELECT id FROM event_signups WHERE event_id=? AND user_id=? AND deleted_at IS NULL')
        .bind(eventId,subject.user.id).first();
      if (existing) return json({error:'Already signed up',code:'already_signed_up'},409);
      try {
        // A single INSERT, guarded by database triggers and the partial unique
        // index, serializes capacity and duplicate checks across Worker requests.
        const id=crypto.randomUUID();
        await db.prepare('INSERT INTO event_signups(id,event_id,user_id,created_at) VALUES(?,?,?,?)')
          .bind(id,eventId,subject.user.id,now).run();
        return json({signup:{id,eventId,createdAt:now}},201);
      } catch {
        return json({error:'Signup unavailable or event full',code:'signup_conflict'},409);
      }
    }
    if (/^\/api\/events\/[0-9a-f-]{36}\/participants$/.test(path)) {
      if(request.method!=='GET') return json({error:'Method not allowed'},405);
      if(!env.AUTH_DB||!env.AUTH_PEPPER)return json({error:'Service unavailable'},503);
      const subject=await sessionSubject(request,env);
      if(!subject)return json({error:'Authentication required'},401);
      if(!privilegeReady(subject,env))return json({error:'Profile or current agreement required',code:'account_completion_required'},403);
      const eventId=path.slice('/api/events/'.length,-'/participants'.length);
      const event=await env.AUTH_DB.prepare('SELECT id FROM events WHERE id=? AND deleted_at IS NULL')
        .bind(eventId).first();
      if(!event)return json({error:'Event not found'},404);
      const active=await env.AUTH_DB.prepare('SELECT id FROM event_signups WHERE event_id=? AND user_id=? AND deleted_at IS NULL')
        .bind(eventId,subject.user.id).first();
      if(!active)return json({error:'Active signup required'},403);
      const rows=await env.AUTH_DB.prepare(`SELECT COALESCE(u.first_name,stub.first_name) AS first_name,
          COALESCE(u.last_name,stub.last_name) AS last_name
        FROM event_signups s LEFT JOIN users u ON u.id=s.user_id
        LEFT JOIN user_stubs stub ON stub.id=s.user_id
        WHERE s.event_id=? AND s.deleted_at IS NULL
        ORDER BY COALESCE(u.last_name,stub.last_name),COALESCE(u.first_name,stub.first_name),s.id`).bind(eventId)
        .all<{first_name:string|null;last_name:string|null}>();
      return json({participants:rows.results.map(row=>({
        name:[row.first_name,row.last_name].filter(Boolean).join(' ').trim()||'Unnamed participant'
      }))});
    }
    // Canonical event details remain anonymously accessible.
    if (path.startsWith('/api/events/')) {
      if (request.method !== 'GET') return json({error:'Method not allowed'},405);
      if (!env.AUTH_DB) return json({error:'Service unavailable'},503);
      const id=path.slice('/api/events/'.length);
      if (!/^[0-9a-f-]{36}$/.test(id)) return json({error:'Event not found'},404);
      const event=await env.AUTH_DB.prepare(`SELECT e.id,e.title,e.location,e.timezone,e.start_at,e.end_at,e.version,e.capacity,e.created_at,
        (SELECT COUNT(*) FROM event_signups s WHERE s.event_id=e.id AND s.deleted_at IS NULL) AS signups_count
        FROM events e WHERE e.id=? AND e.deleted_at IS NULL`).bind(id)
        .first<{capacity:number|null;signups_count:number}>();
      return event ? json({event:{...event,spots_available:event.capacity===null?null:Math.max(0,event.capacity-event.signups_count)}}) : json({error:'Event not found'},404);
    }
    if (path.startsWith('/api/users/')) {
      if (!env.AUTH_DB || !env.AUTH_PEPPER) return json({error:'Service unavailable'},503);
      const subject=await sessionSubject(request,env);
      if (!subject) return json({error:'Authentication required'},401);
      if (!privilegeReady(subject,env)) return json({error:'Profile or current agreement required',code:'account_completion_required'},403);
      const id=path.slice('/api/users/'.length);
      if (!/^[0-9a-f-]{36}$/.test(id)) return json({error:'Not found'},404);
      if (!subject.admin && subject.user.id!==id) return json({error:'Not found'},404);
      const target=await env.AUTH_DB.prepare('SELECT id,email,first_name,last_name,email_verified_at,created_at,updated_at FROM users WHERE id=?').bind(id).first();
      // Unclaimed attendee identities are stored separately from verified users.
      // Never expose a stub to a non-administrator or after it has been claimed.
      const stub=!target&&subject.admin
        ?await env.AUTH_DB.prepare('SELECT id,email,first_name,last_name,created_at,updated_at FROM user_stubs WHERE id=? AND claimed_at IS NULL').bind(id).first()
        :null;
      if (!target&&!stub) return json({error:'Not found'},404);
      if (request.method==='GET') return json({user:target||stub,canCorrectDob:subject.admin&&!!target,isStub:!!stub});
      if (request.method!=='PUT') return json({error:'Method not allowed'},405);
      if (!originOk(request) || request.headers.get('sec-fetch-site')==='cross-site') return error();
      try {
        const body=await bodyOf(request);
        if (!validName(body.firstName)||!validName(body.lastName)) return json({error:'Invalid name'},422);
        if (stub) {
          if ('dateOfBirth' in body) return json({error:'Date of birth is no longer collected'},422);
          if (!validateOperationBody('updateUser',{firstName:body.firstName.trim(),lastName:body.lastName.trim()}))
            return json({error:'Invalid user'},422);
          const result=await env.AUTH_DB.prepare(
            'UPDATE user_stubs SET first_name=?,last_name=?,updated_at=? WHERE id=? AND claimed_at IS NULL'
          ).bind(body.firstName.trim(),body.lastName.trim(),Date.now(),id).run();
          if(result.meta.changes!==1)return json({error:'Attendee has been claimed or changed'},409);
          return json({saved:true});
        }
        if ('dateOfBirth' in body) return json({error:'Date of birth is no longer collected'},422);
        if(!validateOperationBody('updateUser',{
          firstName:(body.firstName as string).trim(),lastName:(body.lastName as string).trim()
        }))return json({error:'Invalid user'},422);
        await env.AUTH_DB.prepare('UPDATE users SET first_name=?,last_name=?,updated_at=? WHERE id=?')
          .bind(body.firstName.trim(),body.lastName.trim(),Date.now(),id).run();
        return json({saved:true});
      } catch {return error();}
    }
    if (path.startsWith('/api/admin/')) {
      if (!env.AUTH_DB || !env.AUTH_PEPPER) return json({ error: 'Service unavailable' }, 503);
      const subject = await sessionSubject(request, env);
      if (!subject) return json({ error: 'Authentication required' }, 401);
      if (!subject.admin) return json({ error: 'Forbidden' }, 403);
      if (!privilegeReady(subject,env)) return json({ error: 'Profile or current agreement required', code: 'account_completion_required' }, 403);
      const email = subject.user.email;
      if(path==='/api/admin/usage'){
        if(request.method!=='GET')return json({error:'Method not allowed'},405);
        const environment=env.ENVIRONMENT==='production'?'production':env.ENVIRONMENT==='staging'?'staging':'unknown';
        // Provider integrations must fail closed: never substitute zero for an
        // unavailable reading, and never use deployment or sending credentials.
        const usage=await usageSnapshot(env),providers=usage.providers;
        // Safe operational diagnostics: never log request cookies, credentials,
        // account IDs, emails, or provider response bodies.
        console.info('usage-provider-status',JSON.stringify({environment,providerCount:providers.length,available:providers.filter(provider=>provider.status==='available').map(provider=>provider.name)}));
        return json({environment,collectedAt:usage.collectedAt,providers});
      }

      const adminSignupMatch=path.match(/^\/api\/admin\/events\/([0-9a-f-]{36})\/signups$/);
      if (adminSignupMatch) {
        const eventId=adminSignupMatch[1],db=env.AUTH_DB,now=Date.now();
        const event=await db.prepare('SELECT id,start_at,deleted_at FROM events WHERE id=?').bind(eventId)
          .first<{id:string;start_at:number;deleted_at:number|null}>();
        if(!event||event.deleted_at!==null)return json({error:'Event not found'},404);
        if(request.method==='GET'){
          const rows=await db.prepare(`SELECT s.id,s.user_id,s.created_at,s.deleted_at,COALESCE(u.first_name,stub.first_name) AS first_name,COALESCE(u.last_name,stub.last_name) AS last_name,COALESCE(u.email,stub.email) AS email
            FROM event_signups s LEFT JOIN users u ON u.id=s.user_id
            LEFT JOIN user_stubs stub ON stub.id=s.user_id WHERE s.event_id=?
            ORDER BY s.created_at DESC,s.id DESC`).bind(eventId).all();
          return json({signups:rows.results});
        }
        if(request.method!=='POST'&&request.method!=='DELETE')return json({error:'Method not allowed'},405);
        if(!originOk(request)||request.headers.get('sec-fetch-site')==='cross-site')return error();
        if(now>=event.start_at)return json({error:'Signups are closed'},409);
        let body:Record<string,unknown>;
        try{body=await bodyOf(request)}catch{return error()}
        const userId=body.userId;
        if(typeof userId!=='string'||!/^[0-9a-f-]{36}$/.test(userId))return json({error:'Invalid attendee'},422);
        // Keep legacy input tolerance, but verify the canonical attendee selection
        // with the same OpenAPI-derived schema used to generate the client.
        if(!validateOperationBody(request.method==='POST'?'adminSignUpAttendee':'adminWithdrawAttendee',{userId}))
          return json({error:'Invalid attendee'},422);
        const target=await db.prepare(`SELECT id,email,first_name,last_name,email_verified_at,
          terms_accepted_at,accepted_terms_version,accepted_privacy_version FROM users WHERE id=?`)
          .bind(userId).first<UserRow>();
        const stub=await db.prepare('SELECT id FROM user_stubs WHERE id=? AND claimed_at IS NULL')
          .bind(userId).first();
        if(!target&&!stub)return json({error:'Attendee not found'},404);
        if(request.method==='POST'&&!stub&&
            !(target?.email_verified_at&&profileReady(target)&&agreementReady(target,policyVersions(env))))
          return json({error:'Attendee account not eligible'},403);
        if(request.method==='DELETE'){
          try {
            const result=await db.prepare('UPDATE event_signups SET deleted_at=? WHERE event_id=? AND user_id=? AND deleted_at IS NULL')
              .bind(now,eventId,userId).run();
            return json({withdrawn:result.meta.changes===1});
          } catch {
            return json({error:'Withdrawals are closed',code:'withdrawal_conflict'},409);
          }
        }
        const existing=await db.prepare('SELECT id FROM event_signups WHERE event_id=? AND user_id=? AND deleted_at IS NULL')
          .bind(eventId,userId).first();
        if(existing)return json({error:'Already signed up'},409);
        const id=crypto.randomUUID();
        try{
          await db.prepare('INSERT INTO event_signups(id,event_id,user_id,created_at) VALUES(?,?,?,?)')
            .bind(id,eventId,userId,now).run();
          return json({signup:{id,eventId,userId,createdAt:now}},201);
        }catch{return json({error:'Signup unavailable or event full',code:'signup_conflict'},409)}
      }
      if (path === '/api/admin/users') {
        if(request.method==='POST'){
          if(!originOk(request)||request.headers.get('sec-fetch-site')==='cross-site')return error();
          let body:Record<string,unknown>;
          try{body=await bodyOf(request)}catch{return error()}
          if(!validName(body.firstName)||!validName(body.lastName))return json({error:'First and last names required'},422);
          const submittedEmail=body.email;
          const emailValue=submittedEmail===undefined||submittedEmail===null||submittedEmail===''?null:normalize(submittedEmail);
          if(emailValue!==null&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)||emailValue.length>254))
            return json({error:'Invalid email'},422);
          if ('dateOfBirth' in body) return json({error:'Date of birth is no longer collected'},422);
          if(!validateOperationBody('createAdminUserStub',{
            firstName:(body.firstName as string).trim(),lastName:(body.lastName as string).trim(),email:emailValue
          }))return json({error:'Invalid user'},422);
          const id=crypto.randomUUID(),now=Date.now();
          try{
            if(emailValue!==null){
              const collision=await env.AUTH_DB.prepare('SELECT id FROM users WHERE email=?').bind(emailValue).first();
              if(collision)return json({error:'Email is already registered'},409);
            }
            await env.AUTH_DB.batch([
              env.AUTH_DB.prepare('INSERT INTO participation_identities(id) VALUES(?)').bind(id),
              env.AUTH_DB.prepare(`INSERT INTO user_stubs
                (id,email,first_name,last_name,created_at,updated_at)
                VALUES(?,?,?,?,?,?)`).bind(id,emailValue,body.firstName.trim(),body.lastName.trim(),now,now)
            ]);
          }catch{return json({error:'Unable to create user; email may already be in use'},409)}
          return json({user:{id,email:emailValue,firstName:body.firstName.trim(),lastName:body.lastName.trim(),isStub:true}},201);
        }
        if (request.method!=='GET') return json({error:'Method not allowed'},405);
        const sort=url.searchParams.get('sort')==='first'?'first_name':'last_name';
        const direction=url.searchParams.get('direction')==='desc'?'DESC':'ASC';
        const letter=(url.searchParams.get('letter')||'').trim().toUpperCase();
        if (letter && !/^[A-Z]$/.test(letter)) return json({error:'Invalid letter'},400);
        const query=(url.searchParams.get('q')||'').trim().toLowerCase().slice(0,100);
        const offset=Number(url.searchParams.get('offset')||'0');
        if (!Number.isSafeInteger(offset) || offset<0 || offset>100000) return json({error:'Invalid offset'},400);
        const search='%'+query.replace(/[\\%_]/g,x=>'\\'+x)+'%';
        const rows=await env.AUTH_DB.prepare(`SELECT id,first_name,last_name,email FROM
          (SELECT id,first_name,last_name,email FROM users
           UNION ALL SELECT id,first_name,last_name,email FROM user_stubs WHERE claimed_at IS NULL) users
          WHERE (?='' OR lower(first_name) LIKE ? ESCAPE '\\' OR lower(last_name) LIKE ? ESCAPE '\\'
            OR lower(trim(coalesce(first_name,'')||' '||coalesce(last_name,''))) LIKE ? ESCAPE '\\'
            OR email LIKE ? ESCAPE '\\')
            AND (?='' OR upper(substr(coalesce(${sort},''),1,1))=?)
          ORDER BY ${sort} ${direction}, id ASC LIMIT 51 OFFSET ?`)
          .bind(query,search,search,search,search,letter,letter,offset).all<{id:string;first_name:string|null;last_name:string|null;email:string}>();
        return json({users:rows.results.slice(0,50),hasMore:rows.results.length>50,nextOffset:offset+Math.min(rows.results.length,50)});
      }
      if (request.method === 'GET' && path === '/api/admin/dashboard') return json({ email, message: 'Admin dashboard ready' });
      if (path === '/api/admin/events') {
        if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
        if (!originOk(request) || request.headers.get('sec-fetch-site') === 'cross-site') return error();
        let body: Record<string,unknown>;
        try { body = await bodyOf(request); } catch { return error(); }
        const result = eventInput(body);
        if (!result.event) return json({ error: 'Invalid event', fields: result.errors }, 422);
        const event = result.event;
        // Existing business validation and normalization run first; this
        // YAML-derived schema check guards the canonical request representation.
        // Authorization and same-origin checks have already succeeded.
        if (!validateOperationBody('createAdminEvent', {
          title:event.title,location:event.location,timezone:event.timezone,
          start:body.start,end:body.end
        })) return json({error:'Invalid event',fields:{}},422);
        const now = Date.now(), id = crypto.randomUUID();
        await env.AUTH_DB.prepare('INSERT INTO events (id,title,location,timezone,start_at,end_at,created_at,updated_at,version,capacity) VALUES (?,?,?,?,?,?,?,?,1,?)')
          .bind(id,event.title,event.location,event.timezone,event.start_at,event.end_at,now,now,event.capacity).run();
        return json({ event: {id,...event,version:1} },201);
      }
      if (path.startsWith('/api/admin/events/')) {
        if (request.method !== 'DELETE' && request.method !== 'PUT') return json({ error: 'Method not allowed' }, 405);
        if (!originOk(request) || request.headers.get('sec-fetch-site') === 'cross-site') return error();
        const id = path.slice('/api/admin/events/'.length);
        if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: 'Event not found' }, 404);
        let body: Record<string,unknown>;
        try { body = await bodyOf(request); } catch { return error(); }
        if (!Number.isSafeInteger(body.version) || (body.version as number) < 1) return json({ error: 'Valid event version required' }, 422);
        const existing = await env.AUTH_DB.prepare('SELECT version,capacity FROM events WHERE id=? AND deleted_at IS NULL').bind(id).first<{version:number;capacity:number|null}>();
        if (!existing) return json({ error: 'Event not found' }, 404);
        if (request.method === 'PUT') {
          const validated = eventInput(body);
          if (!validated.event) return json({ error: 'Invalid event', fields: validated.errors }, 422);
          const event = validated.event;
          // Preserve legacy event-input normalization while enforcing the generated
          // canonical update schema after authorization and business validation.
          if (!validateOperationBody('updateAdminEvent', {
            title:event.title,location:event.location,timezone:event.timezone,
            start:body.start,end:body.end,version:body.version,
            ...(body.capacity===undefined?{}:{capacity:event.capacity})
          })) return json({error:'Invalid event',fields:{}},422);
          const now = Date.now();
          const capacity=body.capacity===undefined?existing.capacity:event.capacity;
          let updated;
          try {
            updated=await env.AUTH_DB.prepare(
              'UPDATE events SET title=?,location=?,timezone=?,start_at=?,end_at=?,capacity=?,updated_at=?,version=version+1 WHERE id=? AND version=? AND deleted_at IS NULL'
            ).bind(event.title,event.location,event.timezone,event.start_at,event.end_at,capacity,now,id,body.version).run();
          } catch {
            return json({error:'Capacity cannot be below active signups',fields:{capacity:'Current signups exceed this capacity'}},409);
          }
          if (updated.meta.changes !== 1) return json({ error: 'Event changed since you opened it', code: 'version_conflict' }, 409);
          return json({ event: { id,...event,capacity,version:(body.version as number)+1 } });
        }
        if(!validateOperationBody('deleteAdminEvent',{version:body.version}))
          return json({error:'Valid event version required'},422);
        const now = Date.now();
        const result = await env.AUTH_DB.prepare('UPDATE events SET deleted_at=?,updated_at=?,version=version+1 WHERE id=? AND version=? AND deleted_at IS NULL')
          .bind(now,now,id,body.version).run();
        if (result.meta.changes !== 1) return json({ error: 'Event changed since you opened it', code: 'version_conflict' }, 409);
        return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
      }
      return json({ error: 'Not found' }, 404);
    }
    if (path === '/api/docs') return Response.redirect(new URL('/api/docs/', request.url), 308);
    if (!path.startsWith('/api/auth/')) {
      // Render the SPA for canonical deep links; retain ordinary asset handling.
      const spaRoute = request.method === 'GET' && (
        path === '/terms' || path === '/privacy' || path === '/login' || path === '/admin' || path === '/admin/events' || path === '/admin/users' ||
        path === '/admin/events/new' || path === '/admin/users/new' || path === '/admin/usage' || path === '/my-signups' ||
        /^\/admin\/events\/[0-9a-f-]{36}(?:\/edit)?$/.test(path) ||
        /^\/users\/[0-9a-f-]{36}(?:\/edit)?$/.test(path) ||
        /^\/events\/[0-9a-f-]{36}$/.test(path)
      );
      const assetRequest = spaRoute ? new Request(new URL('/',request.url),request) : request;
      const response = await env.ASSETS.fetch(assetRequest);
      const headers = new Headers(response.headers);
      headers.set('Referrer-Policy', 'no-referrer');
      headers.set('X-Content-Type-Options', 'nosniff');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }
    if (request.method === 'GET' && path === '/api/auth/turnstile-config') return json({siteKey:env.TURNSTILE_SITE_KEY||null});
    if (!env.AUTH_DB || !env.AUTH_PEPPER) return json({ error: 'Sign-in is not configured' }, 503);
    const db = env.AUTH_DB;
    if (request.method === 'GET' && path === '/api/auth/me') {
      const subject = await sessionSubject(request, env);
      if (!subject) return json({ authenticated: false, email: null });
      const {user,admin} = subject;
      return json({ authenticated:true, email:user.email, userId:user.id,
        firstName:user.first_name, lastName:user.last_name, emailVerified:Boolean(user.email_verified_at),
        profileComplete:profileReady(user), agreementCurrent:agreementReady(user,policyVersions(env)),
        administratorEligible:admin, privileged:privilegeReady(subject,env), requiredVersions:policyVersions(env) });
    }
    if (request.method !== 'POST' || !originOk(request) || request.headers.get('sec-fetch-site') === 'cross-site') return error();
    try {
      const body = await bodyOf(request);
      if (path === '/api/auth/profile') {
        const subject = await sessionSubject(request, env);
        if (!subject || !subject.user.email_verified_at) return json({ error:'Authentication required' },401);
        if (!validName(body.firstName) || !validName(body.lastName)) return json({error:'Invalid profile'},422);
        if ('dateOfBirth' in body) return json({error:'Date of birth is no longer collected'},422);
        if(!validateOperationBody('completeProfile',{
          firstName:(body.firstName as string).trim(),lastName:(body.lastName as string).trim()
        }))return json({error:'Invalid profile'},422);
        const now=Date.now(), u=subject.user;
        const result=await db.prepare('UPDATE users SET first_name=?,last_name=?,updated_at=? WHERE id=? AND (first_name IS NULL OR last_name IS NULL)')
          .bind(body.firstName.trim(),body.lastName.trim(),now,u.id).run();
        if (result.meta.changes !== 1) return json({error:'Profile already initialized'},409);
        return json({ profileComplete:true });
      }
      if (path === '/api/auth/agreements') {
        const subject=await sessionSubject(request,env);
        if (!subject || !subject.user.email_verified_at) return json({error:'Authentication required'},401);
        if (!profileReady(subject.user)) return json({error:'Complete profile first'},403);
        const versions=policyVersions(env);
        if (!versions) return json({error:'Required policies unavailable'},503);
        if (body.accepted !== true || body.termsVersion !== versions.terms || body.privacyVersion !== versions.privacy)
          return json({error:'Current policy versions required', requiredVersions:versions},409);
        // Check the canonical accepted versions against the generated body schema
        // only after authenticated profile and current-policy consent checks.
        if(!validateOperationBody('acceptAgreements',{
          accepted:body.accepted,termsVersion:body.termsVersion,privacyVersion:body.privacyVersion
        }))return json({error:'Invalid agreement request'},422);
        const now=Date.now(), id=crypto.randomUUID(), userId=subject.user.id;
        // D1 batch commits both statements transactionally or rolls both back.
        await db.batch([
          db.prepare('INSERT INTO agreement_acceptances(id,user_id,terms_version,privacy_version,accepted_at) VALUES(?,?,?,?,?)')
            .bind(id,userId,versions.terms,versions.privacy,now),
          db.prepare('UPDATE users SET terms_accepted_at=?,accepted_terms_version=?,accepted_privacy_version=?,updated_at=? WHERE id=?')
            .bind(now,versions.terms,versions.privacy,now,userId),
          db.prepare('UPDATE user_stubs SET claimed_at=?,updated_at=? WHERE id=? AND claimed_at IS NULL')
            .bind(now,now,userId)
        ]);
        return json({agreementCurrent:true});
      }
      if (path === '/api/auth/request') {
        if (!await verifyTurnstile(request,env,body.turnstileToken)) return json({error:'Verification required. Please retry the security check.'},403);
        const email = normalize(body.email);
        const generic = json({ message: 'If this account is authorized, a sign-in email will arrive shortly.' });
        const now = Date.now();
        const withinRate = await withinLimits(request, db, env.AUTH_PEPPER, email || 'invalid', 'request', now);
        if (!withinRate || !await loginEligible(email,env,db)) return generic;
        // Invalid sign-in requests receive the same generic response as unknown
        // accounts; schema details must never become an enumeration signal.
        if(!validateOperationBody('requestSignIn',{
          email,...(typeof body.turnstileToken==='string'?{turnstileToken:body.turnstileToken}:{})
        }))return generic;
        if (!env.RESEND_API_KEY || !env.AUTH_FROM_EMAIL) return json({error:'Email service unavailable'},503);
        const count = await db.prepare('SELECT COUNT(*) AS n FROM login_challenges WHERE email=? AND created_at>?').bind(email, now - 3600000).first<{ n: number }>();
        if ((count?.n || 0) >= 5) return generic;
        // Rejection sampling avoids modulo bias in the eight-digit OTP.
        const limit = Math.floor(4294967296 / 100000000) * 100000000;
        let value: number;
        do { value = crypto.getRandomValues(new Uint32Array(1))[0]; } while (value >= limit);
        const code = String(value % 100000000).padStart(8, '0');
        const token = random();
        const codeHash = await digest(email + ':' + code, env.AUTH_PEPPER);
        const tokenHash = await digest(token, env.AUTH_PEPPER);
        const id = crypto.randomUUID();
        // An issued replacement invalidates earlier outstanding challenges.
        await db.prepare('UPDATE login_challenges SET consumed_at=? WHERE email=? AND consumed_at IS NULL').bind(now,email).run();
        await db.prepare('INSERT INTO login_challenges(id,email,code_hash,link_hash,expires_at,created_at,attempts) VALUES(?,?,?,?,?,?,0)').bind(id,email,codeHash,tokenHash,now+600000,now).run();
        const link = `${url.origin}/?magic=${encodeURIComponent(token)}`;
        if (!await sendEmail(env,email,code,link)) {
          await db.prepare('DELETE FROM login_challenges WHERE id=?').bind(id).run();
          return json({ error: 'Email service unavailable' }, 503);
        }
        return generic;
      }
      if (path === '/api/auth/verify' || path === '/api/auth/magic') {
        const isMagic = path === '/api/auth/magic';
        const submittedEmail = normalize(body.email);
        const code = typeof body.code === 'string' ? body.code : '';
        const token = typeof body.token === 'string' ? body.token : '';
        if (isMagic ? !/^[a-f0-9]{64}$/.test(token) : (!await loginEligible(submittedEmail,env,db) || !/^\d{8}$/.test(code))) return error();
        // Validate canonical credentials after the existing generic, non-enumerating
        // failure gates; never expose schema details for login attempts.
        if (!validateOperationBody(isMagic?'verifyMagicLink':'verifyCode',
          isMagic?{token}:{email:submittedEmail,code})) return error();
        const now = Date.now();
        const hashed = await digest(isMagic ? token : submittedEmail + ':' + code, env.AUTH_PEPPER);
        // A magic link is a bearer credential: find the account by its token hash,
        // not by an email typed in the receiving browser.
        const latest = isMagic
          ? await db.prepare('SELECT id,email,attempts FROM login_challenges WHERE link_hash=? AND consumed_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 1')
              .bind(hashed,now).first<{ id: string; email: string; attempts: number }>()
          : await db.prepare('SELECT id,email,attempts FROM login_challenges WHERE email=? AND consumed_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 1')
              .bind(submittedEmail,now).first<{ id: string; email: string; attempts: number }>();
        const email = latest?.email || submittedEmail;
        if (!await withinLimits(request, db, env.AUTH_PEPPER, email || 'invalid', 'verify', now)) return error();
        if (!latest || !await loginEligible(email,env,db) || latest.attempts >= 5) return error();
        const row = isMagic
          ? latest
          : await db.prepare('SELECT id FROM login_challenges WHERE id=? AND code_hash=? AND consumed_at IS NULL AND expires_at>?')
              .bind(latest.id,hashed,now).first<{ id: string }>();
        if (!row) {
          await db.prepare('UPDATE login_challenges SET attempts=attempts+1 WHERE id=? AND attempts<5 AND consumed_at IS NULL').bind(latest.id).run();
          return error();
        }
        const consumed = await db.prepare('UPDATE login_challenges SET consumed_at=? WHERE id=? AND consumed_at IS NULL').bind(now,row.id).run();
        if (consumed.meta.changes !== 1) return error();
        const userId = await resolveUser(db, email, now);
        // Verification belongs to the claimant, never the administrator who
        // created the stub. Preserve the stable ID and existing history.
        await db.prepare('UPDATE users SET email_verified_at=COALESCE(email_verified_at,?),updated_at=? WHERE id=?')
          .bind(now,now,userId).run();
        const session = random();
        await db.prepare('INSERT INTO sessions(token_hash,email,user_id,expires_at,created_at) VALUES(?,?,?,?,?)')
          .bind(await digest(session, env.AUTH_PEPPER),email,userId,now+604800000,now).run();
        return json({ authenticated: true },200,{'set-cookie':cookie(session,604800)});
      }
      if (path === '/api/auth/logout') {
        const match = request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-sw_session=([a-f0-9]{64})(?:;|$)/);
        if (match) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(match[1],env.AUTH_PEPPER)).run();
        return json({ authenticated: false },200,{'set-cookie':cookie('',0)});
      }
      return json({ error: 'Not found' },404);
    } catch {
      return error();
    }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // The route registry is generated from OpenAPI YAML. During the
    // incremental migration the existing handlers still own semantics,
    // authorization, input validation, and error behavior.
    const url = new URL(request.url);
    if (!matchOperation(request.method, url.pathname)) return legacyFetch(request, env);
    const handlers = {} as WorkerHandlers;
    for (const op of operations) {
      handlers[op.id] = (matchedRequest: Request) => legacyFetch(matchedRequest, env);
    }
    return dispatchOperation(request, handlers);
  }
};
