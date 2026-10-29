'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'ci-source-manifest.v1.json')));
assert.equal(manifest.frozenCandidateSHA,'ba47f5273fef85fca1cf92784c8ff8c7b50faf54');
for(const f of manifest.files){assert.ok(typeof f.path==='string'&&!path.isAbsolute(f.path)&&!f.path.includes('..')&&!f.path.includes('.gate4-private'));const file=path.join(root,f.path);assert.ok(fs.lstatSync(file).isFile()&&!fs.lstatSync(file).isSymbolicLink());const b=fs.readFileSync(file);assert.equal(b.length,f.bytes,'Public source bytes mismatch');assert.equal(hash(b),f.sha256,'Public source pin mismatch');}
const vercel=JSON.parse(fs.readFileSync(path.join(root,'vercel.json')));assert.deepEqual(vercel.git.deploymentEnabled,{'codex/clinia-rc-20261002':false,'codex/clinia-gate3-bootstrap':false,'codex/clinia-owner-v02-diagnostic':false});
assert.equal(fs.readFileSync(path.join(root,'.node-version'),'utf8').trim(),'22.20.0');
console.log(JSON.stringify({status:'PASS_EXACT_PUBLIC_SOURCE_PINS',entries:manifest.files.length,sourceBundleSHA256:manifest.nativeBundleSHA256,privateReads:0,nativeOperations:0,dependenciesInstalled:0}));
