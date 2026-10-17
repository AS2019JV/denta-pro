'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
function load(file, mocks = {}, extra = {}) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(js + (file.endsWith('page.tsx') ? '\nexports.ConfirmContent = ConfirmContent;' : ''), {
    module, exports: module.exports, URL, Buffer, console: { info() {}, log() {}, error() {}, warn() {} },
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'synthetic-only', RESEND_API_KEY: 'synthetic-only',
      NEXT_PUBLIC_APP_URL: 'https://app.example.invalid' }, cwd: () => root },
    require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith('@/lib/')) return load(name.slice(2) + '.ts', mocks);
      return require(name);
    }, ...extra,
  }, { filename: file });
  return module.exports;
}

test('auth redirect permits only the existing internal flows', () => {
  const { safeAuthRedirect } = load('lib/auth-redirect.ts');
  for (const value of ['/', '/dashboard', '/update-password']) assert.equal(safeAuthRedirect(value), value);
  for (const value of [null, {}, 'javascript:alert(1)', ' JAVASCRIPT:alert(1)', '//evil.invalid',
    'https://evil.invalid', '/\\evil.invalid', '/dashboard?next=javascript:alert(1)',
    '/dashboard#evil', '/%2f%2fevil.invalid', '/dashboard\n']) {
    assert.equal(safeAuthRedirect(value), '/dashboard');
  }
});

test('real confirmation component keeps malicious next out of router in all success branches', async () => {
  for (const mode of ['existing-session', 'otp-success', 'already-confirmed']) {
    const pushes = [];
    const params = new URLSearchParams({ next: 'javascript:alert(document.domain)' });
    if (mode !== 'existing-session') { params.set('token_hash', 'synthetic'); params.set('type', 'signup'); }
    const supabase = { auth: {
      getUser: async () => ({ data: { user: { id: 'synthetic', email_confirmed_at: 'synthetic' } } }),
      verifyOtp: async () => ({ error: mode === 'already-confirmed' ? { message: 'expired' } : null }),
    } };
    const component = load('app/auth/confirm/page.tsx', {
      react: { useEffect: effect => effect(), useState: () => ['loading', () => {}], useRef:()=>({current:false}), Suspense() {} },
      'react/jsx-runtime': { jsx() {}, jsxs() {} },
      'next/navigation': { useRouter: () => ({ push: value => pushes.push(value) }), useSearchParams: () => params },
      '@supabase/ssr': { createBrowserClient: () => supabase },
      '@/app/actions/complete-verified-enrollment': {completeVerifiedEnrollment:async()=>({success:true})},
      'lucide-react': {},
    }, { setTimeout: callback => callback() });
    component.ConfirmContent();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(pushes, ['/dashboard'], mode);
  }
});

test('both confirmation handlers discard auth parameters and allow recovery destination', async () => {
  for (const file of ['app/auth/callback/route.ts', 'app/api/auth/confirm/route.ts']) {
    for (const destination of ['javascript:alert(1)', '/update-password']) {
      const requestUrl = new URL('https://app.example.invalid/auth/callback');
      requestUrl.search = new URLSearchParams({ next: destination, code: 'synthetic-code', token_hash: 'synthetic-token', type: 'signup', extra: 'discard' }).toString();
      requestUrl.clone = () => new URL(requestUrl);
      const handler = load(file, {
        'next/server': { NextResponse: { redirect: value => value.toString() } },
        'next/headers': { cookies: async () => ({ getAll: () => [], set() {} }) },
        '@supabase/ssr': { createServerClient: () => ({ auth: {
          exchangeCodeForSession: async () => ({ error: null }), verifyOtp: async () => ({ error: null }),
        } }) },
        '@/lib/logger': { logger: { info() {}, error() {} } },
        '@/lib/verified-enrollment': {finishVerifiedEnrollment:async()=>({success:true})},
      });
      assert.equal(await handler.GET({ url: requestUrl.toString(), nextUrl: requestUrl }),
        'https://app.example.invalid' + (destination === '/update-password' ? destination : '/dashboard'));
    }
  }
});

