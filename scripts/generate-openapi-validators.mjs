import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import YAML from 'yaml';
const document=YAML.parse(readFileSync('openapi/openapi.yaml','utf8'));
const schemas={};
for(const item of Object.values(document.paths??{})){
 for(const operation of Object.values(item??{})){
  if(!operation?.operationId)continue;
  const schema=operation.requestBody?.content?.['application/json']?.schema;
  if(!schema)continue;
  schemas[operation.operationId]=schema;
 }
}
const output=`// GENERATED FROM openapi/openapi.yaml. DO NOT EDIT.
const operationSchemas: Record<string, unknown> = ${JSON.stringify(schemas,null,2)};
const componentSchemas: Record<string, unknown> = ${JSON.stringify(document.components.schemas,null,2)};
type Schema = {type?:string|string[];required?:string[];properties?:Record<string,Schema>;additionalProperties?:boolean|Schema;pattern?:string;minLength?:number;maxLength?:number;minimum?:number;maximum?:number;exclusiveMinimum?:number;exclusiveMaximum?:number;minItems?:number;maxItems?:number;enum?:unknown[];const?:unknown;format?:string;allOf?:Schema[];anyOf?:Schema[];oneOf?:Schema[];$ref?:string;items?:Schema};
function formatOk(format:string,value:string):boolean {
 if(format==='uuid')return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
 if(format==='email')return value.length<=254 && /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value);
 // Unknown formats are advisory: business handlers retain authoritative rules.
 return true;
}
function numericBounds(schema:Schema,value:number):boolean {
 return (schema.minimum===undefined||value>=schema.minimum) && (schema.maximum===undefined||value<=schema.maximum) && (schema.exclusiveMinimum===undefined||value>schema.exclusiveMinimum) && (schema.exclusiveMaximum===undefined||value<schema.exclusiveMaximum);
}
function check(raw: unknown,value: unknown): boolean {
 const schema=raw as Schema;
 if(schema.$ref){
  const name=schema.$ref.split('/').pop()!;
  const ref=componentSchemas[name];
  return ref!==undefined && check(ref,value);
 }
 if(schema.allOf&&!schema.allOf.every(item=>check(item,value)))return false;
 if(schema.anyOf&&!schema.anyOf.some(item=>check(item,value)))return false;
 if(schema.oneOf&&schema.oneOf.filter(item=>check(item,value)).length!==1)return false;
 if(schema.const!==undefined&&!Object.is(value,schema.const))return false;
 if(Array.isArray(schema.type))return schema.type.some(t=>check({...schema,type:t},value));
 if(schema.enum && !schema.enum.includes(value))return false;
 if(schema.type==='null')return value===null;
 if(schema.type==='string')return typeof value==='string' &&
  (schema.minLength===undefined||value.length>=schema.minLength) &&
  (schema.maxLength===undefined||value.length<=schema.maxLength) &&
  (!schema.pattern||new RegExp(schema.pattern).test(value)) &&
  (!schema.format||formatOk(schema.format,value));
 if(schema.type==='integer')return typeof value==='number'&&Number.isSafeInteger(value) && numericBounds(schema,value);
 if(schema.type==='number')return typeof value==='number'&&Number.isFinite(value)&&numericBounds(schema,value);
 if(schema.type==='boolean')return typeof value==='boolean';
 if(schema.type==='array')return Array.isArray(value) && (schema.minItems===undefined||value.length>=schema.minItems) && (schema.maxItems===undefined||value.length<=schema.maxItems) && value.every(item=>check(schema.items??{},item));
 if(schema.type==='object') {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const object=value as Record<string,unknown>;
  for(const key of schema.required??[])if(!(key in object))return false;
  for(const [key,child] of Object.entries(object)){
   const property=schema.properties?.[key];
   if(property){if(!check(property,child))return false;continue;}
   if(schema.additionalProperties===false)return false;
   if(typeof schema.additionalProperties==='object'&&!check(schema.additionalProperties,child))return false;
  }
 }
 return true;
}
export function validateOperationBody(operationId: string,body: unknown): boolean {
 const schema=operationSchemas[operationId];
 return schema!==undefined && check(schema,body);
}
`;
mkdirSync('src/generated',{recursive:true});
writeFileSync('src/generated/openapi-validators.ts',output);
console.log('Generated JSON body validators for '+Object.keys(schemas).length+' operations');
