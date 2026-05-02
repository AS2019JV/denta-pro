const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const email = 'test' + Date.now() + '@example.com';
  await supabase.auth.admin.createUser({ email, password: 'password123', email_confirm: true });
  
  const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'signup',
    email: email,
    password: 'password123'
  });
  console.log("Generate link error:", linkErr?.message || "Success");
}
test();
