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
const json = (body: unknown, status = 200, headers?: HeadersInit) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const normalize = (email: unknown) => typeof email === 'string' ? email.trim().toLowerCase() : '';
const random = (bytes = 32) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), n => n.toString(16).padStart(2, '0')).join('');
const digest = async (value: string, pepper: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(pepper + ':' + value))), n => n.toString(16).padStart(2, '0')).join('');
const cookie = (value: string, age: number) => `sw_session=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${age}`;
const originOk = (request: Request) => request.headers.get('origin') === new URL(request.url).origin;
const error = () => json({ error: 'Unable to complete request' }, 400);
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
  return response.ok;
}

async function sessionEmail(request: Request, env: Env): Promise<string | null> {
  const match = request.headers.get('cookie')?.match(/(?:^|;\s*)sw_session=([a-f0-9]{64})(?:;|$)/);
  if (!match || !env.AUTH_DB || !env.AUTH_PEPPER) return null;
  const hash = await digest(match[1], env.AUTH_PEPPER);
  const row = await env.AUTH_DB.prepare('SELECT email FROM sessions WHERE token_hash=? AND expires_at>?').bind(hash, Date.now()).first<{ email: string }>();
  return row && allowed.has(row.email) ? row.email : null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!path.startsWith('/api/auth/')) return env.ASSETS.fetch(request);
    if (!env.AUTH_DB || !env.AUTH_PEPPER || !env.RESEND_API_KEY || !env.AUTH_FROM_EMAIL) return json({ error: 'Sign-in is not configured' }, 503);
    const db = env.AUTH_DB;
    if (request.method === 'GET' && path === '/api/auth/me') {
      const email = await sessionEmail(request, env);
      return json({ authenticated: Boolean(email), email });
    }
    if (request.method !== 'POST' || !originOk(request)) return error();
    try {
      const body = await bodyOf(request);
      if (path === '/api/auth/request') {
        const email = normalize(body.email);
        const generic = json({ message: 'If this account is authorized, a sign-in email will arrive shortly.' });
        if (!allowed.has(email)) return generic;
        const now = Date.now();
        const count = await db.prepare('SELECT COUNT(*) AS n FROM login_challenges WHERE email=? AND created_at>?').bind(email, now - 3600000).first<{ n: number }>();
        if ((count?.n || 0) >= 5) return generic;
        const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 100000000).padStart(8, '0');
        const token = random();
        const codeHash = await digest(email + ':' + code, env.AUTH_PEPPER);
        const tokenHash = await digest(token, env.AUTH_PEPPER);
        const id = crypto.randomUUID();
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
        const row = await db.prepare(`SELECT id,attempts FROM login_challenges WHERE email=? AND ${field}=? AND consumed_at IS NULL AND expires_at>?`).bind(email,hashed,now).first<{ id: string; attempts: number }>();
        if (!row || row.attempts >= 5) return error();
        const consumed = await db.prepare('UPDATE login_challenges SET consumed_at=? WHERE id=? AND consumed_at IS NULL').bind(now,row.id).run();
        if (consumed.meta.changes !== 1) return error();
        const session = random();
        await db.prepare('INSERT INTO sessions(token_hash,email,expires_at,created_at) VALUES(?,?,?,?)').bind(await digest(session, env.AUTH_PEPPER),email,now+604800000,now).run();
        return json({ authenticated: true },200,{'set-cookie':cookie(session,604800)});
      }
      if (path === '/api/auth/logout') {
        const match = request.headers.get('cookie')?.match(/(?:^|;\s*)sw_session=([a-f0-9]{64})(?:;|$)/);
        if (match) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(match[1],env.AUTH_PEPPER)).run();
        return json({ authenticated: false },200,{'set-cookie':cookie('',0)});
      }
      return json({ error: 'Not found' },404);
    } catch {
      return error();
    }
  }
};
