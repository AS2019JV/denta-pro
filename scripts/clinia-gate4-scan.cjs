'use strict';
// Bounded public-artifact scan using known local synthetic secrets, never values in output.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),kit=path.resolve(process.env.CLINIA_GATE4_KIT_SCAN||root),codec=require('./clinia-recovery-envelope.cjs');
const scan=require('./clinia-secret-scan.cjs').inspectText;
let key,plain; const findings=[];
function files(dir) {
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
    const p=path.join(dir,e.name);assert.ok(!e.isSymbolicLink());
    return e.isDirectory()?files(p):[p];
  });
}
try {
  assert.ok(kit.startsWith(path.join(root,'.gate4-private')+path.sep));
  key=fs.readFileSync(path.join(root,'.gate4-private/keys/custody-01/baseline.key'));
  plain=codec.decrypt(fs.readFileSync(path.join(root,'.gate4-private/archives/custody-01/baseline.aesgcm')),key);
  const bundle=JSON.parse(plain),known=bundle.actors.flatMap(a=>[a.password,a.totp]);
  let count=0;
  for(const base of [kit,path.join(root,'docs/production/evidence/2026-10-24-gate4-recovery-ops')]) for(const f of files(base)) {
    const bytes=fs.readFileSync(f);count++;
    assert.ok(!bytes.includes(key),'Raw key in public artifact');
    const text=bytes.toString('utf8');
    if(known.some(value=>text.includes(value)) || scan(text).length) findings.push(path.relative(root,f));
  }
  assert.equal(findings.length,0,'Public artifact scan refused');
  console.log(JSON.stringify({status:'PASS_BOUNDED_PUBLIC_KIT_EVIDENCE_SCAN',files:count,findings:0,
    limit:'Known original synthetic passwords/TOTP/raw key plus existing bounded credential rules; not a security audit'}));
} catch {console.error('GATE4_PUBLIC_SCAN_REFUSED_NO_VALUES_EMITTED');process.exitCode=1;}
finally {if(key)key.fill(0);if(plain)plain.fill(0);}
