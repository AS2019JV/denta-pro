'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {classifyProbe}=require('../../scripts/verify-clinia-hosted-storage-revocation.cjs');
const deny=()=>({status:400,code:'NoSuchKey'});
const revoked=()=>[{status:200},deny(),deny(),deny(),deny(),{status:200},deny()];
test('revocation evidence requires every replay, list and anonymous negative control',()=>{
 assert.equal(classifyProbe('revoked',revoked(),[]),'VERIFIED');
 for(const index of [1,2,3,4,6]){
  const leaked=revoked();leaked[index]={status:200};
  assert.equal(classifyProbe('revoked',leaked,[]),'PARTIALLY VERIFIED');
 }
 assert.equal(classifyProbe('revoked',revoked(),[{name:'private.pdf'}]),'PARTIALLY VERIFIED');
});
test('transport errors and expired JWT errors cannot masquerade as authority denial',()=>{
 for(const index of [0,1,2,3,4,5,6]){
  const broken=revoked();broken[index]={status:400,code:'InvalidJWT'};
  assert.equal(classifyProbe('revoked',broken,[]),'PARTIALLY VERIFIED');
 }
 assert.equal(classifyProbe('revoked',revoked().slice(0,6),[]),'PARTIALLY VERIFIED');
});
test('authorized warm controls must still deny anonymous access',()=>{
 const warm=[{status:200},...Array.from({length:5},()=>({status:200})),deny()];
 assert.equal(classifyProbe('warm',warm,[{name:'private.pdf'}]),'VERIFIED');
 warm[6]={status:200};assert.equal(classifyProbe('warm',warm,[]),'PARTIALLY VERIFIED');
});
