'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../../../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const m=JSON.parse(fs.readFileSync(path.join(__dirname,'ci-source-manifest.json')));
assert.equal(m.baseDiagnosticSHA,'20ff880d5ec3e1285caa51c5fc956a1fe8387fc4');
assert.equal(m.frozenCandidateSHA,'ba47f5273fef85fca1cf92784c8ff8c7b50faf54');
assert.equal(m.nativeExecutionAuthorized,false);
for(const f of m.files){assert.ok(typeof f.path==='string'&&!path.isAbsolute(f.path)&&!f.path.includes('..')&&!f.path.includes('.gate4-private'));const p=path.join(root,f.path),s=fs.lstatSync(p);assert.ok(s.isFile()&&!s.isSymbolicLink());const b=fs.readFileSync(p);assert.equal(b.length,f.bytes,f.path);assert.equal(hash(b),f.sha256,f.path);}
const v=JSON.parse(fs.readFileSync(path.join(root,'vercel.json')));
assert.equal(v.git.deploymentEnabled['codex/clinia-owner-observation-03'],false);
assert.equal(fs.readFileSync(path.join(root,'.node-version'),'utf8').trim(),'22.20.0');
console.log(JSON.stringify({status:'PASS_OFFLINE_SOURCE_PINS',entries:m.files.length,nativeOperations:0,privateReads:0}));
