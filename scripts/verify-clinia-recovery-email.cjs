'use strict';
const fs=require('node:fs'),path=require('node:path');
function verifyRecoveryEmailTrace(directory){
 const template=path.resolve(directory,'emails/reset-password.html');
 const manifest=path.join(directory,'.next/server/app/(auth)/forgot-password/page.js.nft.json');
 const trace=JSON.parse(fs.readFileSync(manifest,'utf8'));
 if(!Array.isArray(trace.files)||!trace.files.some(file=>typeof file==='string'&&path.resolve(path.dirname(manifest),file)===template)||!fs.statSync(template).isFile())throw Error('Auth email runtime template absent from /forgot-password build trace');
 return{status:'VERIFIED',route:'/forgot-password',scope:'Recovery template packaged; delivery verified separately'};
}
module.exports={verifyRecoveryEmailTrace};
