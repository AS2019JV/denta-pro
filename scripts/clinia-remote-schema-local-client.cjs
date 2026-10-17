'use strict';
// Use an existing local pg_dump binary and a short-lived CLI login; schema only.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const privateDir=path.join(root,'tools/local-supabase/supabase/.temp');
const docker=path.join(process.env.LOCALAPPDATA||'','Programs/DockerDesktop/resources/bin/docker.exe');
const image='sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb';
const targets={stage:{ref:'phihonofwyerpfgqfekt',host:'aws-0-sa-east-1.pooler.supabase.com',dryRun:'2026-09-29-staging-dry-run.private.log',out:'2026-09-29-staging-schema-local-client.sql'},linked:{ref:'leqsrfyjvuxxdsubjjin',host:'aws-1-sa-east-1.pooler.supabase.com',dryRun:'2026-09-29-linked-dry-run.private.log',out:'2026-09-29-linked-schema-local-client.sql'}};
function inspect(){
  const r=spawnSync(docker,['context','show'],{encoding:'utf8',windowsHide:true,timeout:10000});
  if(r.error||r.status!==0||r.stdout.trim()!=='desktop-linux')throw Error('Local Docker Desktop context required');
  const i=spawnSync(docker,['inspect','supabase_db_clinia-acceptance','--format','{{.Image}}'],{encoding:'utf8',windowsHide:true,timeout:10000});
  if(i.error||i.status!==0||i.stdout.trim()!==image)throw Error('Reviewed local PostgreSQL image is unavailable');
}
function temporaryLogin(text,target){
  if(!text.includes('DRY RUN: *only* printing the pg_dump script')||!text.includes('    --schema-only')||!text.includes('    --schema=public|logs|security_internal'))throw Error('Not the reviewed schema-only CLI script');
  const values={};for(const name of ['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE']){
    const m=text.match(new RegExp('^export '+name+'="([^"\\r\\n]+)"\\r?$', 'm'));
    if(!m)throw Error('Missing temporary login field '+name);values[name]=m[1];
  }
  if(values.PGHOST!==target.host||values.PGPORT!=='5432'||values.PGDATABASE!=='postgres'||values.PGUSER!=='cli_login_postgres.'+target.ref||values.PGPASSWORD.length<16)throw Error('Unexpected remote login target');
  return values;
}
function main(){
  const key=process.argv[2];if(process.argv.length!==3||!Object.hasOwn(targets,key))throw Error('Use stage or linked');
  const target=targets[key],source=path.join(privateDir,target.dryRun),output=path.join(privateDir,target.out),diagnostic=output+'.private.log';
  if(fs.existsSync(output)||fs.existsSync(diagnostic))throw Error('Evidence already exists; refuse overwrite');
  inspect();const values=temporaryLogin(fs.readFileSync(source,'utf8'),target);
  const args=['run','--rm','--pull=never','--network','bridge','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','256m','--cpus','1',
    '--entrypoint','pg_dump',...Object.keys(values).flatMap(name=>['-e',name]),image,'--schema-only','--quote-all-identifiers','--role','postgres','--schema=public','--schema=logs','--schema=security_internal'];
  const stdout=fs.openSync(output,'wx'),stderr=fs.openSync(diagnostic,'wx');let r;
  try{r=spawnSync(docker,args,{env:{...process.env,...values},windowsHide:true,timeout:90000,maxBuffer:1024*1024,stdio:['ignore',stdout,stderr]});}
  finally{fs.closeSync(stdout);fs.closeSync(stderr);}
  if(r.error||r.status!==0)throw Error('Local pg_dump failed; private diagnostic and partial output preserved');
  const bytes=fs.readFileSync(output),s=bytes.toString('utf8');
  if(bytes.length<1000||!s.includes('PostgreSQL database dump')||!s.includes('CREATE TABLE "public"."patients"')||/\bCOPY\s+"public"\."patients"|\bINSERT INTO\s+"public"\."patients"/i.test(s))throw Error('Schema-only output failed safety validation; preserve for review');
  console.log(JSON.stringify({state:'SCHEMA_ONLY_DUMP_CREATED_NOT_RESTORE_TESTED',projectRef:target.ref,file:output,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),clientImage:image}));
}
try{main();}catch(e){console.error(e.message);process.exitCode=1;}
