const { createClient } = require('@supabase/supabase-js');
const { createServerClient } = require('@supabase/ssr');

const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const email = 'test' + Date.now() + '@example.com';
  await adminSupabase.auth.admin.createUser({ email, password: 'password123', email_confirm: false });
  
  const { data: link, error: linkErr } = await adminSupabase.auth.admin.generateLink({
    type: 'signup',
    email: email
  });
  
  const ssrSupabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() { return [] },
      setAll(cookiesToSet) {}
    }
  });

  const { data, error } = await ssrSupabase.auth.verifyOtp({
    type: 'signup',
    token_hash: link.properties.hashed_token
  });
  console.log("SSR verify result:", JSON.stringify({ data, error }, null, 2));
}
test();
