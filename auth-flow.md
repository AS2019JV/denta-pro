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
New customers who want to use the software for their clinic follow this flow:

1. **Registration**: 
   - User goes to `/signup`.
   - Fills out the form (Name, Email, Password).
   - *Note*: Initial role selection in the form defaults to 'doctor', but this is temporary for the "Limbo" state.
   - **Result**: User is created in `auth.users`, but **NO** profile is created in `public.profiles` initially.

2. **Onboarding (The "Limbo" State)**:
   - User logs in (or is auto-logged in).
   - Middleware allows access to `/dashboard`.
   - **Correction Implemented**: A **Server-Side** check in `middleware.ts` detects the user has no `clinic_id` in their JWT `app_metadata`.
   - User is strictly redirected to `/onboarding`.

3. **Clinic Creation (Genesis Flow)**:
   - User completes the "Create Clinic" form (`/onboarding`).
   - Signals the `create_tenant_clinic` Secure RPC.
   - **Backend Action**:
     - Creates `public.clinics` row.
     - Creates `public.profiles` row linked to the user, with role `clinic_owner` and the new `clinic_id`.
     - Creates Storage Bucket for branding.
   - User session is refreshed to inject `clinic_id` and `role` into the JWT.

4. **Active State**:
   - User is redirected to `/dashboard`.
   - RLS policies now allow access to their clinic's data.

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
