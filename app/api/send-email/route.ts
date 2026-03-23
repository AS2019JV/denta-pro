
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { env } from '@/lib/env'

// Initialize Resend with validated environment variable
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { to, subject, message } = body

    if (!to || !subject || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!resend) {
      console.error('[Email Service] RESEND_API_KEY is not configured')
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 503 }
      )
    }

    const { data, error } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL || 'Clinia + <soporte@cliniaplus.com>',
      to: [to],
      subject: subject,
      html: message,
    })

    if (error) {
      console.error('[Resend Error]', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error sending email:', error)
    const isDev = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      { error: isDev && error.message ? error.message : 'Internal Server Error - Email Submission Failed' },
      { status: 500 }
    )
  }
}

