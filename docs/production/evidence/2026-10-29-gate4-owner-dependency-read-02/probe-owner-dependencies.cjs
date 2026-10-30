'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT='C:/Users/aleja/.codex/worktrees/clinia-gate4-recovery/denta-pro',DIR=__dirname,ACTOR='supabase_storage_admin',RC='ba47f5273fef85fca1cf92784c8ff8c7b50faf54';
const SQL_SHA='d46f58333f766521eeedc32a0a32ddd7e5de158325111ff6fc770767862d5752';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function need(v,code){if(!v){const e=Error(code);e.code=code;throw e;}}
function validateWindow(t,now){need(Number.isFinite(now)&&Number.isFinite(Date.parse(t.windowStartUtc))&&Number.isFinite(Date.parse(t.windowDeadlineUtc))&&Date.parse(t.windowDeadlineUtc)-Date.parse(t.windowStartUtc)===900000&&now>=Date.parse(t.windowStartUtc)&&now+90000<Date.parse(t.windowDeadlineUtc),'TURN_WINDOW_REFUSED');}
function verifyApprovedBundle(t,read=fs.readFileSync){
 const b=t.probeSourceBundle;need(b&&typeof b.reference==='string'&&/^[a-f0-9]{64}$/.test(b.sha256||''),'PROBE_BUNDLE_BINDING_REQUIRED');
 const ref=path.resolve(b.reference).replaceAll('\\','/');need((ref.startsWith(ROOT+'/docs/production/evidence/2026-10-29-gate4-owner-dependency-read-02/')||ref.startsWith('C:/Users/aleja/Documents/0-dev/denta-pro/docs/production/rc/2026-10-27-v5/'))&&!ref.includes('/.gate4-private/'),'PROBE_BUNDLE_PATH_REFUSED');
 const raw=read(ref);need(hash(raw)===b.sha256,'APPROVED_BUNDLE_HASH_DRIFT');const m=JSON.parse(raw),names=['probe-owner-dependencies.cjs','password-field-reader.cjs','assert-private-reference.ps1','owner-dependency-current.sql'],prefix='docs/production/evidence/2026-10-29-gate4-owner-dependency-read-02/';
 need(m.files?.length===4&&new Set(m.files.map(x=>x.path)).size===4&&names.every(n=>m.files.some(x=>x.path===prefix+n)),'APPROVED_PROBE_SOURCE_SET_REFUSED');
 need(m.files.find(x=>x.path===prefix+'owner-dependency-current.sql').sha256===SQL_SHA,'APPROVED_SQL_HASH_REFUSED');
 for(const x of m.files){const data=read(path.join(ROOT,x.path));need(data.length===x.bytes&&hash(data)===x.sha256,'APPROVED_PROBE_SOURCE_HASH_DRIFT');}return {manifestSHA256:b.sha256,sourceFilesVerified:4};
}
function clientOutcome(q){const terminated=Number.isInteger(q.status)&&!q.error&&!q.signal,normal=terminated&&q.status===0;return {clientProcessTerminationObserved:terminated,normalClientExit:normal,classification:normal?'NORMAL_PSQL_EXIT_READ_ONLY_SCRIPT_PROTOCOL':terminated?'PSQL_ERROR_EXIT_REMOTE_CLOSURE_NOT_INDEPENDENTLY_PROVEN':'TRANSPORT_OR_SIGNAL_UNKNOWN_PRESERVE_SLOT',remoteSessionClosureIndependentlyVerified:false};}
function buildArgs(p,address,sql){
 need(/^10\.253\.9\.\d{1,3}$/.test(address),'SERVER_ADDRESS_REFUSED');
 const info=`host=${p.m0.spec.services.db.container_name} hostaddr=${address} port=5432 dbname=postgres user=${ACTOR} connect_timeout=5 passfile=/dev/null require_auth=scram-sha-256,md5 options='-c default_transaction_read_only=on -c statement_timeout=3000 -c lock_timeout=1000 -c idle_in_transaction_session_timeout=5000'`;
 return ['--context','desktop-linux','exec','-i','--user','postgres',p.contract.containers.db.id,'/usr/bin/env','-u','PGPASSWORD','-u','PGPASSFILE','-u','PGSERVICE','-u','PGSERVICEFILE','-u','PGUSER','-u','PGDATABASE','-u','PGHOST','-u','PGHOSTADDR','-u','PGPORT','-u','PGOPTIONS','-u','PGTARGETSESSIONATTRS','psql','-W','-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-d',info,'-c',sql];
}
function validOID(v,allowZero=false){return typeof v==='string'&&/^(0|[1-9][0-9]{0,9})$/.test(v)&&(allowZero||v!=='0')&&BigInt(v)<=4294967295n;}
function validateFrozenAddress(address){need(address==='10.253.9.2','FROZEN_SERVER_ADDRESS_REFUSED');}
function validateQueryTurn(t,expectedTurn){need(t.id==='G4-OWNER-DEPENDENCY-READ-02'&&t.id===expectedTurn&&t.approvedSQLSHA256===SQL_SHA,'TURN_QUERY_SCOPE_REFUSED');}
function interpret(q,secret,address){
 const out=Buffer.isBuffer(q.stdout)?q.stdout:Buffer.alloc(0),err=Buffer.isBuffer(q.stderr)?q.stderr:Buffer.alloc(0);
 if(out.includes(secret)||err.includes(secret))return {status:'SECRET_ECHO_DETECTED_OUTPUT_DISCARDED'};
 if(out.length+err.length>65536)return {status:'OUTPUT_BOUND_REFUSED'};
 if(q.error||q.signal||q.status!==0){const e=err.toString('utf8');return {status:'AUTH_OR_QUERY_NOT_VERIFIED',nativeExitCode:q.status,timeout:q.error?.code==='ETIMEDOUT',knownSQLSTATE:['28P01','42501','3D000','57P03','57014','55P03'].filter(x=>new RegExp('(?:ERROR|FATAL):\\s+'+x+':').test(e)),authenticationFailed:/password authentication failed/i.test(e),connectionRefused:/connection refused/i.test(e),authenticationMethodRequirementRejected:/require_auth|authentication method|authentication requirement/i.test(e),actorExistenceOrCredentialValidityNotInferredFromFailure:true};}
 let j;try{const marker='G4_OWNER_DEPENDENCY_CURRENT_V1:',rows=out.toString('utf8').split(/\r?\n/).filter(x=>x.length);if(rows.length!==1||!rows[0].startsWith(marker))return {status:'DEPENDENCY_PROTOCOL_REFUSED'};j=JSON.parse(rows[0].slice(marker.length));}catch{return {status:'DEPENDENCY_PROTOCOL_REFUSED'};}
 let failureField='metadata.shape';const check=(field,f)=>{failureField=field;f();},keys=(v,names)=>{assert.ok(v&&typeof v==='object'&&!Array.isArray(v));assert.deepEqual(Object.keys(v).sort(),[...names].sort());};
 try{
  check('metadata.shape',()=>keys(j,['observationState','postPStatus','fullPAuthority','identityChecks','dependencies']));
  check('observationState',()=>assert.equal(j.observationState,'CURRENT_ONLY'));
  check('postPStatus',()=>assert.equal(j.postPStatus,'NOT_VERIFIED'));
  check('fullPAuthority',()=>assert.equal(j.fullPAuthority,'NOT_VERIFIED'));
  const identityKeys=['session_actor_matches','current_actor_matches','database_matches','version_matches','read_only','default_read_only','server_port_matches','server_address_matches','original_object_owner_matches','accepted'];
  check('identityChecks.shape',()=>keys(j.identityChecks,identityKeys));
  // A single returned SQL row and exit0 are never sufficient. accepted=false/NULL rejects first.
  check('identityChecks.accepted',()=>assert.equal(j.identityChecks.accepted,true));
  for(const field of identityKeys.filter(x=>x!=='accepted'))check('identityChecks.'+field,()=>assert.equal(j.identityChecks[field],true));
  check('guardedServerAddress',()=>validateFrozenAddress(address));
  check('dependencies.length',()=>assert.ok(Array.isArray(j.dependencies)&&j.dependencies.length===3));
  const expected=[['auth','role',''],['auth','uid',''],['storage','foldername','25']],depKeys=['schema','function','expectedInputTypeOIDs','schemaExists','exactInputSignatureExists','namedRoutineCount','functionOID','ownerOID','returnTypeOID','returnsSet','securityDefiner','variadicTypeOID','defaultArgumentCount','schemaUsage','functionExecute','status'];
  for(let i=0;i<3;i++){
   const x=j.dependencies[i],prefix='dependencies.'+i+'.',e=expected[i];
   check(prefix+'shape',()=>keys(x,depKeys));
   for(const [field,value] of [['schema',e[0]],['function',e[1]],['expectedInputTypeOIDs',e[2]]])check(prefix+field,()=>assert.equal(x[field],value));
   for(const field of ['schemaExists','exactInputSignatureExists','schemaUsage','functionExecute'])check(prefix+field,()=>assert.equal(x[field],true));
   check(prefix+'namedRoutineCount',()=>assert.ok(Number.isSafeInteger(x.namedRoutineCount)&&x.namedRoutineCount>=1&&x.namedRoutineCount<=4294967295));
   for(const field of ['functionOID','ownerOID','returnTypeOID'])check(prefix+field,()=>assert.ok(validOID(x[field])));
   for(const field of ['returnsSet','securityDefiner'])check(prefix+field,()=>assert.equal(typeof x[field],'boolean'));
   check(prefix+'variadicTypeOID',()=>assert.ok(validOID(x.variadicTypeOID,true)));
   check(prefix+'defaultArgumentCount',()=>assert.ok(Number.isSafeInteger(x.defaultArgumentCount)&&x.defaultArgumentCount>=0&&x.defaultArgumentCount<=(i===2?1:0)));
   check(prefix+'status',()=>assert.equal(x.status,'CURRENT_METADATA_ACCESS_PRESENT'));
  }
 }catch{return {status:'DEPENDENCY_METADATA_REFUSED',failureField};}
 return {status:'PASS_CURRENT_DEPENDENCY_METADATA_ONLY',metadata:j,nativeExitCode:q.status,rawOutputDiscarded:true,limits:['Current catalog/privilege observation only','No Auth/Storage function invocation or body/transitive semantic proof','Post-P resolution/type compatibility and full P authority NOT VERIFIED'],credentialChallengeRequiredByClient:'scram-sha-256 or md5; no trust/certificate/GSS-only success accepted'};
}
function oneAttempt(state,io,args,secret,address){
 need(state.authenticationAttempts===0,'SECOND_AUTHENTICATION_ATTEMPT_REFUSED');let input=Buffer.alloc(secret.length+1);secret.copy(input);input[input.length-1]=10;state.authenticationAttempts=1;
 let q;try{q=io(args,input);return interpret(q,secret,address);}finally{input.fill(0);if(q){for(const b of [q.stdout,q.stderr])if(Buffer.isBuffer(b))b.fill(0);}}
}
async function main(argv){
 need(argv[0]==='execute'&&argv[1]==='--turn-file'&&argv[3]==='--turn-id'&&argv.length===5,'EXPLICIT_CONFIRMED_TURN_ARGUMENTS_REQUIRED');
 const turnPath=path.resolve(argv[2]),expectedTurn=argv[4];need(turnPath.replaceAll('\\','/').startsWith('C:/Users/aleja/Documents/0-dev/denta-pro/docs/production/rc/2026-10-27-v5/'),'PUBLIC_TURN_PATH_REFUSED');
 const tb=fs.readFileSync(turnPath),t=JSON.parse(tb),deadline=Date.parse(t.windowDeadlineUtc),api=require(path.join(ROOT,'scripts/clinia-gate4-m1-transport.cjs')),p=api.loadPackage();api.validatePackage(p);
 need(t.id===expectedTurn&&t.operator==='Gate4'&&t.target==='clinia-gate3-20261020-a9'&&t.candidateSHA===RC&&t.parallelReadersAllowed===false&&t.parallelWritersAllowed===false&&t.maxAuthAttempts===1&&t.actorDBRole===ACTOR,'TURN_SCOPE_REFUSED');validateQueryTurn(t,expectedTurn);validateWindow(t,Date.now());const approvedProbeSource=verifyApprovedBundle(t);
 need(t.referenceContractSHA256==='38d127338f8a497058b1748b693827a5f0f1e364220cc4d4052326ef6cf42a4f','REFERENCE_CONTRACT_REFUSED');need(hash(fs.readFileSync('C:/Users/aleja/Documents/0-dev/denta-pro/docs/production/rc/2026-10-27-v5/owner-scoped-preparation/OWNER_SCOPED_CONTRACT.proposed.v1.json'))===t.referenceContractSHA256,'REFERENCE_CONTRACT_FILE_DRIFT');need(process.platform==='win32'&&process.versions.node==='22.20.0'&&process.cwd().replaceAll('\\','/')===ROOT,'NATIVE_HOST_REFUSED');
 const fd=fs.openSync(path.join(DIR,'native-attempt.json'),'wx'),r={gate:'Gate4',phase:'OWNER_DEPENDENCY_CURRENT_READ_ONLY',turn:t.id,turnStartUtc:t.windowStartUtc,turnDeadlineUtc:t.windowDeadlineUtc,turnRecordSHA256:hash(tb),startedAtUtc:new Date().toISOString(),state:'ADMISSION',approvedProbeSource,authenticationAttempts:0,credentialFieldConsumed:false,DBDDL:0,grantsRolesOwners:0,newResources:0,rawOutputPrintedOrPersisted:false,passwordOrPasswordHashesPrintedOrPersisted:false,privateFilesModified:false,ops:[]};
 let secret,referenceFD;const save=()=>api.persistRecord(fs,fd,r),docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe');
 const call=(exe,args,kind,input,timeout=15000)=>{need(Date.now()+timeout<deadline,'TURN_EXPIRED');const at=Date.now(),x=cp.spawnSync(exe,args,{shell:false,windowsHide:true,timeout,maxBuffer:32768,...(input?{input}:{} )});r.ops.push({kind,argv:args,startedAtUtc:new Date(at).toISOString(),elapsedSeconds:(Date.now()-at)/1000,exitCode:x.status,errorCode:x.error?.code||null,signal:x.signal||null});save();return x;};
 const read=(args,kind)=>{const x=call(docker,['--context','desktop-linux',...args],kind);need(!x.error&&!x.signal&&x.status===0,'NATIVE_GUARD_'+kind.toUpperCase());return x.stdout.toString('utf8').trim();};
 try{
  const g=call('C:/Users/aleja/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git/cmd/git.exe',['branch','--show-current'],'branch');need(g.status===0&&g.stdout.toString().trim()==='codex/gate4-recovery-ops','OWN_BRANCH_REFUSED');
  const eb=fs.readFileSync('C:/Users/aleja/Documents/0-dev/denta-pro/docs/production/rc/2026-10-24-v1/RC_HANDOFF.json'),h=JSON.parse(eb);need(h.candidate.sha===RC&&h.ci.runId===40622870737&&h.ci.conclusion==='success'&&h.deployment.id==='3W6A39WNaeysWV1gf24KyYbNCtUx'&&h.deployment.state==='Ready','CANONICAL_IDENTITY_REFUSED');r.candidateSHA=RC;r.canonicalSHA256=hash(eb);
  need(read(['context','show'],'context')==='desktop-linux','CONTEXT_REFUSED');const endpoint=read(['context','inspect','desktop-linux','--format','{{.Endpoints.docker.Host}}'],'endpoint');need(endpoint===p.contract.endpoint,'LOCAL_ENDPOINT_REFUSED');
  const fmt=fs.readFileSync(path.join(ROOT,'scripts/clinia-gate4-m1-transport.cjs'),'utf8').match(/const INSPECT_FORMAT='([^'\r\n]+)';/)[1];const containers=read(['inspect','--format',fmt,...Object.values(p.contract.containers).map(x=>x.id)],'containers').split(/\r?\n/).map(x=>JSON.parse(x)),network=JSON.parse(read(['network','inspect',p.contract.network.name,'--format','{"Id":{{json .Id}},"Name":{{json .Name}},"Internal":{{json .Internal}},"IPAM":{{json .IPAM}},"Containers":{{json .Containers}}}'],'network')),volumes=read(['volume','inspect',...p.contract.volumes.map(x=>x.name),'--format','{"name":{{json .Name}},"createdAt":{{json .CreatedAt}},"driver":{{json .Driver}}}'],'volumes').split(/\r?\n/).map(x=>JSON.parse(x)),targetNames=read(['ps','-a','--format','{{.Names}}'],'targetnames').split(/\r?\n/).filter(x=>x.includes(p.contract.target.project));api.inventory({endpoint,containers,network,volumes,targetNames},p);r.originalPhysicalGuardsPassed=true;
  const control=read(['exec','--user','postgres',p.contract.containers.db.id,'pg_controldata','/var/lib/postgresql/data'],'controlidentity');const sid=control.match(/^Database system identifier:\s*(\d+)\s*$/m);need(sid&&sid[1]===p.contract.target.systemIdentifier,'SYSTEM_IDENTIFIER_REFUSED');r.systemIdentifierObserved=sid[1];r.otherDatabaseUsersAuthenticated=0;validateFrozenAddress(containers.find(x=>x.Id===p.contract.containers.db.id).NetworkSettings.Networks[p.contract.network.name].IPAddress);r.frozenServerAddressMatchedBeforePrivate=true;
  const custody=call('C:/Users/aleja/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe',['-NoLogo','-NoProfile','-NonInteractive','-File',path.join(DIR,'assert-private-reference.ps1')],'private-reference-guard');need(custody.status===0,'PRIVATE_CUSTODY_OR_REFERENCE_REFUSED');r.privateReferenceGuard=JSON.parse(custody.stdout.toString());
  const file=path.join(ROOT,'.gate4-private/managed-a9/credentials.private.json');need(fs.realpathSync(file).replaceAll('\\','/').toLowerCase()===file.replaceAll('\\','/').toLowerCase(),'PRIVATE_REFERENCE_REALPATH_REFUSED');const before=fs.lstatSync(file);need(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1&&before.size>=170&&before.size<=16384,'PRIVATE_REFERENCE_METADATA_REFUSED');need(Date.now()+30000<deadline,'INSUFFICIENT_AUTH_WINDOW');referenceFD=fs.openSync(file,'r');const opened=fs.fstatSync(referenceFD);need(opened.dev===before.dev&&opened.ino===before.ino&&opened.size===before.size&&opened.mtimeMs===before.mtimeMs,'PRIVATE_REFERENCE_REPLACED');validateWindow(t,Date.now());secret=require('./password-field-reader.cjs').readPasswordField(fs,referenceFD,opened.size);r.credentialProjectBindingObserved=true;const after=fs.fstatSync(referenceFD);need(after.dev===opened.dev&&after.ino===opened.ino&&after.size===opened.size&&after.mtimeMs===opened.mtimeMs,'PRIVATE_REFERENCE_CHANGED');fs.closeSync(referenceFD);referenceFD=undefined;r.credentialFieldConsumed=true;r.onlyPasswordSelectedNoFullJSONParse=true;r.credentialFileExistsObserved=true;save();
  const address=containers.find(x=>x.Id===p.contract.containers.db.id).NetworkSettings.Networks[p.contract.network.name].IPAddress,sql=fs.readFileSync(path.join(DIR,'owner-dependency-current.sql'),'utf8'),args=buildArgs(p,address,sql);r.publicSQLSHA256=hash(sql);r.state='ONE_DIRECT_OWNER_AUTH_SUBMITTED';save();
  validateWindow(t,Date.now());r.result=oneAttempt(r,(a,input)=>{save();const q=call(docker,a,'single-direct-owner-read',input,15000);r.clientOutcome=clientOutcome(q);save();return q;},args,secret,address);r.state=r.result.status;r.readOnlyScriptRollbackCompletedByNormalProtocol=r.result.status.startsWith('PASS_')&&r.clientOutcome.normalClientExit;
 }catch(e){r.state=r.authenticationAttempts?'AUTH_OR_IDENTITY_NOT_VERIFIED_PRESERVE':'PRE_AUTH_GUARD_REFUSED';const fixed=['REFERENCE_PROJECT_REFUSED','REFERENCE_FORMAT_REFUSED','REFERENCE_SIZE_REFUSED','PASSWORD_FORMAT_REFUSED'];r.failureCode=fixed.find(x=>String(e.message).includes(x))||(/^[A-Z0-9_]+$/.test(e.code||'')?e.code:'BOUNDED_PROBE_GUARD_REFUSED');}
 finally{if(referenceFD!==undefined)fs.closeSync(referenceFD);if(secret)secret.fill(0);r.completedAtUtc=new Date().toISOString();r.clientOutcome||={clientProcessTerminationObserved:false,normalClientExit:false,classification:r.authenticationAttempts?'CLIENT_OUTCOME_NOT_OBSERVED_PRESERVE_SLOT':'AUTH_CLIENT_NOT_STARTED',remoteSessionClosureIndependentlyVerified:false};r.secretBufferReferencesDiscarded=true;r.noRetry=true;r.originalCustodyPreserved=true;r.exclusiveSlotNotAutomaticallyReleased=true;save();fs.closeSync(fd);}
 console.log(JSON.stringify(r));if(!r.state.startsWith('PASS_'))process.exitCode=1;
}
module.exports={buildArgs,interpret,oneAttempt,validateWindow,verifyApprovedBundle,clientOutcome,validateFrozenAddress,validateQueryTurn,validOID};
if(require.main===module)main(process.argv.slice(2)).catch(()=>{console.error('OWNER_PROBE_REFUSED_NO_RAW_DETAILS');process.exitCode=1;});