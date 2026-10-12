import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import YAML from 'yaml';

test('generated public OpenAPI is exactly the authoritative YAML contract',()=>{
 const run=spawnSync(process.execPath,['scripts/generate-openapi-assets.mjs'],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr||run.stdout);
 const yaml=YAML.parse(readFileSync('openapi/openapi.yaml','utf8'));
 const json=JSON.parse(readFileSync('public/api/openapi.json','utf8'));
 assert.deepEqual(json,yaml);
 assert.ok(Object.keys(json.paths).length>=10,'All current APIs must be documented');
 const ops=Object.values(json.paths).flatMap(p=>Object.values(p).filter(v=>v?.operationId));
 assert.equal(ops.length,21,'Existing endpoints plus SDDW-006 signup operations should be inventoried');
});
test('Scalar documentation references only the deployed same-origin JSON endpoint',()=>{
 const html=readFileSync('public/api/docs/index.html','utf8');
 assert.match(html,/url: '\/api\/openapi\.json'/);
 assert.match(html,/@scalar\/api-reference@1\.73\.1/);
 assert.doesNotMatch(html,/proxyUrl:/);
});
