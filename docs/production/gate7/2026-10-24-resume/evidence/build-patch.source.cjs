const fs=require("fs"),p=require("path"),cp=require("child_process"),crypto=require("crypto");
const sha="254996d89b68d11aec43e82f8184e01035b55696",out="docs/production/gate7/2026-10-24-resume",dir=".release-snapshots/gate7-resume-20261024",before=dir+"/before",after=dir+"/after";
const paths=["lib/birth-date.mjs","lib/birth-date.d.mts","app/(dashboard)/patients/[id]/page.tsx","components/hcu033-form.tsx"],old={};
const hash=b=>crypto.createHash("sha256").update(b).digest("hex");
for(const name of paths){old[name]=cp.execFileSync("git",["show",sha+":"+name],{windowsHide:true}).toString("utf8").replace(/\r\n/g,"\n");for(const root of [before,after]){fs.mkdirSync(p.dirname(root+"/"+name),{recursive:true});fs.writeFileSync(root+"/"+name,old[name]);}}
function edit(name,from,to){const file=after+"/"+name,s=fs.readFileSync(file,"utf8");if(s.split(from).length!==2)throw Error("Nonunique patch context "+name);fs.writeFileSync(file,s.replace(from,to));}
function span(name,start,end,replacement){const s=fs.readFileSync(after+"/"+name,"utf8"),a=s.indexOf(start),b=s.indexOf(end,a);if(a<0||b<a)throw Error("Missing patch span "+name);edit(name,s.slice(a,b),replacement);}
const helper=[
"",
"// Keep calendar birth dates separate from UTC instants when calculating age.",
"export function ageFromBirthDate(value, today = new Date()) {",
"  const birth = calendarBirthDate(value)",
"  if (!birth || !(today instanceof Date) || !Number.isFinite(today.getTime())) return null",
"  const year = today.getFullYear(), month = today.getMonth() + 1, day = today.getDate()",
"  let age = year - birth.year",
"  if (month < birth.month || (month === birth.month && day < birth.day)) age--",
"  return age < 0 ? null : age",
"}",""
].join("\n");
fs.appendFileSync(after+"/lib/birth-date.mjs",helper);
fs.appendFileSync(after+"/lib/birth-date.d.mts","export function ageFromBirthDate(value: unknown, today?: Date): number | null\n");
edit(paths[2],'import { formatBirthDate } from "@/lib/birth-date.mjs"','import { formatBirthDate, ageFromBirthDate } from "@/lib/birth-date.mjs"');
span(paths[2],"    const birth = new Date(birthDateString)","    return ","    const age = ageFromBirthDate(birthDateString)\n    if (age === null) return \"Fecha de nacimiento no registrada\"\n");
edit(paths[3],'import { exportPersistedHCU033 } from "@/lib/pdf-client"','import { exportPersistedHCU033 } from "@/lib/pdf-client"\nimport { ageFromBirthDate } from "@/lib/birth-date.mjs"');
span(paths[3],"          const birthDate = pData.birth_date ?","          setFormData((prev: any)","          const calculatedAge = ageFromBirthDate(pData.birth_date)\n          const age = calculatedAge === null ? \"\" : calculatedAge.toString()\n\n");
span(paths[3],"                      const birthDate = new Date(e.target.value)",'                      updateField("edad", age.toString())',"                      const age = ageFromBirthDate(e.target.value)\n");
edit(paths[3],'updateField("edad", age.toString())','updateField("edad", age === null ? "" : age.toString())');
fs.mkdirSync(after+"/test/production",{recursive:true});
fs.copyFileSync(dir+"/age-boundaries.test.cjs",after+"/test/production/age-boundaries.test.cjs");
const diff=cp.spawnSync("git",["diff","--no-index","--src-prefix=a/","--dst-prefix=b/","before","after"],{cwd:dir,encoding:"utf8",windowsHide:true});
if(diff.status!==1)throw Error("Expected prepared patch");
const patch=diff.stdout.replaceAll("a/before/","a/").replaceAll("b/after/","b/").replaceAll("a/after/","a/").replaceAll("b/before/","b/");
fs.writeFileSync(out+"/CALENDAR_AGE.patch",patch);
cp.execFileSync("git",["apply","--check","--directory="+before,out+"/CALENDAR_AGE.patch"],{windowsHide:true});
const all=[...paths,"test/production/age-boundaries.test.cjs"];
fs.writeFileSync(out+"/evidence/patch-verification.json",JSON.stringify({baseCandidateSHA:sha,kind:"PREPARED_PATCH_NOT_APPLIED_TO_RUNTIME_OR_SHARED_RC",paths:all,patchSHA256:hash(patch),patchApplyCheck:"PASS against exact-RC isolated snapshot",sourceHashes:Object.fromEntries(paths.map(n=>[n,hash(old[n])])),proposedHashes:Object.fromEntries(all.map(n=>[n,hash(fs.readFileSync(after+"/"+n))])),runtimeApplied:false,ci:"PENDING successor integration and its own CI",scope:"Calendar age only; existing birth labels/security patches retained. No authority/schema/RLS/MFA or finance change."},null,2)+"\n");
console.log(JSON.stringify({patch:out+"/CALENDAR_AGE.patch",applyCheck:"PASS",paths:all,patchSHA256:hash(patch)}));