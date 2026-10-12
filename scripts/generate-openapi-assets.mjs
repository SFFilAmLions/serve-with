import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import YAML from 'yaml';

// The checked-in YAML is the sole API contract. Vite copies public/ into dist/.
const document=YAML.parse(readFileSync('openapi/openapi.yaml','utf8'),{uniqueKeys:true});
if(document.openapi!=='3.1.0'||!document.paths)throw Error('Invalid OpenAPI document');
mkdirSync('public/api',{recursive:true});
writeFileSync('public/api/openapi.json',JSON.stringify(document,null,2)+'\n');
console.log('Generated public/api/openapi.json from OpenAPI YAML');
