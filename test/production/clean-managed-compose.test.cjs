'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),path=require('node:path');
const {plan,signingMaterial,transform}=require('../../scripts/prepare-clinia-clean-managed.cjs');
const local=require('../../scripts/clinia-local-runtime.cjs');
test('new clean project/volume/port planner rejects arbitrary or repeated primary names',()=>{
  const p=plan('1');assert.equal(p.project,'clinia-clean-20261002-1');
  assert.deepEqual(p.ports,{api:56411,db:56412,mail:56414});
  assert.ok(Object.values(p.volumes).every(v=>!v.includes('acceptance')));
  for(const value of ['0','10','postgres','1;up','../1'])assert.throws(()=>plan(value));
});
test('fresh material signs/verifies ES256 and independent HS256 credentials',()=>{
  const p=plan('1'),a=signingMaterial(p),b=signingMaterial(p);
  assert.notEqual(a.secret,b.secret);assert.notEqual(a.privateJwk.d,b.privateJwk.d);assert.notEqual(a.sodium,b.sodium);
  assert.ok(a.privateJwk.d);assert.ok(!a.jwks.keys[0].d);
  const privateKey=crypto.createPrivateKey({key:a.privateJwk,format:'jwk'}),publicKey=crypto.createPublicKey({key:a.jwks.keys[0],format:'jwk'});
  const signature=crypto.sign('sha256',Buffer.from('synthetic'),{key:privateKey,dsaEncoding:'ieee-p1363'});
  assert.equal(crypto.verify('sha256',Buffer.from('synthetic'),{key:publicKey,dsaEncoding:'ieee-p1363'},signature),true);
  const [head,body,sig]=a.service.split('.');
  assert.equal(JSON.parse(Buffer.from(body,'base64url')).role,'service_role');
  assert.equal(sig,crypto.createHmac('sha256',a.secret).update(head+'.'+body).digest('base64url'));
});
test('compose transformation creates new volumes/private binds/loopback aliases and removes old credentials',()=>{
  const p=plan('2'),material=signingMaterial(p),source={services:{}};
  const old={password:'postgres',secret:'oldSecretLongFixture',anon:'oldAnonLongFixture',service:'oldServiceLongFixture'};
  for(const key of ['db','kong','auth','inbucket','realtime','rest','storage'])source.services[key]={
    image:'sha256:'+'a'.repeat(64),container_name:'supabase_'+key+'_clinia-acceptance',
    environment:['POSTGRES_PASSWORD='+old.password,'JWT_SECRET='+old.secret,'ANON_KEY='+old.anon,'SERVICE_KEY='+old.service,
      'DATABASE_URL='+'postgres'+':'+'//x:'+old.password+'@supabase_db_clinia-acceptance:5432/postgres'],
    networks:{local:{aliases:['supabase_'+key+'_clinia-acceptance']}},volumes:[],ports:[]};
  for(const key of ['db','storage'])source.services[key].volumes.push({type:'volume',source:'supabase_'+key+'_clinia-acceptance',target:key==='db'?'/var/lib/postgresql/data':'/mnt',read_only:false});
  source.services.db.volumes.push({type:'bind',source:path.join(local.privateDir,'db-pgsodium_root.key'),target:'/etc/postgresql-custom/pgsodium_root.key',read_only:true});
  source.services.db.ports.push({target:5432,published:'56322',host_ip:'127.0.0.1',protocol:'tcp'});
  source.services.db.command=['postgres','ALTER USER postgres;'];
  const result=transform(source,p,material).compose;
  assert.ok(Object.values(result.volumes).every(v=>!v.external));
  assert.equal(result.networks.local.internal,false);
  assert.equal(result.services.db.ports[0].published,'56422');
  assert.equal(result.services.db.volumes[1].source,path.join(p.privateDir,'db-pgsodium_root.key'));
  assert.ok(!JSON.stringify(result).includes('clinia-acceptance'));
  for(const value of [old.secret,old.anon,old.service])assert.ok(!JSON.stringify(result).includes(value));
  assert.ok(!JSON.stringify(result).includes(':postgres@'));
  assert.deepEqual(result.services.db.command,['postgres','ALTER USER postgres;']);
  source.services.db.ports[0].host_ip='0.0.0.0';assert.throws(()=>transform(source,p,material));
});
