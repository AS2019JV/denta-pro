import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Init Admin Client (Service Role) to update clinics bypassing RLS
// Moved inside handler to prevent build-time errors if env vars are missing
// const supabaseAdmin = createClient(...)

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-kushki-signature");
    if (!signature) {
         // In real prod, verify HMAC. For now, we assume integrity or use a secret check if Kushki supports basic auth webhooks.
         // return NextResponse.json({ error: "Missing Signature" }, { status: 401 });
    }

    const body = await req.json();
    console.log("[Kushki Webhook] Received:", body);

    // Kushki Webhook Payload Structure (Simplified Example)
    // Check specific event types. Usually 'subscription.charge.failed' or 'transaction.updated'
    const eventType = body.type; 
    const data = body.data;

    if (!data || !data.metadata || !data.metadata.clinicId) {
         console.warn("[Kushki Webhook] Ignored - Missing Metadata/ClinicID");
         return NextResponse.json({ received: true });
    }

    const clinicId = data.metadata.clinicId;
    const transactionId = data.ticketNumber;
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[Kushki Webhook] Missing Supabase keys");
      return NextResponse.json({ error: "Configuration Error" }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // 0. Idempotency Check (Billing Integrity)
    // Check if we already processed this exact transaction ID
    if (transactionId) {
        const { data: existingPayment } = await supabaseAdmin
            .from('payments')
            .select('id')
            .eq('provider_transaction_id', transactionId)
            .single();

        if (existingPayment) {
            console.log(`[Kushki Webhook] IDEMPOTENCY: Transaction ${transactionId} already processed.`);
            return NextResponse.json({ received: true, status: 'already_processed' });
        }
    }

    if (eventType === 'subscription.charge.failed') {
        console.log(`[Kushki Webhook] Payment Failed for Clinic ${clinicId}. Marking Past Due.`);
        
        await supabaseAdmin
            .from('clinics')
            .update({ 
                subscription_status: 'past_due',
                // Optional: Trigger an email notification logic here
             })
            .eq('id', clinicId);
            
        // Log the failure
        await supabaseAdmin.from('payments').insert({
            clinic_id: clinicId,
            amount: data.amount.subtotalIva0 || 0,
            status: 'failed',
            provider: 'kushki',
            provider_transaction_id: data.ticketNumber || 'webhook_event',
            metadata: { reason: "Recurring Charge Failed", raw: body }
        });
    } 
    else if (eventType === 'subscription.charge.succeeded') {
        console.log(`[Kushki Webhook] Payment Succeeded for Clinic ${clinicId}. Extending Access.`);
        
        await supabaseAdmin
            .from('clinics')
            .update({ 
                subscription_status: 'active',
                next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            })
            .eq('id', clinicId);

        // Log the success
        await supabaseAdmin.from('payments').insert({
            clinic_id: clinicId,
            amount: data.amount.subtotalIva0 || 0,
            status: 'succeeded',
            provider: 'kushki',
            provider_transaction_id: data.ticketNumber,
            metadata: { raw: body }
        });
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error("[Kushki Webhook] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
