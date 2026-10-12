#!/usr/bin/env node
// SDDW-006 SPIKE ONLY. Generates Worker-friendly operation contracts from YAML.
// This intentionally handles only the small existing-route proof subset.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import YAML from 'yaml';

const doc = YAML.parse(readFileSync('openapi/openapi.yaml', 'utf8'));
if (doc.openapi !== '3.1.0') throw new Error('Expected OpenAPI 3.1.0');
const entries = [];
for (const [path, item] of Object.entries(doc.paths ?? {})) {
  for (const [method, op] of Object.entries(item)) {
    if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
    if (!op.operationId || !/^[A-Za-z][A-Za-z0-9]*$/.test(op.operationId)) throw new Error('Invalid operationId at ' + path);
    entries.push({ path, method: method.toUpperCase(), id: op.operationId });
  }
}
if (entries.length === 0) throw new Error('No operations');
if (new Set(entries.map(x=>x.id)).size !== entries.length) throw new Error('Duplicate operationId');
const quoted = x => JSON.stringify(x);
const source = [
  '// GENERATED — do not edit. Source: openapi/openapi.yaml',
  'export const operations = [',
  ...entries.map(x=> '  { id: ' + quoted(x.id) + ', method: ' + quoted(x.method) + ', path: ' + quoted(x.path) + ' },'),
  '] as const;',
  'export type OperationId = typeof operations[number]["id"];',
  'export type WorkerHandler = (request: Request, params: Readonly<Record<string,string>>) => Response | Promise<Response>;',
  'export type WorkerHandlers = { [K in OperationId]: WorkerHandler };',
  'export function matchOperation(method: string, pathname: string): { id: OperationId; params: Record<string,string> } | null {',
  '  for (const op of operations) {',
  '    if (op.method !== method) continue;',
  '    const parts = op.path.split("/").filter(Boolean);',
  '    const actual = pathname.split("/").filter(Boolean);',
  '    if (parts.length !== actual.length) continue;',
  '    const params: Record<string,string> = {};',
  '    let match = true;',
  '    for (let i = 0; i < parts.length; i++) {',
  '      const part = parts[i], value = actual[i];',
  '      if (part.startsWith("{") && part.endsWith("}")) {',
  '        try { params[part.slice(1,-1)] = decodeURIComponent(value); } catch { match = false; break; }',
  '      } else if (part !== value) { match = false; break; }',
  '    }',
  '    if (match) return { id: op.id, params };',
  '  }',
  '  return null;',
  '}',
  'export function dispatchOperation(request: Request, handlers: WorkerHandlers): Response | Promise<Response> {',
  '  const match = matchOperation(request.method, new URL(request.url).pathname);',
  '  if (!match) return new Response(JSON.stringify({error:"Not found"}), {status:404,headers:{"content-type":"application/json"}});',
  '  return handlers[match.id](request, match.params);',
  '}',
  ''
].join('\n');
mkdirSync('src/generated', {recursive:true});
writeFileSync('src/generated/openapi-operations.ts', source);
console.log('Generated ' + entries.length + ' Worker operation bindings');
