const {test} = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const {pathToFileURL} = require('node:url')
test('local API sources require both explicit acceptance mode and exact configured origin', async()=>{
  const previous = {flag:process.env.CLINIA_LOCAL_ACCEPTANCE, url:process.env.NEXT_PUBLIC_SUPABASE_URL}
  try {
    for (const [flag,url,allowed] of [['','http://127.0.0.1:56321',false],['1','https://example.supabase.co',false],['1','http://127.0.0.1:9999',false],['1','http://127.0.0.1:56321',true]]) {
      process.env.CLINIA_LOCAL_ACCEPTANCE=flag;process.env.NEXT_PUBLIC_SUPABASE_URL=url
      const config=(await import(pathToFileURL(path.resolve(__dirname,'../../next.config.mjs')).href+'?case='+Math.random())).default
      assert.equal(config.skipMiddlewareUrlNormalize,allowed)
      assert.equal(config.distDir,allowed?'.next-clinia-acceptance':'.next')
      const headers=await config.headers()
      const csp=headers[0].headers.find(h=>h.key==='Content-Security-Policy').value
      assert.equal(csp.includes('http://127.0.0.1:56321'),allowed)
      assert.equal(csp.includes('ws://127.0.0.1:56321'),allowed)
      assert.ok(!csp.includes('http://127.0.0.1:*'))
    }
  } finally {
    if(previous.flag===undefined)delete process.env.CLINIA_LOCAL_ACCEPTANCE;else process.env.CLINIA_LOCAL_ACCEPTANCE=previous.flag
    if(previous.url===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=previous.url
  }
})
