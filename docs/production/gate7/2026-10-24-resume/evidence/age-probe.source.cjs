'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm'),crypto=require('node:crypto');
const ts=require('C:/Users/aleja/Documents/0-dev/denta-pro/node_modules/typescript');
const sha='254996d89b68d11aec43e82f8184e01035b55696';
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>cp.execFileSync('git',['show',sha+':'+p],{windowsHide:true}).toString('utf8').replace(/\r\n/g,'\n');
const pagePath='app/(dashboard)/patients/[id]/page.tsx',hcuPath='components/hcu033-form.tsx';
const sources={[pagePath]:read(pagePath),[hcuPath]:read(hcuPath),'lib/birth-date.mjs':read('lib/birth-date.mjs')};
function formatter(source){
 const ast=ts.createSourceFile(pagePath,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let value;
 function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='formatBirthDateAndAge')value=n.initializer.getText(ast);ts.forEachChild(n,visit)}
 visit(ast);if(!value)throw Error('Missing actual formatter');return value;
}
function ageLoad(source){
 const start=source.indexOf('const birthDate = pData.birth_date ?');
 const end=source.indexOf('setFormData((prev: any)',start);
 if(start<0||end<0)throw Error('Missing actual HCU age block');
 return '(pData) => {'+source.slice(start,end)+'; return age;}';
}
function ageInput(source){
 const start=source.indexOf('// Calcular edad automáticamente');
 const end=source.indexOf('updateField("edad", age.toString())',start);
 if(start<0||end<0)throw Error('Missing actual HCU age input block');
 return '(e) => {'+source.slice(start,end)+'; return age.toString();}';
}
function execute(expression,today,extra={}){
 const NativeDate=Date;
 class FixedDate extends NativeDate{constructor(...args){super(...(args.length?args:[today+'T12:00:00']))}}
 const context={module:{exports:{}},Date:FixedDate,isNaN,...extra};
 vm.runInNewContext(ts.transpileModule('module.exports='+expression,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,context);
 return context.module.exports;
}
function formatBirthDate(s){const [y,m,d]=s.split('-').map(Number);return d+'/'+m+'/'+y}
const cases=[
 {id:'before-birthday',birth:'2008-10-25',asOf:'2026-10-24',expected:17},
 {id:'birthday',birth:'2008-10-24',asOf:'2026-10-24',expected:18},
 {id:'after-birthday',birth:'2008-10-23',asOf:'2026-10-24',expected:18},
 {id:'jan1-eve',birth:'2008-01-01',asOf:'2025-12-31',expected:17},
 {id:'leap-birth-eve',birth:'2008-02-29',asOf:'2024-02-28',expected:15},
 {id:'leap-birthday',birth:'2008-02-29',asOf:'2024-02-29',expected:16},
 {id:'leap-after',birth:'2008-02-29',asOf:'2024-03-01',expected:16}
];
const observations=[];
for(const zone of ['America/Guayaquil','UTC','Pacific/Kiritimati']){
 process.env.TZ=zone;
 for(const c of cases){
  const page=execute(formatter(sources[pagePath]),c.asOf,{formatBirthDate})(c.birth);
  const pageAge=Number(page.match(/\((\d+) años\)/)[1]);
  const hcu=Number(execute(ageLoad(sources[hcuPath]),c.asOf)({birth_date:c.birth}));
  const input=Number(execute(ageInput(sources[hcuPath]),c.asOf)({target:{value:c.birth}}));
  observations.push({...c,zone,pageAge,hcuAge:hcu,hcuInputAge:input,passed:pageAge===c.expected&&hcu===c.expected&&input===c.expected});
 }
}
const result={candidateSHA:sha,scope:'Offline execution of exact RC formatter and HCU load/input blocks; synthetic dates only, fixed clock; no browser/backend execution',sourceHashes:Object.fromEntries(Object.entries(sources).map(([p,s])=>[p,sha256(s)])),typescriptVersion:ts.version,sourceFormat:'Git source normalized CRLF to LF for AST/block extraction',observations,failedRows:observations.filter(o=>!o.passed).length,clinicalPolicy:'Ordinary calendar-year comparisons only. Non-leap-year Feb29 legal/clinical anniversary policy remains a qualified human decision; not prescribed here.',authorization:'Read-only exact RC code and local boundary probe only',productionMutations:0,hostedFlows:0};
fs.mkdirSync(path.resolve('docs/production/gate7/2026-10-24-resume/evidence'),{recursive:true});
fs.writeFileSync('docs/production/gate7/2026-10-24-resume/evidence/age-before.json',JSON.stringify(result,null,2)+'\n');
if(result.failedRows===0)throw Error('Expected boundary regression was not reproduced; do not prepare a speculative fix');
process.stdout.write(JSON.stringify({candidateSHA:sha,observations:observations.length,failedRows:result.failedRows,example:observations.find(x=>!x.passed)}));
