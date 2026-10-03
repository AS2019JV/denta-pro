'use strict';
// One-shot fresh local API installation. Existing primary application data stops it.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const local=require('./clinia-local-runtime.cjs');
const out=path.join(local.repo,'docs/production/evidence/2026-09-27/primary-install');
const result={startedAt:new Date().toISOString(),environment:'local-synthetic-primary',steps:[],state:'PARTIAL',
  limits:['Not remote parity or a backup restore','No browser or external email acceptance','Clinical release NOT READY']};
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
function file(relative){return fs.readFileSync(path.join(local.repo,relative),'utf8');}
function executeSql(name,relative,role='supabase_admin',extra=''){
  const source=file(relative); result.steps.push({name,file:relative,sha256:hash(source),state:'STARTED'});
  const text=local.sqlFile('postgres',relative,role,extra);
  fs.writeFileSync(path.join(out,name+'.log'),text+'\n');
  result.steps.at(-1).state='COMMITTED';
}
async function main(){
  if(fs.existsSync(out)) throw new Error('Evidence already exists; do not replay installation');
  fs.mkdirSync(out,{recursive:true});
  result.runtime=local.inspectLocal();
  const before=JSON.parse(local.sql('postgres',"SELECT json_build_object('patients',to_regclass('public.patients'),'users',(SELECT count(*) FROM auth.users),'objects',(SELECT count(*) FROM storage.objects),'buckets',(SELECT count(*) FROM storage.buckets),'authTriggers',(SELECT coalesce(json_agg(json_build_object('name',t.tgname,'definition',pg_get_triggerdef(t.oid),'callback',t.tgfoid::regprocedure::text)),'[]') FROM pg_trigger t WHERE t.tgrelid='auth.users'::regclass AND NOT t.tgisinternal));"));
  result.before=before;
  if(before.patients!==null||before.users!==0||before.objects!==0||before.buckets!==0||before.authTriggers.length!==0)
    throw new Error('Reviewed genuinely empty primary template required');
  const baseline='docs/production/reconciliation/scoped-baseline/prod-deny-v2.sql';
  const manifest=JSON.parse(file('docs/production/reconciliation/scoped-baseline/prod-deny-v2.manifest.json'));
  if(hash(file(baseline))!==manifest.sqlSha256) throw new Error('Baseline reviewed hash differs');
  const m7='supabase/migrations/20260922194927_enforce_clinical_tenant_links_and_rights_audit.sql';
  if(hash(file(m7))!=='cd6fbf5ab50dc4b214b587febacb7534fb3816b1f0c76767d83aa1b6519ea47d') throw new Error('M7 reviewed hash differs');
  executeSql('baseline',baseline);
  executeSql('m7',m7);
  executeSql('owners','docs/production/reconciliation/encargo01_local_m7_owners.sql');
  const keys=local.keys();
  const admin=createClient(local.url,keys.service,{auth:{persistSession:false,autoRefreshToken:false}});
  const configs={
    'patient-files':{public:false,fileSizeLimit:10*1024*1024,allowedMimeTypes:['application/pdf','image/png','image/jpeg']},
    'patient-avatars':{public:false,fileSizeLimit:2*1024*1024,allowedMimeTypes:['image/png','image/jpeg','image/webp']},
    'clinic-branding':{public:false,fileSizeLimit:2*1024*1024,allowedMimeTypes:['image/png','image/jpeg','image/webp']},
    'doctor-avatars':{public:false,fileSizeLimit:2*1024*1024,allowedMimeTypes:['image/png','image/jpeg','image/webp']}
  };
  const buckets=await admin.storage.listBuckets();
  if(buckets.error) throw new Error('Genuine Storage bucket inventory failed');
  result.buckets=[];
  for(const [id,options] of Object.entries(configs)){
    const exists=buckets.data.some(b=>b.id===id);
    const r=exists?await admin.storage.updateBucket(id,options):await admin.storage.createBucket(id,options);
    if(r.error) throw new Error(`Genuine Storage provisioning failed: ${id}`);
    result.buckets.push({id,operation:exists?'update':'create',...options});
  }
  executeSql('encargo02','docs/production/reconciliation/encargo02/forward.sql','postgres',"SET app.encargo02_authorized='reviewed-local-forward';\n");
  executeSql('verify','docs/production/reconciliation/encargo02/verify.sql','postgres',"SET app.encargo02_authorized='reviewed-local-forward';\n");
  result.state='LOCAL_SQL_INSTALLED_JWT_PENDING';
}
main().catch(e=>{result.error=e.message;process.exitCode=1;console.error(e.message);}).finally(()=>{
  result.completedAt=new Date().toISOString();
  if(fs.existsSync(out))fs.writeFileSync(path.join(out,'execution.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({state:result.state,steps:result.steps.map(s=>({name:s.name,state:s.state})),evidence:out,error:result.error||null}));
});
