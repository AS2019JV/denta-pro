# Resolution Plan: Supabase Email Bounce Warning

Supabase has detected a high rate of bounced emails. This is likely caused by the **Invite Team Member** feature (`invite-team-member` Edge Function) sending invitations to invalid or testing email addresses using Supabase's default limited email service.

## 1. Immediate Code Fix (Applied)
I have added strict email format validation to your `invite-team-member` function to prevent obvious errors (like typos or missing domains) from being sent to Supabase.

**Action Required:**
You need to deploy the updated function for this to take effect:
```bash
npx supabase functions deploy invite-team-member --no-verify-jwt
```

## 2. Configure Custom SMTP (Critical)
To permanently resolve this and lift the restrictions, you **must** switch from Supabase's default email sender to a dedicated provider. **Resend** is the recommended provider for Supabase.

**Steps:**
1.  **Create a Resend Account**: Go to [Resend.com](https://resend.com) and sign up.
2.  **Get API Key**: Create a new API Key in Resend.
3.  **Verify Domain**: Add your domain (e.g., `denta-pro.com`) to Resend and verify the DNS records.
4.  **Configure Supabase**:
    *   Go to your [Supabase Dashboard](https://supabase.com/dashboard/project/leqsrfyjvuxxdsubjjin/settings/auth).
    *   Navigate to **Project Settings** -> **Auth** -> **Email Settings**.
    *   Toggle **Enable Custom SMTP** to ON.
    *   **Sender Email**: `noreply@yourdomain.com` (Must match verified domain in Resend).
    *   **Sender Name**: `Denta Pro`
    *   **SMTP Host**: `smtp.resend.com`
    *   **Port**: `465`
    *   **Username**: `resend`
    *   **Password**: Paste your Resend API Key (starts with `re_`).
    *   **SSL**: On.
    *   Click **Save**.

## 3. Safe Testing Practices
When developing locally or testing:
*   **Do NOT use fake emails** like `test@test.com` or `abc@123.com`. These bounce and hurt your reputation.
*   **Use Email Aliases**: If your email is `dev@gmail.com`, use `dev+doctor@gmail.com`, `dev+admin@gmail.com`. These are legitimate and will be delivered to you.
*   **Use a Dev Mailer**: Consider using a service like [MailPace](https://mailpace.com) or [InBucket](https://www.inbucket.org/) for local dev if needed.

## 4. Updates to Application Logic
The file `app/api/send-email/route.ts` is currently a specific simulation. Once you have your Resend API key, you should replace the simulation with real sending logic using the Resend SDK:

```typescript
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'Denta Pro <noreply@denta-pro.com>',
  to: to,
  subject: subject,
  html: message
});
```
