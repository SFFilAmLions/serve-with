import { readFileSync } from 'node:fs';
import YAML from 'yaml';

const file = new URL('../openapi/openapi.yaml', import.meta.url);
const doc = YAML.parseDocument(readFileSync(file, 'utf8'), { uniqueKeys: true });
if (doc.errors.length) throw new Error(doc.errors.map(e => e.message).join('\n'));
const api = doc.toJS();
if (api.openapi !== '3.1.0' || !api.info?.title || !api.paths) throw new Error('Invalid OpenAPI document header');
const operations = new Map();
const knownSchemes = new Set(Object.keys(api.components?.securitySchemes ?? {}));
const refs = new Set();
function walk(value) {
  if (value && typeof value === 'object') {
    if (typeof value.$ref === 'string') refs.add(value.$ref);
    for (const v of Object.values(value)) walk(v);
  }
}
walk(api);
for (const ref of refs) {
  if (!ref.startsWith('#/')) throw new Error('External references require explicit approval: '+ref);
  const target = ref.slice(2).split('/').reduce((v, part) => v?.[part.replace(/~1/g,'/').replace(/~0/g,'~')], api);
  if (target === undefined) throw new Error('Unresolved reference '+ref);
}
for (const [path, item] of Object.entries(api.paths)) {
  const placeholders = [...path.matchAll(/\{([^}]+)\}/g)].map(m => m[1]);
  for (const [method, operation] of Object.entries(item)) {
    if (!['get','post','put','patch','delete','head','options','trace'].includes(method)) continue;
    if (!operation.operationId || operations.has(operation.operationId)) throw new Error('Missing or duplicate operationId: '+operation.operationId);
    operations.set(operation.operationId, method.toUpperCase()+' '+path);
    const declared = [...(item.parameters ?? []), ...(operation.parameters ?? [])]
      .filter(p => p.in === 'path').map(p => p.name);
    for (const name of placeholders) if (!declared.includes(name)) throw new Error('Missing path parameter '+name+' at '+path);
    for (const parameter of [...(item.parameters ?? []), ...(operation.parameters ?? [])]) {
      if (parameter.in === 'path' && parameter.required !== true) throw new Error('Path parameter must be required: '+parameter.name);
    }
    if (!Object.keys(operation.responses ?? {}).length) throw new Error('Missing responses for '+operation.operationId);
    for (const requirement of operation.security ?? api.security ?? []) {
      for (const scheme of Object.keys(requirement)) if (!knownSchemes.has(scheme)) throw new Error('Unknown security scheme: '+scheme);
    }
  }
}
if (operations.size === 0) throw new Error('No operations defined');
console.log('OpenAPI structural checks passed:',operations.size,'operations');
