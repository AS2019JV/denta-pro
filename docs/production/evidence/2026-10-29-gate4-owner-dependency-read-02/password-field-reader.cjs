'use strict';
const assert=require('node:assert/strict');
const prefix=Buffer.from('{"secret":"'),bridge=Buffer.from('","password":"'),suffix=Buffer.from('","privateJwk":');
const passwordOffset=prefix.length+64+bridge.length;
function exact(io,fd,length,position){const b=Buffer.alloc(length);let n=0;try{while(n<length){const k=io.readSync(fd,b,n,length-n,position+n);if(!k)throw Error('REFERENCE_FORMAT_REFUSED');n+=k;}return b;}catch(e){b.fill(0);throw e;}}
function readPasswordField(io,fd,size){let a,b,z,f,p;try{assert.ok(Number.isSafeInteger(size)&&size>=170&&size<=16384,'REFERENCE_SIZE_REFUSED');const footer=Buffer.from(',"project":"clinia-gate3-20261020-a9"}');f=exact(io,fd,footer.length,size-footer.length);assert.ok(f.equals(footer),'REFERENCE_PROJECT_REFUSED');a=exact(io,fd,prefix.length,0);b=exact(io,fd,bridge.length,prefix.length+64);z=exact(io,fd,suffix.length,passwordOffset+64);assert.ok(a.equals(prefix)&&b.equals(bridge)&&z.equals(suffix),'REFERENCE_FORMAT_REFUSED');p=exact(io,fd,64,passwordOffset);for(const x of p)assert.ok(x>=48&&x<=57||x>=97&&x<=102,'PASSWORD_FORMAT_REFUSED');const result=p;p=null;return result;}finally{for(const x of [a,b,z,f,p])if(x)x.fill(0);}}
module.exports={readPasswordField,passwordOffset,prefixLength:prefix.length};
