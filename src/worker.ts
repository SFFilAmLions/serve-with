interface D1Statement { bind(...values: unknown[]): D1Statement; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; run(): Promise<{ meta: { changes: number } }> }
interface D1Database { prepare(query: string): D1Statement; batch(statements: D1Statement[]): Promise<unknown> }
import admins from './generated/admins.json';
import { Temporal } from '@js-temporal/polyfill';
import { isStagingRegistrationEligible } from './registration-eligibility';

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  AUTH_DB?: D1Database;
  AUTH_PEPPER?: string;
  RESEND_API_KEY?: string;
  AUTH_FROM_EMAIL?: string;
  ENVIRONMENT?: string;
  STAGING_REGISTRATION_EMAILS?: string;
  REQUIRED_TERMS_VERSION?: string;
  REQUIRED_PRIVACY_VERSION?: string;
}

const allowed = new Set(admins.filter(a => a.enabled).map(a => a.email));
// SDDW-004 Batch 1: resolve identities only after an existing valid session or
// a consumed verification challenge; do not make profile/consent a gate yet.
async function resolveUser(db: D1Database, email: string, now: number): Promise<string> {
  const normalized = normalize(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) throw new Error('Invalid verified email');
  // SQLite/D1 applies the unique-email constraint atomically. Concurrent callers
  // can generate different UUIDs; exactly one INSERT OR IGNORE wins.
  await db.prepare('INSERT OR IGNORE INTO users (id,email,email_verified_at,created_at,updated_at) VALUES (?,?,?,?,?)')
    .bind(crypto.randomUUID(), normalized, now, now, now).run();
  const user = await db.prepare('SELECT id FROM users WHERE email=?').bind(normalized).first<{ id: string }>();
  if (!user) throw new Error('Unable to resolve verified identity');
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

type EventFields = { title: string; location: string; timezone: string; start_at: number; end_at: number };
function eventInput(body: Record<string,unknown>): { event?: EventFields; errors?: Record<string,string> } {
  const errors: Record<string,string> = {};
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const location = typeof body.location === 'string' ? body.location.trim() : '';
  const timezone = typeof body.timezone === 'string' ? body.timezone : '';
  if (!title || title.length > 200) errors.title = 'Title must contain 1–200 characters';
  if (!location || location.length > 500) errors.location = 'Location must contain 1–500 characters';
  if (!timezone || timezone.length > 100) errors.timezone = 'Select a valid IANA time zone';
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
  return Object.keys(errors).length ? { errors } : { event: { title, location, timezone, start_at: start!, end_at: end! } };
}

async function sendEmail(env: Env, email: string, code: string, link: string): Promise<boolean> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'authorization': `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.AUTH_FROM_EMAIL, to: [email], subject: 'Sign in to Serve With', text: `Your one-time code is ${code}. It expires in 10 minutes.\n\nOr open this link, then confirm sign-in: ${link}\n\nIf you did not request this, ignore this email.` }),
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
  date_of_birth: string | null; email_verified_at: number | null;
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
  const user = await db.prepare('SELECT id,email,first_name,last_name,date_of_birth,email_verified_at,terms_accepted_at,accepted_terms_version,accepted_privacy_version FROM users WHERE id=?')
    .bind(id).first<UserRow>();
  if (!user || normalize(user.email) !== email) return null;
  return {user,admin:allowed.has(email)};
}
const policyVersions = (env: Env) => {
  const terms = env.REQUIRED_TERMS_VERSION?.trim() || '';
  const privacy = env.REQUIRED_PRIVACY_VERSION?.trim() || '';
  return terms && privacy && terms.length <= 100 && privacy.length <= 100 ? {terms,privacy} : null;
};
const profileReady = (u: UserRow) => Boolean(u.first_name && u.last_name && u.date_of_birth);
const agreementReady = (u: UserRow, versions: {terms:string;privacy:string}|null) =>
  Boolean(versions && u.terms_accepted_at && u.accepted_terms_version === versions.terms && u.accepted_privacy_version === versions.privacy);
const privilegeReady = (subject: Subject, env: Env) => Boolean(subject.user.email_verified_at && profileReady(subject.user) && agreementReady(subject.user,policyVersions(env)));
const registrationEligible = (email: string, env: Env) => allowed.has(email) || isStagingRegistrationEligible(email,env,allowed);
const validName = (x: unknown): x is string => typeof x === 'string' && x.trim().length >= 1 && x.trim().length <= 100;
const validDob = (x: unknown): x is string => {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
  try { return Temporal.PlainDate.from(x).toString() === x && x < new Date().toISOString().slice(0,10); }
  catch { return false; }
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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
        `SELECT id,title,location,timezone,start_at,end_at,version FROM events
         WHERE deleted_at IS NULL AND end_at ${comparison} ?
         ORDER BY start_at ${direction}, id ${direction}`
      ).bind(now).all<{ id: string; title: string; location: string; timezone: string; start_at: number; end_at: number; version: number }>();
      return json({ view, events: events.results });
    }
    // Canonical event details remain anonymously accessible.
    if (path.startsWith('/api/events/')) {
      if (request.method !== 'GET') return json({error:'Method not allowed'},405);
      if (!env.AUTH_DB) return json({error:'Service unavailable'},503);
      const id=path.slice('/api/events/'.length);
      if (!/^[0-9a-f-]{36}$/.test(id)) return json({error:'Event not found'},404);
      const event=await env.AUTH_DB.prepare('SELECT id,title,location,timezone,start_at,end_at,version FROM events WHERE id=? AND deleted_at IS NULL').bind(id).first();
      return event ? json({event}) : json({error:'Event not found'},404);
    }
    if (path.startsWith('/api/users/')) {
      if (!env.AUTH_DB || !env.AUTH_PEPPER) return json({error:'Service unavailable'},503);
      const subject=await sessionSubject(request,env);
      if (!subject) return json({error:'Authentication required'},401);
      if (!privilegeReady(subject,env)) return json({error:'Profile or current agreement required',code:'account_completion_required'},403);
      const id=path.slice('/api/users/'.length);
      if (!/^[0-9a-f-]{36}$/.test(id)) return json({error:'Not found'},404);
      if (!subject.admin && subject.user.id!==id) return json({error:'Not found'},404);
      const target=await env.AUTH_DB.prepare('SELECT id,email,first_name,last_name,date_of_birth,email_verified_at,created_at,updated_at FROM users WHERE id=?').bind(id).first();
      if (!target) return json({error:'Not found'},404);
      if (request.method==='GET') return json({user:target,canCorrectDob:subject.admin});
      if (request.method!=='PUT') return json({error:'Method not allowed'},405);
      if (!originOk(request) || request.headers.get('sec-fetch-site')==='cross-site') return error();
      try {
        const body=await bodyOf(request);
        if (!validName(body.firstName)||!validName(body.lastName)) return json({error:'Invalid name'},422);
        if ('dateOfBirth' in body && (!subject.admin || !validDob(body.dateOfBirth))) return json({error:'Invalid or unauthorized DOB correction'},403);
        const now=Date.now();
        if ('dateOfBirth' in body) {
          const old=target as {date_of_birth:string|null};
          if (old.date_of_birth!==body.dateOfBirth) {
            await env.AUTH_DB.batch([
              env.AUTH_DB.prepare('UPDATE users SET first_name=?,last_name=?,date_of_birth=?,updated_at=? WHERE id=?').bind(body.firstName.trim(),body.lastName.trim(),body.dateOfBirth,now,id),
              env.AUTH_DB.prepare('INSERT INTO user_dob_audit(id,subject_user_id,actor_user_id,changed_at) VALUES(?,?,?,?)').bind(crypto.randomUUID(),id,subject.user.id,now)
            ]);
          } else {
            await env.AUTH_DB.prepare('UPDATE users SET first_name=?,last_name=?,updated_at=? WHERE id=?').bind(body.firstName.trim(),body.lastName.trim(),now,id).run();
          }
        } else {
          await env.AUTH_DB.prepare('UPDATE users SET first_name=?,last_name=?,updated_at=? WHERE id=?').bind(body.firstName.trim(),body.lastName.trim(),now,id).run();
        }
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
      if (path === '/api/admin/users') {
        if (request.method!=='GET') return json({error:'Method not allowed'},405);
        const sort=url.searchParams.get('sort')==='first'?'first_name':'last_name';
        const direction=url.searchParams.get('direction')==='desc'?'DESC':'ASC';
        const letter=(url.searchParams.get('letter')||'').trim().toUpperCase();
        if (letter && !/^[A-Z]$/.test(letter)) return json({error:'Invalid letter'},400);
        const query=(url.searchParams.get('q')||'').trim().toLowerCase().slice(0,100);
        const offset=Number(url.searchParams.get('offset')||'0');
        if (!Number.isSafeInteger(offset) || offset<0 || offset>100000) return json({error:'Invalid offset'},400);
        const search='%'+query.replace(/[\\%_]/g,x=>'\\'+x)+'%';
        const rows=await env.AUTH_DB.prepare(`SELECT id,first_name,last_name,email FROM users
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
        const now = Date.now(), id = crypto.randomUUID();
        await env.AUTH_DB.prepare('INSERT INTO events (id,title,location,timezone,start_at,end_at,created_at,updated_at,version) VALUES (?,?,?,?,?,?,?,?,1)')
          .bind(id,event.title,event.location,event.timezone,event.start_at,event.end_at,now,now).run();
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
        const existing = await env.AUTH_DB.prepare('SELECT version FROM events WHERE id=? AND deleted_at IS NULL').bind(id).first<{version:number}>();
        if (!existing) return json({ error: 'Event not found' }, 404);
        if (request.method === 'PUT') {
          const validated = eventInput(body);
          if (!validated.event) return json({ error: 'Invalid event', fields: validated.errors }, 422);
          const event = validated.event;
          const now = Date.now();
          const updated = await env.AUTH_DB.prepare(
            'UPDATE events SET title=?,location=?,timezone=?,start_at=?,end_at=?,updated_at=?,version=version+1 WHERE id=? AND version=? AND deleted_at IS NULL'
          ).bind(event.title,event.location,event.timezone,event.start_at,event.end_at,now,id,body.version).run();
          if (updated.meta.changes !== 1) return json({ error: 'Event changed since you opened it', code: 'version_conflict' }, 409);
          return json({ event: { id,...event,version:(body.version as number)+1 } });
        }
        const now = Date.now();
        const result = await env.AUTH_DB.prepare('UPDATE events SET deleted_at=?,updated_at=?,version=version+1 WHERE id=? AND version=? AND deleted_at IS NULL')
          .bind(now,now,id,body.version).run();
        if (result.meta.changes !== 1) return json({ error: 'Event changed since you opened it', code: 'version_conflict' }, 409);
        return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
      }
      return json({ error: 'Not found' }, 404);
    }
    if (!path.startsWith('/api/auth/')) {
      // Render the SPA for canonical deep links; retain ordinary asset handling.
      const spaRoute = request.method === 'GET' && (
        path === '/login' || path === '/admin' || path === '/admin/events' || path === '/admin/users' ||
        path === '/admin/events/new' || /^\\/admin\\/events\\/[0-9a-f-]{36}\\/edit$/.test(path) ||
        /^\\/users\\/[0-9a-f-]{36}(?:\\/edit)?$/.test(path) ||
        /^\\/events\\/[0-9a-f-]{36}$/.test(path)
      );
      const assetRequest = spaRoute ? new Request(new URL('/',request.url),request) : request;
      const response = await env.ASSETS.fetch(assetRequest);
      const headers = new Headers(response.headers);
      headers.set('Referrer-Policy', 'no-referrer');
      headers.set('X-Content-Type-Options', 'nosniff');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }
    if (!env.AUTH_DB || !env.AUTH_PEPPER) return json({ error: 'Sign-in is not configured' }, 503);
    const db = env.AUTH_DB;
    if (request.method === 'GET' && path === '/api/auth/me') {
      const subject = await sessionSubject(request, env);
      if (!subject) return json({ authenticated: false, email: null });
      const {user,admin} = subject;
      return json({ authenticated:true, email:user.email, userId:user.id,
        firstName:user.first_name, lastName:user.last_name, emailVerified:Boolean(user.email_verified_at),
        profileComplete:profileReady(user), agreementCurrent:agreementReady(user,policyVersions(env)),
        administratorEligible:admin, privileged:privilegeReady(subject,env) });
    }
    if (request.method !== 'POST' || !originOk(request) || request.headers.get('sec-fetch-site') === 'cross-site') return error();
    try {
      const body = await bodyOf(request);
      if (path === '/api/auth/profile') {
        const subject = await sessionSubject(request, env);
        if (!subject || !subject.user.email_verified_at) return json({ error:'Authentication required' },401);
        if (!validName(body.firstName) || !validName(body.lastName) || !validDob(body.dateOfBirth))
          return json({ error:'Invalid profile' },422);
        const now=Date.now(), u=subject.user;
        // Initial DOB is write-once here; later admin correction is a separate audited workflow.
        const result=await db.prepare('UPDATE users SET first_name=?,last_name=?,date_of_birth=?,updated_at=? WHERE id=? AND date_of_birth IS NULL')
          .bind(body.firstName.trim(),body.lastName.trim(),body.dateOfBirth,now,u.id).run();
        if (result.meta.changes !== 1) return json({ error:'Profile already initialized' },409);
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
        const now=Date.now(), id=crypto.randomUUID(), userId=subject.user.id;
        // D1 batch commits both statements transactionally or rolls both back.
        await db.batch([
          db.prepare('INSERT INTO agreement_acceptances(id,user_id,terms_version,privacy_version,accepted_at) VALUES(?,?,?,?,?)')
            .bind(id,userId,versions.terms,versions.privacy,now),
          db.prepare('UPDATE users SET terms_accepted_at=?,accepted_terms_version=?,accepted_privacy_version=?,updated_at=? WHERE id=?')
            .bind(now,versions.terms,versions.privacy,now,userId)
        ]);
        return json({agreementCurrent:true});
      }
      if (path === '/api/auth/request') {
        const email = normalize(body.email);
        const generic = json({ message: 'If this account is authorized, a sign-in email will arrive shortly.' });
        const now = Date.now();
        const withinRate = await withinLimits(request, db, env.AUTH_PEPPER, email || 'invalid', 'request', now);
        if (!withinRate || !registrationEligible(email,env)) return generic;
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
        if (isMagic ? !/^[a-f0-9]{64}$/.test(token) : (!registrationEligible(submittedEmail,env) || !/^\d{8}$/.test(code))) return error();
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
        if (!latest || !registrationEligible(email,env) || latest.attempts >= 5) return error();
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
};
