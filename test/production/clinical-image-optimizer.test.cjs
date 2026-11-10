'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {ImageOptimizerCache}=require('next/dist/server/image-optimizer');
const {imageConfigDefault}=require('next/dist/shared/lib/image-config');
const config=import('../../next.config.mjs').then(x=>x.default);
async function validate(url){const c=await config;return ImageOptimizerCache.validateParams({headers:{}},{url,w:'64',q:'75'},{...c,images:{...imageConfigDefault,...c.images}},false);}
test('Next optimizer rejects direct, signed, public and transformed provider URLs before retrieval',async()=>{
 for(const host of ['fbtlldubzomocuhpvweg.supabase.co','phihonofwyerpfgqfekt.supabase.co','fbtlldubzomocuhpvweg.storage.supabase.co'])
  for(const route of ['/storage/v1/object/patient-files/fixture.png','/storage/v1/object/authenticated/patient-files/fixture.png',
   '/storage/v1/object/public/patient-avatars/fixture.png','/storage/v1/object/sign/patient-files/fixture.png?token=synthetic',
   '/storage/v1/render/image/authenticated/patient-avatars/fixture.png','/storage/v1/object/public/brand_public/logo.png'])
   assert.ok((await validate('https://'+host+route)).errorMessage,host+route);
});
test('Next optimizer rejects local API aliases, encodings and query-bearing sources',async()=>{
 for(const url of ['/api/private-media','/api/clinical-documents','/api/%70rivate-media','/%61pi/private-media',
  '/logo.png?url=/api/private-media','//fbtlldubzomocuhpvweg.supabase.co/storage/v1/object/patient-files/fixture.png',
  'https://fbtlldubzomocuhpvweg.supabase.co/storage/v1/%6fbject/patient-files/fixture.png',
  'https://fbtlldubzomocuhpvweg.supabase.co/storage/v1/object/public/brand_public/../patient-files/fixture.png'])
  assert.ok((await validate(url)).errorMessage,url);
});
test('Next optimizer still accepts shipped public assets and static imports',async()=>{
 for(const url of ['/logo.png','/clinia-logo.png','/placeholder-user.jpg','/_next/static/media/fixture.123.png'])
  assert.equal((await validate(url)).errorMessage,undefined,url);
});
