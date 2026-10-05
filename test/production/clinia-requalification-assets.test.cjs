'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),scanner=require('../../scripts/verify-clinia-requalification-client-secrets.cjs');
const d=require('../../scripts/verify-clinia-document-runtime.cjs'),q=require('../../scripts/verify-clinia-document-requalification.cjs');
test('observed vendor assets receive no Preview access cookie; arbitrary foreign URLs stay refused',()=>{
 const access={Cookie:'_vercel_jwt=synthetic'},candidate=scanner.assetRequest(d.PREVIEW+'/_next/static/app.js',access);
 assert.equal(new URL(candidate.url).origin,q.ORIGIN);assert.deepEqual(candidate.headers,access);
 const vendor=scanner.assetRequest('https://vercel.live/_next-live/feedback/feedback.js',access);assert.deepEqual(vendor.headers,{});
 for(const url of ['https://example.com/feedback.js','https://vercel.live/other.js','https://vercel.live/_next-live/feedback/feedback.js?token=secret',
  'https://cliniaplus.com/_next/static/app.js',d.PREVIEW+'/_next/static/../../api/clinical-documents'])assert.throws(()=>scanner.assetRequest(url,access));
});
