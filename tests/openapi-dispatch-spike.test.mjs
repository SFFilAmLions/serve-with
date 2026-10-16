import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

// This is a Fetch API contract-adapter spike, NOT a test of production worker.ts.
// The generated route table is compiled and executed; security stays in handlers.
async function getRoutes() {
  const dir = mkdtempSync(join(tmpdir(), 'serve-with-openapi-'));
  try {
    const target = join(dir, 'api-server-contract.ts');
    const generated = spawnSync(process.execPath, ['scripts/generate-server-contract.mjs', 'openapi/openapi.yaml', target], { encoding: 'utf8' });
    assert.equal(generated.status, 0, generated.stderr || generated.stdout);
    const javascript = ts.transpileModule(readFileSync(target, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = await import('data:text/javascript;base64,' + Buffer.from(javascript).toString('base64'));
    return module.operationRoutes;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

function createDispatcher(routes, handlers) {
  return async function dispatch(request, env) {
    const url = new URL(request.url);
    for (const route of routes) {
      const names = [];
      const pattern = route.path.replace(/\{([^}]+)\}/g, (_, name) => { names.push(name); return '([^/]+)'; });
      const match = url.pathname.match(new RegExp('^' + pattern + '$'));
      if (!match || request.method !== route.method) continue;
      const pathParams = Object.fromEntries(names.map((name, i) => [name, decodeURIComponent(match[i+1])]));
      return handlers[route.operationId](request, env, { operationId: route.operationId, pathParams });
    }
    return new Response('Not found', { status: 404 });
  };
}

test('generated OpenAPI route metadata dispatches Fetch Request to named handler', async () => {
  const routes = await getRoutes();
  const dispatch = createDispatcher(routes, {
    getEvent: (_req, _env, context) => Response.json({ id: context.pathParams.id }),
  });
  const id = '12345678-1234-1234-1234-123456789abc';
  const response = await dispatch(new Request('https://example.test/api/events/' + id), {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { id });
});

test('protected generated route requires handler-enforced origin, session and admin checks', async () => {
  const routes = await getRoutes();
  const dispatch = createDispatcher(routes, {
    createAdminEvent: async (request, env) => {
      if (request.headers.get('origin') !== new URL(request.url).origin ||
          request.headers.get('sec-fetch-site') === 'cross-site')
        return Response.json({ error: 'Invalid origin' }, { status: 403 });
      if (request.headers.get('cookie') !== 'session=valid')
        return Response.json({ error: 'Authentication required' }, { status: 401 });
      if (!env.admin) return Response.json({ error: 'Forbidden' }, { status: 403 });
      return Response.json({ event: { id: 'created' } }, { status: 201 });
    },
  });
  const url = 'https://example.test/api/admin/events';
  const request = headers => new Request(url, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({title:'Example'}),
  });
  const origin = { origin: 'https://example.test', cookie: 'session=valid' };
  assert.equal((await dispatch(request({ ...origin, origin: 'https://evil.test' }), { admin: true })).status, 403);
  assert.equal((await dispatch(request({ ...origin, 'sec-fetch-site': 'cross-site' }), { admin: true })).status, 403);
  assert.equal((await dispatch(request({ origin: origin.origin }), { admin: true })).status, 401);
  assert.equal((await dispatch(request(origin), { admin: false })).status, 403);
  assert.equal((await dispatch(request(origin), { admin: true })).status, 201);
});
