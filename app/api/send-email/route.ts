
import { NextResponse } from 'next/server'
// import { Resend } from 'resend'

// const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

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

    // SIMULATION: In a real app, you would use Resend, SendGrid, or Nodemailer here.
    // console.log(`[Email Service] Sending email to ${to}: ${subject}`)
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500))

    return NextResponse.json({ success: true, message: 'Email sent successfully' })
  } catch (error) {
    console.error('Error sending email:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