test('confirmed OTP or existing session never redirects to clinic when trusted enrollment fails', async () => {
  for (const mode of ['existing-session','otp-success','already-confirmed']) {
    const pushes=[],params=new URLSearchParams({next:'/dashboard'});
    if(mode!=='existing-session'){params.set('token_hash','synthetic-token');params.set('type','invite');}
    const component=load('app/auth/confirm/page.tsx',{
      react:{useEffect:effect=>effect(),useState:()=>['loading',()=>{}],useRef:()=>({current:false}),Suspense(){}},
      'react/jsx-runtime':{jsx(){},jsxs(){}},
      'next/navigation':{useRouter:()=>({push:value=>pushes.push(value)}),useSearchParams:()=>params},
      '@supabase/ssr':{createBrowserClient:()=>({auth:{
        getUser:async()=>({data:{user:{email_confirmed_at:'confirmed'}}}),
        verifyOtp:async()=>({error:mode==='already-confirmed'?{message:'expired'}:null}),
      }})},
      '@/app/actions/complete-verified-enrollment':{completeVerifiedEnrollment:async()=>({success:false})},
      'lucide-react':{},
    },{setTimeout:callback=>callback()});
    component.ConfirmContent();await new Promise(resolve=>setImmediate(resolve));assert.equal(pushes.length,0,mode);
  }
  for(const file of ['app/auth/callback/route.ts','app/api/auth/confirm/route.ts']){
    const requestUrl=new URL('https://app.example.invalid/auth/callback?type=invite&token_hash=synthetic-token');
    requestUrl.clone=()=>new URL(requestUrl);
    const handler=load(file,{
      'next/server':{NextResponse:{redirect:value=>value.toString()}},
      'next/headers':{cookies:async()=>({getAll:()=>[],set(){}})},
      '@supabase/ssr':{createServerClient:()=>({auth:{verifyOtp:async()=>({error:null})}})},
      '@/lib/verified-enrollment':{finishVerifiedEnrollment:async()=>({success:false})},
      '@/lib/logger':{logger:{info(){},error(){}}},
    });
    const redirect=new URL(await handler.GET({url:requestUrl.toString(),nextUrl:requestUrl}));
    assert.equal(redirect.pathname,'/login');assert.equal(redirect.searchParams.has('token_hash'),false);
  }
});

function signupHarness(metadata = {}, delivery = 'ok') {
  const mails = [], effects = [];
  const client = {
    from() { const query = { select() { return query; }, eq() { return query; }, single: async () => ({ data: null, error: null }) }; return query; },
    auth: { admin: {
      createUser: async payload => { effects.push(payload); return { data: {user:{id:'synthetic-created-user'}}, error: null }; },
      listUsers: async () => ({ data: { users: [{ email: 'synthetic@example.invalid', user_metadata: metadata }] }, error: null }),
      generateLink: async () => ({ data: { user:{id:'synthetic-created-user'}, properties: { action_link: 'https://synthetic.supabase.co/verify', hashed_token: 'synthetic+token' } }, error: null }),
    } },
    rpc:async()=>({data:null,error:null}),
  };
  const mocks = {
    '@supabase/supabase-js': { createClient: () => client },
    'next/navigation': {},
    'next/headers': { headers: async () => new Headers({ origin: 'https://app.example.invalid', 'x-vercel-forwarded-for': '203.0.113.1' }) },
    '@/lib/server-email-gate': { consumeEmailBudget: async () => ({ allowed: true }) },
    'resend': { Resend: class { emails = { send: async payload => {
      mails.push(payload);
      if (delivery === 'throw') throw new Error('sensitive-provider-detail');
      return delivery === 'error'
        ? { data: null, error: { message: 'sensitive-provider-detail' } }
        : { data: {}, error: null };
    } }; } },
    '@/lib/logger': { maskEmail: () => 'masked', logger: { info() {}, error() {} } },
  };
  return { mocks, mails, effects };
}
function validForm() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ firstName: 'Synthetic', lastName: 'Person',
    email: 'synthetic@example.invalid', password: 'synthetic-password', practiceName: 'Synthetic clinic', practiceSize: 'small' })) data.set(key, value);
  return data;
}

test('real signup email escapes attacker markup and preserves legitimate verification link', async () => {
  const harness = signupHarness();
  const action = load('app/actions/register-clinic.ts', harness.mocks);
  const data = validForm();
  data.set('firstName', '<a href="https://attacker.invalid">Verify</a>');
  assert.equal((await action.registerClinic(data)).success, true);
  assert.equal(harness.mails.length, 1);
  const html = harness.mails[0].html;
  assert.ok(!html.includes('<a href="https://attacker.invalid">'));
  assert.ok(html.includes('&lt;a href=&quot;https://attacker.invalid&quot;&gt;Verify&lt;/a&gt;'));
  assert.ok(html.includes('https://app.example.invalid/auth/confirm?token_hash=synthetic%2Btoken&type=signup'));
});

