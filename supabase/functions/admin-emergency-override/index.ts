import { createClient } from 'jsr:@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { clinic_id, action, secret_key } = await req.json()

    // 1. Strict Security Check
    const EMERGENCY_KEY = Deno.env.get('EMERGENCY_OVERRIDE_KEY');
    if (!EMERGENCY_KEY || secret_key !== EMERGENCY_KEY) {
        console.warn(`[Break-Glass] Unauthorized attempt for clinic ${clinic_id}`);
        return new Response(JSON.stringify({ error: 'Unauthorized Access' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!clinic_id || !['enable_bypass', 'disable_bypass'].includes(action)) {
        return new Response(JSON.stringify({ error: 'Invalid parameters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 2. Initialize Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const bypassValue = action === 'enable_bypass';

    // 3. Execute Override
    const { error } = await supabaseAdmin
        .from('clinics')
        .update({   
            bypass_subscription: bypassValue, 
            subscription_status: bypassValue ? 'active' : 'past_due' // Should revert to logic, but for safety active ensures access
        })
        .eq('id', clinic_id)

    if (error) throw error;

    console.log(`[Break-Glass] SUCCESS: Clinic ${clinic_id} bypass set to ${bypassValue}`);

    // 4. Audit Log (using the admin client to write to logs)
    // We try to log this critical action
    await supabaseAdmin.from('payments').insert({
        clinic_id: clinic_id,
        amount: 0,
        status: bypassValue ? 'emergency_unlocked' : 'emergency_locked',
        provider: 'break_glass_admin',
        provider_transaction_id: 'manual_override',
        metadata: { reason: "Emergency Admin Override", date: new Date().toISOString() }
    });

    return new Response(
      JSON.stringify({ success: true, message: `Clinic bypass set to ${bypassValue}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
