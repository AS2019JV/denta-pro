# SaaS Migration: Final Steps

I have successfully applied the database migrations and deployed the Edge Function. You have **2 remaining manual steps** to fully activate the new architecture.

## 1. Enable the Auth Hook
The custom claims logic (adding `clinic_id` to JWT) relies on a hook that needs to be enabled in the dashboard.
1.  Go to your **[Supabase Dashboard](https://supabase.com/dashboard/project/leqsrfyjvuxxdsubjjin/auth/hooks)**.
2.  Look at the left sidebar under **Autentication > Configuration**.
3.  Click on **Auth Hooks** (it might say BETA).
4.  Find the **"Custom Access Token"** hook (often the first one).
5.  Click to Edit/Enable it.
6.  Select the function: `public.custom_access_token_hook`.

## 2. Set the Service Role Key
The *Invite Member* feature needs the "Service Role Key" to bypass RLS and create users.
1.  Find your `service_role` key in **Project Settings > API**.
2.  Run this command in your terminal (replacing `YOUR_KEY` with the actual key):
    ```bash
    npx supabase secrets set SERVICE_ROLE_KEY=eyJh...
    ```

## Verification
Once done, log out and log back in. Your session token will now contain the `role` and `clinic_id` claims, enabling the SaaS security model.
