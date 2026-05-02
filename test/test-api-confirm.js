const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const email = 'test' + Date.now() + '@example.com';
  console.log('Creating user:', email);
  await supabase.auth.admin.createUser({ email, password: 'password123', email_confirm: false });
  
  const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'signup',
    email: email,
    password: 'password123'
  });
  console.log('Generated tokenHash:', link.properties.hashed_token);
  
  const url = `http://localhost:3000/api/auth/confirm?token_hash=${encodeURIComponent(link.properties.hashed_token)}&type=signup`;
  console.log('Fetching:', url);
  
  const res = await fetch(url, { redirect: 'manual' });
  console.log('Response Status:', res.status);
  console.log('Response Headers:', res.headers.get('location'));
}
test();
