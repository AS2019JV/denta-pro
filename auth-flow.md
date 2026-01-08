# Authentication & Authorization Flow

## Overview
The application uses Supabase Auth for user identity and a robust Role-Based Access Control (RBAC) system backed by PostgreSQL Row Level Security (RLS). Users are strictly scoped to their **Clinic** via `clinic_id` claims in their JWT.

## Roles
The system defines three primary roles in the `profiles` table and enforced via RLS:
1. **Clinic Owner** (`clinic_owner`): Full administrative control over a single clinic. Can manage billing, settings, and team members.
2. **Doctor** (`doctor`): Clinical access. Can view/create patient records, odontograms, and appointments. Restricted from billing settings.
3. **Receptionist** (`receptionist`): Administrative access. Can manage patients and appointments. **Can view Medical Alerts** (e.g. allergies) via the `patients` table. **Strictly denied** access to deep Clinical Records (Medical History).

---

## User Journeys

### 1. New Clinic Owner (Customer Path)
New customers who want to use the software for their clinic follow this flow (One-Page Onboarding):

1. **Combined Registration (Free Trial)**:
   - User goes to `/free-trial` (Page: `app/(landing)/free-trial/page.tsx`).
   - Fills out a **Single Form** encompassing:
     - User Credentials (Name, Email, Password).
     - Clinic Details (Name, Size, Phone, Address, Logo).
   - **Server Action (`registerClinic`)**:
     - uses `SUPABASE_SERVICE_ROLE_KEY` to orchestrate creation.
     - Creates **User** in `auth.users` (with email confirmation required).
     - Creates **Clinic** in `public.clinics` (with 14-day trial status).
     - Creates **Profile** in `public.profiles` (as `clinic_owner`, linked to new clinic).
     - Uploads Clinic Logo to storage.
     - Triggers standard Supabase Signup Confirmation email.

2. **Verification & Access**:
   - User clicks the confirmation link in their email.
   - User logs in `/login`.
   - **Auth Hook**: `custom_access_token_hook` runs during token generation.
     - Detects the pre-created Profile.
     - Injects `clinic_id` and `role` ('clinic_owner') into the JWT.
   - **Middleware**:
     - Detects `clinic_id` in the session.
     - Directs user straight to `/dashboard`.
   - **Result**: Immediate access to a fully configured environment; no "Onboarding" wizard required for this path.

*(Note: The `/onboarding` "Limbo State" route remains as a fallback for users who sign up via legacy paths or if the Server Action fails partially, but the primary flow bypasses it.)*

### 2. Doctor / Receptionist (Invitation Path)
Staff members are added by the Clinic Owner.

1. **Invitation**:
   - Clinic Owner goes to `Settings > Team`.
   - Enters email, name, and role.
   - System calls `invite-team-member` Edge Function.

2. **Backend Processing**:
   - Edge Function verifies the caller is a `clinic_owner`.
   - Calls `supabase.auth.admin.inviteUserByEmail`.
   - **Crucial Step**: Pre-creates the `public.profiles` row with the correct `clinic_id` and `role`.

3. **Activation**:
   - Staff member receives an email with a magic link / password setup.
   - Staff member logs in.
   - `AuthContext` detects the existing profile.
   - JWT Custom Hook injects the pre-assigned `clinic_id`.
   - User lands on `/dashboard` with correct permissions immediately.

---

## Security & Data Protection
- **Clinic Isolation**: Every RLS policy enforces `clinic_id` matching. A user from Clinic A physically cannot query data from Clinic B.
- **Role Enforcement**: Critical tables like `clinical_records` have `role IN ('doctor', 'clinic_owner')` clauses, ensuring Receptionists cannot query sensitive medical data even via API.
- **Secure RPC**: Clinic creation is handled by a `SECURITY DEFINER` function, preventing users from arbitrarily assigning themselves to existing clinics.
