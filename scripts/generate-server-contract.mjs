import { readFileSync, writeFileSync } from 'node:fs';
import YAML from 'yaml';

// Spike-only: generate Worker-compatible handler signatures and a route table
// from the same OpenAPI YAML used for browser client operation types.
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node scripts/generate-server-contract.mjs <yaml> <output.ts>');
const api = YAML.parse(readFileSync(input, 'utf8'));
const routes = [];
for (const [path, item] of Object.entries(api.paths ?? {})) {
  for (const [method, operation] of Object.entries(item)) {
    if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue;
    if (!/^[a-zA-Z][\w]*$/.test(operation.operationId ?? '')) throw new Error('Invalid operationId '+operation.operationId);
    routes.push({ path, method: method.toUpperCase(), operationId: operation.operationId });
  }
}
if (!routes.length) throw new Error('No operations');
const header = [
  '// GENERATED FROM OPENAPI YAML. DO NOT EDIT.',
  "import type { operations } from './api-types';",
  'export type WorkerOperationHandler<K extends keyof operations> =',
  '  (request: Request, env: unknown, context: { operationId: K; pathParams: Record<string, string> }) => Promise<Response> | Response;',
  'export type WorkerOperationHandlers = { [K in keyof operations]: WorkerOperationHandler<K> };',
  'export const operationRoutes = ',
];
writeFileSync(output, header.join('\n') + JSON.stringify(routes, null, 2)
  + ' as const satisfies ReadonlyArray<{ method: string; path: string; operationId: keyof operations }>;\n');
console.log('Generated Worker server operation signatures:', routes.length);