test('signup rejects missing, oversized, file-valued fields and unsafe logos before privileged effects', async () => {
  for (const mutate of [data => data.delete('firstName'), data => data.set('firstName', 'x'.repeat(101)),
    data => data.set('password', 'x'.repeat(11)), data => data.set('password', 'x'.repeat(129)), data => data.set('practiceSize', 'rogue'),
    data => data.set('email', 'bad-address'), data => data.set('lastName', new Blob(['synthetic']), 'name.txt'),
    data => data.set('logo', new Blob(['<svg/>'], { type: 'image/svg+xml' }), 'logo.svg')]) {
    const harness = signupHarness();
    const action = load('app/actions/register-clinic.ts', harness.mocks);
    const data = validForm(); mutate(data);
    assert.ok((await action.registerClinic(data)).error);
    assert.equal(harness.effects.length, 0);
    assert.equal(harness.mails.length, 0);
  }
});

test('signup provider rejection and transport failure preserve account and return accurate retry guidance', async () => {
  for (const delivery of ['error', 'throw']) {
    const harness = signupHarness({}, delivery);
    const action = load('app/actions/register-clinic.ts', harness.mocks);
    const result = await action.registerClinic(validForm());
    assert.equal(result.success, undefined);
    assert.equal(result.canResend, true);
    assert.equal(harness.effects.length, 1, 'created account is preserved');
    assert.equal(harness.mails.length, 1);
    assert.match(result.error, /Tu cuenta fue creada/);
    assert.match(result.error, /Iniciar Sesión/);
    assert.ok(!JSON.stringify(result).includes('sensitive-provider-detail'));
    if (delivery === 'throw') assert.match(result.error, /no pudimos confirmar/);
  }
});

test('resend provider rejection and transport failure never claim success or reveal provider errors', async () => {
  for (const delivery of ['error', 'throw']) {
    const harness = signupHarness({}, delivery);
    const action = load('app/actions/resend-confirmation.ts', harness.mocks);
    const result = await action.resendConfirmationEmail('synthetic@example.invalid');
    assert.equal(result.success, undefined);
    assert.equal(harness.mails.length, 1);
    assert.ok(result.error);
    assert.ok(!JSON.stringify(result).includes('sensitive-provider-detail'));
    if (delivery === 'throw') assert.match(result.error, /No pudimos confirmar/);
  }
});

test('signup server accepts password boundaries 12 and 128 and rejects 11 and 129', () => {
  const { signupSchema } = load('lib/signup-validation.ts');
  const fields = Object.fromEntries(validForm());
  for (const length of [12, 128]) assert.equal(signupSchema.safeParse({ ...fields, password: 'x'.repeat(length) }).success, true);
  for (const length of [11, 129]) assert.equal(signupSchema.safeParse({ ...fields, password: 'x'.repeat(length) }).success, false);
  const source = fs.readFileSync(path.join(root, 'components/signup-form.tsx'), 'utf8');
  assert.match(source, /minLength=\{12\}/);
  assert.match(source, /maxLength=\{128\}/);
  assert.match(source, /Entre 12 y 128 caracteres/);
  assert.ok(!source.includes('Mínimo 6 caracteres'));
});

test('real resend email escapes editable metadata and rejects invalid addresses', async () => {
  const harness = signupHarness({ title: '<a href="https://attacker.invalid">', full_name: '<img/src=x/onerror=alert(1)>' });
  const action = load('app/actions/resend-confirmation.ts', harness.mocks);
  assert.ok((await action.resendConfirmationEmail('invalid')).error);
  assert.equal(harness.mails.length, 0);
  assert.equal((await action.resendConfirmationEmail('synthetic@example.invalid')).success, true);
  assert.equal(harness.mails.length, 1);
  assert.ok(!harness.mails[0].html.includes('<img/src='));
  assert.ok(harness.mails[0].html.includes('&lt;img/src=x/onerror=alert(1)&gt;'));
  assert.ok(!harness.mails[0].html.includes('<a href="https://attacker.invalid">'));
});
