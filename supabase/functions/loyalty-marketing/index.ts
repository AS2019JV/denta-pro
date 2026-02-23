
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log("[LoyaltyMarketing] Starting scan...");

    // 1. Fetch all clinics with loyalty automation enabled
    const { data: allSettings, error: settingsError } = await supabaseClient
      .from('automation_settings')
      .select('*, clinics(name)')
      .eq('loyalty_enabled', true);

    if (settingsError) throw settingsError;

    const summary = [];

    for (const settings of allSettings) {
      const clinicId = settings.clinic_id;
      const clinicName = settings.clinics?.name || "Nuestra Clínica";

      // 2. Identify Potential VIPs (VIP NOT YET NOTIFIED)
      // Logic: count appointments OR total billed >= threshold
      const { data: candidates, error: candError } = await supabaseClient
        .rpc('get_patients_with_stats', {
          p_clinic_id: clinicId,
          p_limit: 50 // Process in batches
        });

      if (candError) {
        console.error(`[LoyaltyMarketing] Error for clinic ${clinicId}:`, candError);
        continue;
      }

      for (const patient of candidates) {
        const isVIP = patient.appointments_count >= settings.vip_threshold_appointments || 
                      patient.total_billed >= settings.vip_threshold_amount;

        // Check if already notified as VIP or higher
        if (isVIP && patient.loyalty_notified_level !== 'VIP' && settings.vip_welcome_enabled) {
          
          const message = settings.vip_message_template
            .replace('{patient_name}', patient.first_name)
            .replace('{clinic_name}', clinicName);

          console.log(`[LoyaltyMarketing] PROMOTING ${patient.first_name} to VIP. Sending: ${message}`);

          // A. "Send" Message (Log to communicatios ledger)
          const { error: logError } = await supabaseClient
            .from('loyalty_communications')
            .insert({
              clinic_id: clinicId,
              patient_id: patient.id,
              campaign_type: 'VIP_WELCOME',
              message_content: message,
              status: 'sent'
            });

          if (logError) {
            console.error(`[LoyaltyMarketing] Failed to log communication:`, logError);
            continue;
          }

          // B. Update Patient notified status
          await supabaseClient
            .from('patients')
            .update({ 
              loyalty_notified_level: 'VIP',
              last_loyalty_outreach_at: new Date().toISOString()
            })
            .eq('id', patient.id);

          summary.push({ patient: patient.first_name, clinic: clinicName, type: 'VIP_PROMOTION' });
        }
        
        // C. Birthday Logic (Simplified example)
        if (settings.birthday_greet_enabled) {
            const today = new Date().toISOString().substring(5, 10); // "MM-DD"
            const patientBday = patient.birth_date?.substring(5, 10);
            
            if (today === patientBday) {
                // Check if already greeted this year
                const { data: alreadyGreeted } = await supabaseClient
                    .from('loyalty_communications')
                    .select('id')
                    .eq('patient_id', patient.id)
                    .eq('campaign_type', 'BIRTHDAY')
                    .gte('created_at', new Date().getFullYear() + '-01-01')
                    .limit(1);

                if (!alreadyGreeted || alreadyGreeted.length === 0) {
                    const bdayMsg = `¡Feliz cumpleaños {patient_name}! Te deseamos lo mejor en tu día. - {clinic_name}`
                        .replace('{patient_name}', patient.first_name)
                        .replace('{clinic_name}', clinicName);
                    
                    await supabaseClient.from('loyalty_communications').insert({
                        clinic_id: clinicId,
                        patient_id: patient.id,
                        campaign_type: 'BIRTHDAY',
                        message_content: bdayMsg,
                        status: 'sent'
                    });
                    
                    summary.push({ patient: patient.first_name, clinic: clinicName, type: 'BIRTHDAY' });
                }
            }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
