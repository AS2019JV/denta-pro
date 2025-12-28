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
    // 1. Init Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Identify Candidates for Purge (Archived > 90 Days)
    const retentionLimit = new Date();
    retentionLimit.setDate(retentionLimit.getDate() - 90); // 90 Days ago
    
    // Select Clinics that are 'archived' AND were archived before the limit
    const { data: clinics, error: fetchError } = await supabaseAdmin
        .from('clinics')
        .select('id, name, archived_at')
        .eq('subscription_status', 'archived')
        .lt('archived_at', retentionLimit.toISOString())

    if (fetchError) throw fetchError;

    const logs = [];

    // 3. Execute Purge
    for (const clinic of (clinics || [])) {
        console.log(`[Purge Job] Permanently deleting clinic: ${clinic.name} (${clinic.id})`);
        
        // Call RPC for clean deletion
        const { error: deleteError } = await supabaseAdmin.rpc('purge_clinic_data', {
            target_clinic_id: clinic.id
        });

        if (deleteError) {
            console.error(`[Purge Job] Failed to delete ${clinic.id}`, deleteError);
            logs.push({ id: clinic.id, status: 'failed', error: deleteError.message });
        } else {
            logs.push({ id: clinic.id, status: 'purged' });
        }
    }

    return new Response(
      JSON.stringify({ 
          success: true, 
          message: `Purge job completed. Processed ${clinics?.length} records.`,
          details: logs 
       }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
