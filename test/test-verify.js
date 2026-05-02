const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'signup',
    email: 'test' + Date.now() + '@example.com',
    password: 'password123'
  });
  console.log("Hashed token:", link.properties.hashed_token);
  
  const { data, error } = await supabase.auth.verifyOtp({
    type: 'signup',
    token_hash: link.properties.hashed_token
  });
  console.log("Verify result:", JSON.stringify({ data, error }, null, 2));
}
test();
