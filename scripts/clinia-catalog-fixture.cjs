'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const local=require('./clinia-local-runtime.cjs');
const output=path.join(local.repo,'docs/production/evidence/2026-09-28-convergence');
const id='12121212-1212-4212-8212-121212121212';
const action=process.argv[2];
if(!['prepare','verify'].includes(action))throw new Error('Fixture action required');
local.inspectLocal();
const file=path.join(output,'catalog-fixture-'+action+'.json');if(fs.existsSync(file))throw new Error('Evidence exists; refuse overwrite');
if(action==='prepare'){
  assert.equal(local.sql('postgres',`SELECT count(*) FROM public.services WHERE id='${id}';`,'postgres'),'0');
  local.sql('postgres',"SET app.scoped_fixture_authorized='local-synthetic';\n"+`INSERT INTO public.services(id,clinic_id,name,description,duration_minutes,price) VALUES('${id}','33333333-3333-4333-8333-333333333333','Control operativo sintético','Datos inventados para verificar el catálogo',30,73.45);`,'postgres');
}
const state=JSON.parse(local.sql('postgres',`SELECT json_build_object('id',id,'name',name,'duration',duration_minutes,'active',is_active,'historicalValueHash',md5(price::text)) FROM public.services WHERE id='${id}';`,'postgres'));
if(action==='verify'){
  const before=JSON.parse(fs.readFileSync(path.join(output,'catalog-fixture-prepare.json'),'utf8')).state;
  assert.equal(state.historicalValueHash,before.historicalValueHash);assert.equal(state.duration,45);assert.equal(state.active,true);assert.equal(state.name,'Control operativo sintético verificado');
}
fs.writeFileSync(file,JSON.stringify({at:new Date().toISOString(),kind:'local-synthetic-only',action,state,passed:true},null,2));
console.log(JSON.stringify({action,passed:true,evidence:file}));
