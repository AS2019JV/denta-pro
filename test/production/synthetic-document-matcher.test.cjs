'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {unstable_doesMiddlewareMatch}=require('next/experimental/testing/server');
const compiled=ts.transpileModule(fs.readFileSync('middleware.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
vm.runInNewContext(compiled,{module:mod,exports:mod.exports,require:()=>({}),process:{env:{}}});
const matches=url=>unstable_doesMiddlewareMatch({config:mod.exports.config,nextConfig:{},url});
test('document and media exclusions reach middleware even with static-looking suffixes',()=>{
 for(const route of ['/api/clinical-documents','/api/private-media'])
  for(const suffix of ['', '/fixture.json','/fixture.png','/nested/fixture.svg'])
   assert.equal(matches(route+suffix),true,route+suffix);
});
test('document-specific matching preserves static asset exclusions',()=>{
 for(const route of ['/_next/static/fixture.js','/brand/logo.png','/manifest.json'])
  assert.equal(matches(route),false,route);
 for(const route of ['/patients','/calendar','/api/health'])assert.equal(matches(route),true,route);
});
