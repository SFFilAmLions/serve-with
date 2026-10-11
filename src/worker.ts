interface D1Statement { bind(...values: unknown[]): D1Statement; first<T>(): Promise<T | null>; run(): Promise<{ meta: { changes: number } }> }
interface D1Database { prepare(query: string): D1Statement }
import admins from './generated/admins.json';

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  AUTH_DB?: D1Database;
  AUTH_PEPPER?: string;
  RESEND_API_KEY?: string;
  AUTH_FROM_EMAIL?: string;
}

const allowed = new Set(admins.filter(a => a.enabled).map(a => a.email));
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

async function sessionEmail(request: Request, env: Env): Promise<string | null> {
  const match = request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-sw_session=([a-f0-9]{64})(?:;|$)/);
  if (!match || !env.AUTH_DB || !env.AUTH_PEPPER) return null;
  const hash = await digest(match[1], env.AUTH_PEPPER);
  const row = await env.AUTH_DB.prepare('SELECT email FROM sessions WHERE token_hash=? AND expires_at>?').bind(hash, Date.now()).first<{ email: string }>();
  return row && allowed.has(row.email) ? row.email : null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path.startsWith('/api/admin/')) {
      if (!env.AUTH_DB || !env.AUTH_PEPPER) return json({ error: 'Service unavailable' }, 503);
      const email = await sessionEmail(request, env);
      if (!email) return json({ error: 'Authentication required' }, 401);
      if (request.method === 'GET' && path === '/api/admin/dashboard') return json({ email, message: 'Admin dashboard ready' });
      return json({ error: 'Not found' }, 404);
    }
    if (!path.startsWith('/api/auth/')) {
      const response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers);
      headers.set('Referrer-Policy', 'no-referrer');
      headers.set('X-Content-Type-Options', 'nosniff');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }
    if (!env.AUTH_DB || !env.AUTH_PEPPER || !env.RESEND_API_KEY || !env.AUTH_FROM_EMAIL) return json({ error: 'Sign-in is not configured' }, 503);
    const db = env.AUTH_DB;
    if (request.method === 'GET' && path === '/api/auth/me') {
      const email = await sessionEmail(request, env);
      return json({ authenticated: Boolean(email), email });
    }
    if (request.method !== 'POST' || !originOk(request) || request.headers.get('sec-fetch-site') === 'cross-site') return error();
    try {
      const body = await bodyOf(request);
      if (path === '/api/auth/request') {
        const email = normalize(body.email);
        const generic = json({ message: 'If this account is authorized, a sign-in email will arrive shortly.' });
        const now = Date.now();
        const withinRate = await withinLimits(request, db, env.AUTH_PEPPER, email || 'invalid', 'request', now);
        if (!withinRate || !allowed.has(email)) return generic;
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
        const email = normalize(body.email);
        const code = typeof body.code === 'string' ? body.code : '';
        const token = typeof body.token === 'string' ? body.token : '';
        if (!allowed.has(email) || (path.endsWith('/verify') ? !/^\d{8}$/.test(code) : !/^[a-f0-9]{64}$/.test(token))) return error();
        const now = Date.now();
        const hashed = await digest(path.endsWith('/verify') ? email + ':' + code : token, env.AUTH_PEPPER);
        const field = path.endsWith('/verify') ? 'code_hash' : 'link_hash';
        const latest = await db.prepare('SELECT id,attempts FROM login_challenges WHERE email=? AND consumed_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 1').bind(email,now).first<{id: string; attempts: number}>();
        if (!latest || latest.attempts >= 5) return error();
        // Count failed guesses against the latest outstanding challenge, regardless of token validity.
        const row = await db.prepare(`SELECT id,attempts FROM login_challenges WHERE id=? AND ${field}=? AND consumed_at IS NULL AND expires_at>?`).bind(latest.id,hashed,now).first<{ id: string; attempts: number }>();
        if (!row) {
          await db.prepare('UPDATE login_challenges SET attempts=attempts+1 WHERE id=? AND attempts<5 AND consumed_at IS NULL').bind(latest.id).run();
          return error();
        }
        const consumed = await db.prepare('UPDATE login_challenges SET consumed_at=? WHERE id=? AND consumed_at IS NULL').bind(now,row.id).run();
        if (consumed.meta.changes !== 1) return error();
        const session = random();
        await db.prepare('INSERT INTO sessions(token_hash,email,expires_at,created_at) VALUES(?,?,?,?)').bind(await digest(session, env.AUTH_PEPPER),email,now+604800000,now).run();
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
