
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

    // 1. Check Automation Settings
    const { data: settings } = await supabaseClient
      .from('automation_settings')
      .select('*')
      .eq('enabled', true)
      .limit(10) // Process for batches if needed

    if (!settings || settings.length === 0) {
      return new Response(JSON.stringify({ message: 'No automations enabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. For each user with automation enabled, find tomorrow's appointments
    const results = []
    
    // Calculate "Tomorrow"
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const startDate = tomorrow.toISOString().split('T')[0]
    
    for (const setting of settings) {
      // Find appointments for this doctor (user_id) for tomorrow
      const { data: appointments } = await supabaseClient
        .from('appointments')
        .select(`
          *,
          patients (first_name, last_name, phone, email)
        `)
        .eq('doctor_id', setting.user_id)
        .gte('start_time', `${startDate}T00:00:00`)
        .lt('start_time', `${startDate}T23:59:59`)
        .eq('status', 'confirmed') // Only remind confirmed? or scheduled?

      if (appointments) {
        for (const app of appointments) {
          // Mock Sending Message
          const message = setting.reminder_template
            .replace('{patient_name}', app.patients.first_name)
            .replace('{date}', startDate)
            .replace('{time}', app.start_time.split('T')[1].substring(0, 5))
            .replace('{doctor_name}', 'Dr. ' + (app.doctor_id || '')) // Ideally fetch doctor name too

          console.log(`[Sending Reminder] To: ${app.patients.phone}, Msg: ${message}`)
          
          results.push({
            id: app.id,
            patient: app.patients.first_name,
            status: 'sent',
            channel: setting.whatsapp_enabled ? 'whatsapp' : 'email'
          })
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

/*
 deployment instructions:
 supabase functions deploy send-reminders --no-verify-jwt
*/
