const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'signup',
    email: 'test' + Date.now() + '@example.com',
    password: 'password123'
  });
  console.log(JSON.stringify(data, null, 2));
}
test();
