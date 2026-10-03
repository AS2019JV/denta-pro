'use strict';
// Only the explicitly authorized hosted staging project. No dotenv injection or key output.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..'),project='phihonofwyerpfgqfekt',origin='https://'+project+'.supabase.co';
const buckets=['clinic-branding','doctor-avatars','patient-avatars','patient-files'];
function readConfig(){
  const filename=path.join(repo,'.env.staging.local');assert.ok(fs.existsSync(filename),'Private .env.staging.local required');assert.ok(!fs.lstatSync(filename).isSymbolicLink(),'Staging env symlink refused');
  const values={};
  for(const line of fs.readFileSync(filename,'utf8').split(/\r?\n/)){
    if(!line.trim()||line.trim().startsWith('#'))continue;
    const match=line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);assert.ok(match,'Malformed staging environment assignment');
    let value=match[2];if(value.startsWith('"')||value.startsWith("'")){assert.equal(value.at(-1),value[0],'Unclosed staging value');value=value.slice(1,-1);}else value=value.split(/\s+#/)[0].trim();
    assert.ok(!Object.hasOwn(values,match[1]),'Duplicate staging environment assignment');values[match[1]]=value;
  }
  assert.equal(values.NEXT_PUBLIC_SUPABASE_URL,origin,'Exact authorized staging URL required');
  for(const flag of ['VERCEL','CLINIA_LOCAL_ACCEPTANCE','NEXT_PUBLIC_CLINIA_LOCAL_ACCEPTANCE','NEXT_PUBLIC_CLINIA_OFFLINE_VERIFY'])assert.notEqual(values[flag],'1','Local verification/deployment override refused');
  const role=key=>{try{return JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role;}catch{return null;}};
  const anon=values.NEXT_PUBLIC_SUPABASE_ANON_KEY,service=values.SUPABASE_SERVICE_ROLE_KEY;
  assert.ok(typeof anon==='string'&&(/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(anon)||role(anon)==='anon'),'Publishable/anon staging key required');
  assert.ok(typeof service==='string'&&(/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(service)||role(service)==='service_role'),'Server-only staging credential required');
  assert.notEqual(anon,service,'Public and privileged keys must differ');
  return {project,origin,anon,service};
}
async function request(config,route,{method='GET',body,token=config.anon,privileged=false,raw=false}={}){
  assert.equal(config.project,project);assert.equal(config.origin,origin);assert.ok(route.startsWith('/')&&!route.startsWith('//'));
  const url=new URL(route,origin);assert.equal(url.origin,origin);assert.ok(['/auth/v1/','/storage/v1/','/rest/v1/'].some(prefix=>url.pathname.startsWith(prefix)),'Provider route required');
  const response=await fetch(url,{method,headers:{apikey:privileged?config.service:config.anon,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:(raw?body:JSON.stringify(body)),redirect:'error',signal:AbortSignal.timeout(20000)});
  const bytes=Buffer.from(await response.arrayBuffer());let data=null;if(bytes.length&&!raw){try{data=JSON.parse(bytes.toString());}catch{throw Error('Unexpected staging provider response format');}}
  return {status:response.status,data,bytes};
}
async function prepare(mode){
  assert.ok(['inspect','prepare-buckets'].includes(mode));const config=readConfig(),startedAt=new Date().toISOString();
  const directory=path.join(repo,'docs/production/evidence/2026-10-03-staging'),name=mode+'-'+Date.now()+'.json';fs.mkdirSync(directory,{recursive:true});
  const report={status:'PARTIALLY VERIFIED',project,startedAt,mode,requests:[],checks:[],limits:['Server key authority verified against exact staging provider; no deployed environment/configuration claim','Bucket API configuration alone does not prove ordinary JWT Storage authorization']};
  const call=async(route,options)=>{const r=await request(config,route,options);report.requests.push({method:options?.method||'GET',path:route.split('?')[0],status:r.status});return r;};
  try{
    let listed=await call('/storage/v1/bucket',{privileged:true,token:config.service});assert.equal(listed.status,200,'Staging server credential cannot list buckets');assert.ok(Array.isArray(listed.data));
    assert.ok(listed.data.every(b=>buckets.includes(b.id)),'Unreviewed occupied bucket refused');
    for(const id of buckets){
      let found=listed.data.find(b=>b.id===id);
      const image=id!=='patient-files',spec={id,name:id,public:false,file_size_limit:(image?5:10)*1024*1024,allowed_mime_types:image?['image/jpeg','image/png','image/webp']:['application/pdf','image/jpeg','image/png','image/webp']};
      if(!found&&mode==='prepare-buckets'){const created=await call('/storage/v1/bucket',{method:'POST',body:spec,privileged:true,token:config.service});assert.ok([200,201].includes(created.status),'Private staging bucket creation failed');}
      if(found)assert.equal(found.public,false,'Existing public staging bucket requires explicit review');
    }
    listed=await call('/storage/v1/bucket',{privileged:true,token:config.service});assert.equal(listed.status,200);assert.ok(Array.isArray(listed.data));
    report.buckets=listed.data.map(b=>({id:b.id,public:b.public,fileSizeLimit:b.file_size_limit,allowedMimeTypes:b.allowed_mime_types}));
    if(mode==='prepare-buckets')for(const id of buckets){const found=listed.data.find(b=>b.id===id);assert.ok(found);assert.equal(found.public,false);assert.equal(found.file_size_limit,(id==='patient-files'?10:5)*1024*1024);assert.deepEqual([...found.allowed_mime_types].sort(),(id==='patient-files'?['application/pdf','image/jpeg','image/png','image/webp']:['image/jpeg','image/png','image/webp']).sort());}
    report.checks.push({name:'Exact staging server credential accepted by privileged official Storage API',status:'VERIFIED'});
    if(mode==='prepare-buckets')report.checks.push({name:'Four buckets created/rechecked private with MIME/size limits',status:'VERIFIED'});
    report.status='VERIFIED';
  }catch(error){report.error=error.code||'Provider/configuration verification failed';process.exitCode=1;}
  finally{report.completedAt=new Date().toISOString();fs.writeFileSync(path.join(directory,name),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,project,mode,evidence:path.join(directory,name),checks:report.checks.length,error:report.error||null}));}
}
if(require.main===module){if(process.argv.length!==3)throw Error('Use inspect or prepare-buckets');prepare(process.argv[2]).catch(()=>{console.error('Staging operation refused; no credential contents emitted');process.exitCode=1;});}
module.exports={readConfig,request,repo,project,origin,buckets};
