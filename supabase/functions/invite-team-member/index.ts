// supabase/functions/invite-team-member/index.ts
// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // 1. Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Initialize Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Authenticate Callers
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !caller) {
      throw new Error('Unauthorized: Valid user session required.')
    }

    // 4. Verify Caller is Clinic Owner
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, clinic_id')
      .eq('id', caller.id)
      .single()

    if (callerProfile?.role !== 'clinic_owner') {
       // Allow testing if needed, or strict. 
       // For now, strict as per plan.
       return new Response(
        JSON.stringify({ error: 'Permission Denied: Only Clinic Owners can invite staff.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Parse Request
    const { email, role, fullName } = await req.json()

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
       throw new Error("Invalid email address format.")
    }

    // Validate role
    const allowedRoles = ['doctor', 'receptionist']
    if (!allowedRoles.includes(role)) {
       throw new Error(`Invalid Role. Must be one of: ${allowedRoles.join(', ')}`)
    }

    // 6. Invite User (Supabase Auth)
    const { data: newUser, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)

    if (inviteError) throw inviteError

    // 7. Create Profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: newUser.user.id,
        clinic_id: callerProfile.clinic_id,
        role: role,
        full_name: fullName,
        // status: 'invited' // If we had a status column
      })

    if (profileError) {
      // Rollback
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      throw profileError
    }

    // 8. Add to Clinic Members (CRITICAL FIX for RLS)
    // This ensures the new user can actually SEE data via is_clinic_member() check
    const { error: memberError } = await supabaseAdmin
      .from('clinic_members')
      .insert({
        user_id: newUser.user.id,
        clinic_id: callerProfile.clinic_id,
        role: role
      })

    if (memberError) {
       console.error("Failed to add to clinic_members:", memberError)
       // Rollback Profile and User to keep state clean
       await supabaseAdmin.from('profiles').delete().eq('id', newUser.user.id)
       await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
       throw new Error(`Failed to assign clinic membership: ${memberError.message}`)
    }

    return new Response(
      JSON.stringify({ message: `Invitation sent to ${email} as ${role}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
