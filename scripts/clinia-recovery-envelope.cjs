'use strict';
// Local synthetic recovery-package codec. No extraction or secret logging.
const crypto=require('node:crypto'),assert=require('node:assert/strict');
const MAGIC=Buffer.from('CLINIA-RECOVERY-AES256GCM-V1\0','ascii');
const MAX_BYTES=64*1024*1024;
function encrypt(plaintext,key){
  assert.ok(Buffer.isBuffer(plaintext)&&plaintext.length>0&&plaintext.length<=MAX_BYTES);
  assert.ok(Buffer.isBuffer(key)&&key.length===32);
  const nonce=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,nonce,{authTagLength:16});
  cipher.setAAD(MAGIC);
  const ciphertext=Buffer.concat([cipher.update(plaintext),cipher.final()]);
  return Buffer.concat([MAGIC,nonce,cipher.getAuthTag(),ciphertext]);
}
function decrypt(envelope,key){
  assert.ok(Buffer.isBuffer(envelope)&&envelope.length>MAGIC.length+28&&envelope.length<=MAX_BYTES+MAGIC.length+28);
  assert.ok(Buffer.isBuffer(key)&&key.length===32);
  assert.ok(envelope.subarray(0,MAGIC.length).equals(MAGIC),'Recovery envelope version mismatch');
  const nonce=envelope.subarray(MAGIC.length,MAGIC.length+12),tag=envelope.subarray(MAGIC.length+12,MAGIC.length+28);
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,nonce,{authTagLength:16});
  decipher.setAAD(MAGIC);decipher.setAuthTag(tag);
  // No unauthenticated plaintext leaves this function before final succeeds.
  return Buffer.concat([decipher.update(envelope.subarray(MAGIC.length+28)),decipher.final()]);
}
module.exports={encrypt,decrypt,MAX_BYTES};
