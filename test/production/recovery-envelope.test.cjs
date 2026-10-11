'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {encrypt,decrypt}=require('../../scripts/clinia-recovery-envelope.cjs');
test('Recovery envelope authenticates exact bytes, uses fresh nonces and rejects tampering or wrong keys',()=>{
  const data=crypto.randomBytes(4096),key=crypto.randomBytes(32),a=encrypt(data,key),b=encrypt(data,key);
  assert.deepEqual(decrypt(a,key),data);assert.notDeepEqual(a,b);
  assert.throws(()=>decrypt(a,crypto.randomBytes(32)));
  assert.throws(()=>decrypt(a.subarray(0,a.length-1),key));
  assert.throws(()=>decrypt(Buffer.concat([a,Buffer.from('extra')]),key));
  for(const index of [0,30,45,a.length-1]){const altered=Buffer.from(a);altered[index]^=1;assert.throws(()=>decrypt(altered,key));}
  assert.throws(()=>encrypt(data,Buffer.alloc(16)));assert.throws(()=>decrypt(Buffer.alloc(0),key));
});
