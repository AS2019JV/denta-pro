import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { kushki } from "@/lib/kushki";
import { getPlan } from "@/lib/subscription-plans";
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Admin Client for System Operations
// Admin Client initialization moved inside handler to avoid build-time errors
// const supabaseAdmin = createSupabaseClient(...)

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()

    // 1. Auth Check (User must be logged in)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // For now, let's extract the user from the RLS context isn't enough, we need to know WHICH clinic.
    // Client sends clinic_id.
    
    const body = await req.json();
    const { token, planId, clinicId } = body;

    if (!token || !planId || !clinicId) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 2. Validate Plan
    const plan = getPlan(planId);
    if (!plan) {
        return NextResponse.json({ error: "Invalid Plan" }, { status: 400 });
    }

    // 3. Process with Kushki
    // In real life, fetch email from DB.
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing Supabase Admin keys");
      return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: clinic } = await supabaseAdmin.from('clinics').select('id').eq('id', clinicId).single();
    if (!clinic) return NextResponse.json({ error: "Clinic not found" }, { status: 404 });

    const subscription = await kushki.createSubscription({
        token,
        planId: plan.kushkiPlanId,
        amount: plan.price,
        email: "billing@clinic.com", // Should fetch owner email
        metadata: { clinicId }
    });

    // 4. Update Database (Activate Subscription)
    const { error: dbError } = await supabaseAdmin
        .from('clinics')
        .update({
            subscription_tier: plan.id,
            subscription_status: 'active',
            trial_ends_at: null, // End trial
            kushki_subscription_id: subscription.subscriptionId,
            next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // +30 days
        })
        .eq('id', clinicId);

    if (dbError) {
        console.error("DB Update Failed", dbError);
        return NextResponse.json({ error: "Payment succeeded but DB update failed. Contact support." }, { status: 500 });
    }

    // 5. Log Payment
    await supabaseAdmin.from('payments').insert({
        clinic_id: clinicId,
        amount: plan.price,
        status: 'succeeded',
        provider: 'kushki',
        provider_transaction_id: subscription.subscriptionId,
        metadata: { planId }
    });

    return NextResponse.json({ success: true, subscription });

  } catch (error: any) {
    console.error("Payment Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
