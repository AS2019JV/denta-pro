'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {performance} = require('node:perf_hooks');
const {createClient} = require('@supabase/supabase-js');
const rt = require('./clinia-local-runtime.cjs');
const output = path.join(rt.repo,'docs/production/evidence/2026-09-28-performance/api-latency.json');
async function main() {
  if(fs.existsSync(output)) throw Error('Evidence exists; refusing overwrite');
  rt.inspectLocal();
  const actor = JSON.parse(fs.readFileSync(path.join(rt.privateDir,'encargo02-actors.private.json'),'utf8')).owner_A;
  const client = createClient(rt.url,rt.keys().anon,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{
    if(new URL(typeof input==='string'?input:input.url).origin!==rt.url) throw Error('Non-local request refused');
    return fetch(input,{...init,signal:AbortSignal.timeout(15000)});
  }}});
  const signed = await client.auth.signInWithPassword({email:actor.email,password:actor.password});
  if(signed.error) throw Error('Synthetic sign-in failed');
  const clinic = '33333333-3333-4333-8333-333333333333';
  const role = await client.rpc('get_clinic_member_role',{check_clinic_id:clinic});
  if(role.error || role.data!=='clinic_owner') throw Error('Live synthetic authority required');
  const {calendarRange,clinicDayKey} = await import('../lib/agenda.mjs');
  const range = calendarRange(clinicDayKey(),'list');
  const measures=[];
  const definitions=[
    ['dashboard_patients','get_patient_demographics',{p_clinic_id:clinic,p_limit:10,p_search:''}],
    ['dashboard_schedule','get_clinic_schedule',{p_clinic_id:clinic,p_start:range.start,p_end:range.end}],
    ['patient_search','get_patient_demographics',{p_clinic_id:clinic,p_limit:25,p_search:'Paciente'}],
  ];
  for(const [name,rpc,args] of definitions) {
    const samples=[];let returnedCount;
    for(let index=0;index<21;index++) {
      const start=performance.now(),response=await client.rpc(rpc,args);
      if(response.error) throw Error('Local '+name+' failed: '+response.error.code);
      const elapsed=performance.now()-start;
      if(index>0)samples.push(Math.round(elapsed*10)/10);
      returnedCount=response.data.total_count;
    }
    const sorted=[...samples].sort((a,b)=>a-b);
    measures.push({name,samplesMs:samples,count:samples.length,p50Ms:sorted[Math.ceil(sorted.length*.5)-1],p95Ms:sorted[Math.ceil(sorted.length*.95)-1],maxMs:sorted.at(-1),returnedCount,warmupRequests:1});
  }
  const result={state:'MEASURED_LOCAL_BOUNDED',measuredAt:new Date().toISOString(),origin:rt.url,actor:'synthetic-owner',concurrency:1,measures,limitations:[
    '20 sequential samples after one warmup per RPC; elapsed time includes SDK/network/PostgREST/SQL.',
    '33 synthetic patients, no production traffic or remote latency.',
    'This does not validate the 5000-patient/10-user gate, EXPLAIN plans or field Core Web Vitals.'
  ]};
  fs.writeFileSync(output,JSON.stringify(result,null,2));
  console.log(JSON.stringify(measures.map(({name,p50Ms,p95Ms,returnedCount})=>({name,p50Ms,p95Ms,returnedCount}))));
}
main().catch(()=>{console.error('Bounded local measurement failed; no credentials disclosed');process.exitCode=1});
