'use strict';
// Offline validator only: accepts supplied bytes, never opens a connection or credentials.
const { assemble } = require('./assemble-offline.cjs');
const C = assemble().contract;
const PREFIX = 'CLINIA_HOSTED_OBSERVATION_V1:';
const labels = new Set(['TRUE','FALSE','NULL','INVALID_TYPE','MISSING','ERROR']);
const fail = code => ({state:'REFUSED',code,rawOutputReturned:false,migrationReady:false});
function classify(object,key) {
 if (!object || typeof object !== 'object' || Array.isArray(object)) return 'ERROR';
 if (!Object.hasOwn(object,key)) return 'MISSING';
 const v=object[key];
 return v===null?'NULL':typeof v!=='boolean'?'INVALID_TYPE':v?'TRUE':'FALSE';
}
function privacy(value,key='') {
 if (['definition','body','prosrc','proconfig','config','raw','password','secret','token','rows'].includes(key)) return false;
 if (/Md5$/.test(key) && value!==null) {
  if (Array.isArray(value)) return value.every(v=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v));
  if (typeof value!=='string'||!/^[a-f0-9]{32}$/.test(value)) return false;
 }
 if (!value || typeof value!=='object') return true;
 return Object.entries(value).every(([k,v])=>privacy(v,k));
}
function dependencyObservations(records) {
 const wanted=[...C.dependencies].sort((a,b)=>(a[0]+'.'+a[1]).localeCompare(b[0]+'.'+b[1]));
 const roleNames=[...C.roles].sort();
 return wanted.map(([schema,name,args],n)=>{
  const present=Array.isArray(records)&&Object.hasOwn(records,n),d=present?records[n]:undefined;
  let identity=!Array.isArray(records)?'ERROR':!present?'MISSING':d===null?'NULL':typeof d!=='object'||Array.isArray(d)?'INVALID_TYPE':'TRUE';
  if(identity==='TRUE')for(const[k,v]of [['schema',schema],['name',name],['inputTypes',args]]){
   if(!Object.hasOwn(d,k)){identity='MISSING';break;}
   if(d[k]===null){identity='NULL';break;}
   if(typeof d[k]!=='string'){identity='INVALID_TYPE';break;}
   if(d[k]!==v){identity='FALSE';break;}
  }
  const actors=roleNames.map((role,index)=>{
   if(identity!=='TRUE')return {role,identity:'ERROR',schemaUsage:'ERROR',execute:'ERROR'};
   if(!Array.isArray(d.actors))return {role,identity:'ERROR',schemaUsage:'ERROR',execute:'ERROR'};
   const candidates=d.actors.filter(row=>Array.isArray(row)&&row[0]===role);
   if(candidates.length===1){const row=candidates[0],field=k=>Object.hasOwn(row,k)?classify({value:row[k]},'value'):'MISSING';return {role,identity:'TRUE',schemaUsage:field(1),execute:field(2)};}
   const slot=d.actors[index];
   const missing=!Object.hasOwn(d.actors,index)||slot===null||(Array.isArray(slot)&&C.roles.includes(slot[0])&&slot[0]!==role);
   return {role,identity:missing?'MISSING':'ERROR',schemaUsage:missing?'MISSING':'ERROR',execute:missing?'MISSING':'ERROR'};
  });
  return {signature:schema+'.'+name+'('+args+')',identity,schema:identity==='TRUE'?classify(d,'schemaExists'):'ERROR',signatureExists:identity==='TRUE'?classify(d,'signatureExists'):'ERROR',actors};
 });
}
function read(stdout) {
 const b=Buffer.isBuffer(stdout)?stdout:Buffer.from(stdout);
 if(b.length>C.limits.outputBytes) return fail('OUTPUT_LIMIT');
 const lines=b.toString('utf8').split(/\r?\n/).filter(x=>x.length);
 if(lines.length!==1||!lines[0].startsWith(PREFIX)) return fail('OUTPUT_PROTOCOL');
 let j;try{j=JSON.parse(lines[0].slice(PREFIX.length));}catch{return fail('OUTPUT_JSON');}
 if(!j||j.protocol!=='CLINIA_HOSTED_OBSERVATION_V1'||j.state!=='CAPTURED_CURRENT_ONLY') return fail('SERVER_REFUSAL_OR_STATE');
 const i=j.identity,t=C.target;
 if(!i||i.project!==t.project||i.database!==t.database||i.currentUser!==t.actor||i.sessionUser!==t.actor||i.version!==t.version||i.systemIdentifier!==t.systemIdentifier||i.superuser!==false||i.readOnly!=='on'||i.defaultReadOnly!=='on') return fail('IDENTITY');
 const observations=dependencyObservations(j.dependencies);
 const refuse=code=>({...fail(code),dependencyObservations:observations});
 if(j.migrationReady!==false||j.postP!=='NOT_VERIFIED'||j.applicationRuntime!=='NOT_VERIFIED') return refuse('READINESS_PROMOTION');
 if(j.cohort?.applicationRowsRead!==false||j.cohort?.authMFASessionRowsHashed!==false||j.cohort?.invitationsQueried!==false) return refuse('COHORT_SCOPE');
 const requiredKeys=['identity','limits','catalog','authority','dependencies','requiredRPCs','resolution','ledgers','cohort','postP','migrationReady','applicationRuntime','managedConfiguration','protocol','state'];
 if(Object.keys(j).some(k=>!requiredKeys.includes(k))||requiredKeys.some(k=>!Object.hasOwn(j,k))) return refuse('TOP_LEVEL_SHAPE');
 if(j.limits?.counts?.accepted!==true||!j.catalog||!j.authority) return refuse('CARDINALITY');
 const sections=['schemas','tables','columns','functions','constraints','indexes','triggers','policies','defaults','types','sequences','dependencyEdges'];
 if(sections.some(k=>!Array.isArray(j.catalog[k]))||Object.keys(j.catalog).some(k=>!sections.includes(k))) return refuse('CATALOG_SHAPE');
 for(const [field,cap] of Object.entries(C.limits)) if(field!=='outputBytes'&&field!=='resolutionCandidates'&&Array.isArray(j.catalog[field])&&j.catalog[field].length>cap) return refuse('CATALOG_LIMIT');
 if(j.catalog.dependencyEdges.some(e=>!Array.isArray(e)||e.length!==7||![e[0],e[1],e[3],e[4]].every(v=>typeof v==='string'&&/^\d{1,10}$/.test(v))||![e[2],e[5]].every(v=>Number.isInteger(v)&&v>=0)||typeof e[6]!=='string'||e[6].length!==1)) return refuse('DEPENDENCY_EDGE_SHAPE');
 const authKeys=['roles','ownerRoles','database','memberships','schemas','tables','functions','locks','sequences','languages','types','implicitDefaults','native'];
 if(Object.keys(j.authority).some(k=>!authKeys.includes(k))||authKeys.some(k=>!Object.hasOwn(j.authority,k))) return refuse('AUTHORITY_SHAPE');
 for(const k of authKeys.filter(k=>k!=='native')) if(!Array.isArray(j.authority[k])) return refuse('AUTHORITY_SHAPE');
 const lengths={roles:C.roles.length,database:C.roles.length,memberships:C.roles.length**2,schemas:C.roles.length*C.schemas.length,locks:C.roles.length*C.locks.length,languages:C.roles.length*2,implicitDefaults:3*(C.schemas.length+1)*5};
 for(const[k,n]of Object.entries(lengths)) if(j.authority[k].length!==n) return refuse('AUTHORITY_INCOMPLETE');
 if(!j.authority.native||j.authority.native.policyDDLQualified!==false) return refuse('NATIVE_PROMOTION');
 if(!Array.isArray(j.dependencies)||j.dependencies.length!==3) return refuse('DEPENDENCY_SHAPE');
 // SQL order is schema,name. Do not stop after the first negative dependency.
 const wanted=[...C.dependencies].sort((a,b)=>(a[0]+'.'+a[1]).localeCompare(b[0]+'.'+b[1]));
 for(let n=0;n<3;n++) {
  const d=j.dependencies[n],e=wanted[n];
  if(!d||d.schema!==e[0]||d.name!==e[1]||d.inputTypes!==e[2]) return refuse('DEPENDENCY_IDENTITY');
  if(!Array.isArray(d.actors)||d.actors.length!==C.roles.length) return refuse('DEPENDENCY_ACTORS');
  for(let a=0;a<C.roles.length;a++) {
   const row=d.actors[a],role=[...C.roles].sort()[a];
   if(!Array.isArray(row)||row.length!==3||row[0]!==role) return refuse('DEPENDENCY_ACTORS');
  }
 }
 const invalid=observations.some(o=>![o.schema,o.signatureExists,...o.actors.flatMap(a=>[a.schemaUsage,a.execute])].every(x=>['TRUE','FALSE','NULL'].includes(x)));
 if(invalid) return refuse('DEPENDENCY_METADATA_TYPE');
 if(!Array.isArray(j.requiredRPCs)||j.requiredRPCs.length!==C.requiredRPCs.length) return refuse('RPC_SHAPE');
 const rpcByName=new Map(j.requiredRPCs.map(v=>[v?.name,v]));
 if(rpcByName.size!==C.requiredRPCs.length) return refuse('RPC_DUPLICATE');
 for(const [schema,name,args]of C.requiredRPCs) {const r=rpcByName.get(name);if(!r||r.schema!==schema||r.inputTypes!==args||!['MISSING','PRESENT_NOT_RUNTIME_TESTED'].includes(r.state)||(r.state==='MISSING'?r.oid!==null:!/^\d{1,10}$/.test(r.oid||'')))return refuse('RPC_IDENTITY');}
 if(!Array.isArray(j.resolution)||j.resolution.length!==C.unqualified.length*C.roles.length) return refuse('RESOLUTION_SHAPE');
 if(j.resolution.some(r=>!Array.isArray(r.candidates)||r.candidates.length>C.limits.resolutionCandidates)) return refuse('RESOLUTION_LIMIT');
 const expectedResolution=new Set(C.unqualified.flatMap(([kind,name])=>C.roles.map(role=>kind+'.'+name+'.'+role)));
 for(const r of j.resolution) if(!expectedResolution.delete(r.kind+'.'+r.name+'.'+r.actor)||r.postP!=='EXPECTED_AFTER_P_NOT_VERIFIED') return refuse('RESOLUTION_IDENTITY');
 if(!privacy(j)) return refuse('UNSANITIZED_METADATA');
 const compatible=j.requiredRPCs.every(r=>r.state==='PRESENT_NOT_RUNTIME_TESTED')&&observations.every(o=>o.schema==='TRUE'&&o.signatureExists==='TRUE'&&o.actors.filter(a=>a.role==='postgres').every(a=>a.schemaUsage==='TRUE'&&a.execute==='TRUE'));
 return {state:'CAPTURED_CURRENT_ONLY',migrationReady:false,compatibility:compatible?'METADATA_PREREQUISITES_ONLY':'NOT_COMPATIBLE_OR_NOT_VERIFIED',dependencyObservations:observations,snapshot:j,postP:'NOT_VERIFIED',SQLRuntime:'NOT_VERIFIED_BY_OFFLINE_TESTS',remoteSessionClosure:'NOT_INDEPENDENTLY_VERIFIED'};
}
module.exports={read,classify,privacy,labels,dependencyObservations};
