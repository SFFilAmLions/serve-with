#!/usr/bin/env node
// SDDW-006 limited proof: generate a browser fetch client from the YAML contract.
// This is not yet the final generator; coverage will expand with the full API.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import YAML from 'yaml';
const spec = YAML.parse(readFileSync('openapi/openapi.yaml', 'utf8'));
if (spec.openapi !== '3.1.0') throw new Error('OpenAPI 3.1 expected');
const refs = spec.components?.schemas ?? {};
function tsType(schema) {
  if (!schema) return 'unknown';
  if (schema.$ref) {
    const name = schema.$ref.split('/').pop();
    if (!Object.hasOwn(refs, name)) throw new Error('Unknown schema '+name);
    return name;
  }
  if (schema.oneOf) return schema.oneOf.map(tsType).join(' | ');
  if (schema.anyOf) return schema.anyOf.map(tsType).join(' | ');
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (schema.enum) return schema.enum.map(x=>JSON.stringify(x)).join(' | ');
  if (Array.isArray(schema.type)) return schema.type.map(type=>tsType({...schema,type})).join(' | ');
  switch (schema.type) {
    case 'string': return 'string';
    case 'number': case 'integer': return 'number';
    case 'boolean': return 'boolean';
    case 'null': return 'null';
    case 'array': return '('+tsType(schema.items)+')[]';
    case 'object': {
      const properties = Object.entries(schema.properties ?? {});
      const required = new Set(schema.required ?? []);
      const members = properties.map(([k,v])=>JSON.stringify(k)+(required.has(k)?': ':'?: ')+tsType(v)+';');
      if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        // Index signatures are only emitted when no explicit properties are present.
        if (!properties.length) return 'Record<string, '+tsType(schema.additionalProperties)+'>';
      }
      if (!members.length) return 'Record<string, unknown>';
      return '{ '+members.join(' ')+' }';
    }
    default: throw new Error('Unsupported schema for spike: '+JSON.stringify(schema));
  }
}
const out = [
  '// GENERATED — do not edit. Source: openapi/openapi.yaml',
  '// Same-origin cookies; the browser adds Origin for mutating requests.',
  ...Object.entries(refs).map(([key,schema])=>'export type '+key+' = '+tsType(schema)+';'),
  'export type ApiResult<T> = { status: number; data: T };',
  'export type ApiClientOptions = { fetcher?: typeof fetch; baseUrl?: string };',
  'export function createApiClient(options: ApiClientOptions = {}) {',
  '  const fetcher = options.fetcher ?? fetch;',
  '  const baseUrl = options.baseUrl ?? "";',
  '  return {'
];
const operations = [];
for(const [path,item] of Object.entries(spec.paths ?? {}))for(const [method,operation]of Object.entries(item)){
 if(!['get','post','put','patch','delete'].includes(method))continue;
 const id=operation.operationId;
 if(!/^[a-zA-Z][a-zA-Z0-9]*$/.test(id))throw new Error('Invalid operation id');
 const params=[...(item.parameters ?? []),...(operation.parameters ?? [])].filter(x=>x.in==='path'||x.in==='query');
 const pathParams=params.filter(p=>p.in==='path');
 const queryParams=params.filter(p=>p.in==='query');
 const requestSchema=operation.requestBody?.content?.['application/json']?.schema;
 const success=Object.entries(operation.responses ?? {}).find(([status])=>/^2\d\d$/.test(status));
 if(!success)throw new Error('No successful response in '+id);
 const responseType=tsType(success[1].content?.['application/json']?.schema);
 const fields=[...pathParams.map(p=>JSON.stringify(p.name)+': '+tsType(p.schema)),...queryParams.map(p=>JSON.stringify(p.name)+(p.required?': ':'?: ')+tsType(p.schema))];
 if(requestSchema)fields.push('body: '+tsType(requestSchema));
 const argType=fields.length?'{ '+fields.join('; ')+' }':'void';
 const argument=fields.length?'args: '+argType:'';
 const urlExpression=path.replace(/\{([^}]+)\}/g,(_m,name)=>'${encodeURIComponent(String(args['+JSON.stringify(name)+']))}');
 const queryLines=queryParams.map(p=>'      if (args['+JSON.stringify(p.name)+'] !== undefined) url.searchParams.set('+JSON.stringify(p.name)+', String(args['+JSON.stringify(p.name)+']));');
 out.push('    async '+id+'('+argument+'): Promise<ApiResult<'+responseType+' | Error>> {');
 out.push('      const url = new URL(\`'+ '${baseUrl || "http://local.invalid"}'+urlExpression+'\`);');
 out.push(...queryLines);
 out.push('      const response = await fetcher((baseUrl ? url.toString() : url.pathname + url.search), { method: '+JSON.stringify(method.toUpperCase())+', credentials: "same-origin"'+(requestSchema?', headers: {"content-type":"application/json"}, body: JSON.stringify(args.body)':'')+' });');
 out.push('      const data: unknown = await response.json();');
 out.push('      return {status: response.status, data: data as '+responseType+' | Error};');
 out.push('    },');
 operations.push(id);
}
out.push('  };','}','');
mkdirSync('src/generated',{recursive:true});
writeFileSync('src/generated/openapi-client.ts',out.join('\n'));
console.log('Generated browser client for '+operations.length+' OpenAPI operations');
