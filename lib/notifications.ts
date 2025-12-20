import { supabase } from "@/lib/supabase"

export const NotificationsService = {
  /**
   * Simulates sending a Payment Reminder via Email/WhatsApp
   */
  sendPaymentReminder: async ({ billingId, patientEmail, patientPhone, amount }: { billingId: string, patientEmail?: string, patientPhone?: string, amount: number }) => {
    const paymentLink = `https://denta-pro.com/pay/${billingId}` // In dev: http://localhost:3000/pay/${billingId}
    
    // 1. Log simulation
    console.log(`[Notification] Sending payment reminder for Billing ${billingId}`)
    console.log(`Link: ${paymentLink}`)

    // 2. Call our internal Email API (simulated)
    if (patientEmail) {
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: patientEmail,
            subject: 'Recordatorio de Pago - Denta Pro',
            message: `Hola, tienes una factura pendiente de $${amount}. Por favor realiza el pago aquí: ${paymentLink}`
          })
        })
      } catch (e) {
        console.error("Error sending email:", e)
      }
    }

    // 3. Return success
    return { success: true, link: paymentLink }
  }
}
