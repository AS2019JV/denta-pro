# Security Review: denta-pro

## Scope

Current working tree security-critical source review; partial repository coverage.

- Scan mode: repository
- Target kind: git_worktree
- Target ID: target_sha256_3ba26daa18295bf8cefa217773989fa007fcdb16080c431669d9084988356f0c
- Revision: f96fbb898ec2a0615dec293ee3e5ce0a9b41b170
- Snapshot digest: codex-security-snapshot/v1:sha256:16b79848e0464bdf7c672a78725dd4f88bbc659970c600925396d8b3a8821713
- Inventory strategy: repository
- Included paths: .
- Excluded paths: none
- Runtime or test status: No deployed services exercised
- Artifacts reviewed: .agents/rules/clinical-saas-invariants.md, CORRECTIONS_AND_ROADMAP.md, NEXT_STEPS.md, PRODUCTION_READINESS.md, SYSTEM_ARCHITECTURE_AND_OPERATION.md

Limitations and exclusions:
- No live database or comprehensive runtime/dependency validation.
- Baseline worker stopped at account usage limit.
- Excluded .next/\*\*; node_modules/\*\*; .git/\*\*; binary assets; deployed services: Generated/vendor/history and external runtime controls were not reviewed.

### Scan Summary

| Field | Value |
| --- | --- |
| Scan outcome | completed |
| Reportable findings | 13 |
| Severity mix | high: 6, medium: 6, low: 1 |
| Confidence mix | high: 11, medium: 2 |
| Coverage | partial |
| Validation mode | static |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

Clinia+ is an Ecuador dental EHR/PMS. React/Next browser clients connect directly to Supabase Auth/PostgREST/Storage (lib/supabase.ts:1-11). Next actions/routes separately use service-role credentials (app/actions/invite-member.ts:17-29; app/api/payments/subscribe/route.ts:61-88). Deno Edge functions provide a third independent administrative boundary. Database RLS, RPCs and object policies are primary data controls; navigation guards do not contain direct API access. Generated from independent architecture review, then checked against actual consumers.

### Assets

- Patient identity, clinical notes, odontogram, allergies and billing aggregates (20260525_db_verification_and_repair.sql:61-103 in supabase/migrations).
- Sessions, clinic membership and owner authority (components/auth-context.tsx:100-148); service-role and provider credentials are described by references only.
- Clinical objects patient-files/\<patientId\>/\<timestamp\>-\<random\>.\<extension\> (components/patient-files.tsx:152-177), private bucket declaration versus public-URL consumer.
- Audit old/new health-record snapshots (supabase/migrations/20251218_saas_audit_triggers.sql:8-34); downloaded JSON/PDF and billing integrity.

### Trust Boundaries

- Browser public project endpoint/anon key -\> verified user session -\> direct database calls. Membership patient policies (supabase/migrations/20251215_multi_clinic_support.sql:27-59), JWT file policies (20260526_create_patient_files_and_notes.sql:22-42) and definer statistics RPC (20260525_db_verification_and_repair.sql:113) differ materially.
- Account provisioning: user metadata reaches email-verification trigger and trusted claims (supabase/migrations/20260423_fix_clinic_trigger.sql:9-56). Profiles supply JWT custom hook (20251227_optimize_rls_jwt.sql:24-58). Neither source is immutable under current definitions.
- Team UI invokes Next action (app/(dashboard)/dentists/page.tsx:21,152), which returns an invite capability (app/actions/invite-member.ts:111). Separate Edge handler checks bearer user, profile owner and allowed role (supabase/functions/invite-team-member/index.ts:24-62); its guard does not wrap the action.
- Clinical objects use patient-only path; metadata RLS does not guard storage.objects bucket-only policies (supabase/migrations/20260526_create_patient_files_and_notes.sql:94-112). Public clinic-branding allows membership/owner writes (20251222_create_storage_branding.sql:16-29). Doctor/patient avatar and receipts policies are not established.
- Email request recipient/content -\> server Resend key -\> external recipient (app/api/send-email/route.ts:7-34). Signup template resolves runtime cwd/emails/signup-confirmation.html and confirmation origin NEXT_PUBLIC_APP_URL or localhost (app/actions/register-clinic.ts:131-159).
- Subscriptions: verified user and RLS-visible clinic -\> service-role activation (app/api/payments/subscribe/route.ts:32-88). Gateway prod only for KUSHKI_ENVIRONMENT=prod, otherwise UAT; missing merchant key enables synthetic success (lib/kushki.ts:11-17,73-83). Webhook shared-secret header check and non-atomic payment lookup precede service-role mutation (app/api/webhooks/kushki/route.ts:10-99).
- Edge purge uses service role across archived clinics older than 90 days; RPC lacks age/caller checks (supabase/functions/purge-data/index.ts:15-42; supabase/migrations/20251227_data_retention_lifecycle.sql:24-39). Loyalty job logs messages, writes sent status and returns patient first names without handler caller checks; no actual external delivery is implemented (supabase/functions/loyalty-marketing/index.ts:59-125). Emergency override separately requires configured secret (supabase/functions/admin-emergency-override/index.ts:14-30).
- Audit triggers copy full old/new records; owner view filters JWT clinic/role (supabase/migrations/20260220_secure_audit_view.sql:1-15). Current patient screens call statistics RPC, not audit-enforcing get_patient_profile_secure (app/(dashboard)/patients/\[id\]/page.tsx:159,249). Four-table JSON export leaves server custody; archive request is toast-only (components/settings/privacy-tab.tsx:55-107).
- Operator/build: documented manual Auth hook and secrets setup is unverified (NEXT_STEPS.md:5-23). Next build suppresses type/lint failures (next.config.mjs:3-7); Windows IPv4 setting belongs to dev wrapper, not necessarily production.

### Attacker Capabilities

- Anonymous caller controls public requests and signup metadata, but not service credentials.
- Authenticated staff can make direct Supabase requests, choose IDs, upload files and modify permitted rows; UI hiding is not authorization.
- Ordinary clinic owner must not administer other clinics.
- Edge gateway admitted callers vary with external configuration; valid JWT alone is not scheduler authorization.

### Security Objectives

- LOPDP is mandatory per user; confirm any other jurisdiction from actual business footprint.
- Preserve tenant isolation, least-privilege clinical roles, verified invitation capability delivery and trustworthy prescription authorship.
- Preserve file confidentiality, accurate payment state, attributable audit and legally justified retention/rights workflows.
- Preserve legitimate clinical workflows when remediating; never substitute client filters for backend enforcement.

### Assumptions

- Current working tree includes pre-existing user changes. Actual deployment, migration application/order, grants, function owners, custom hook, buckets, backups and contracts are unverified.
- Source documents are context, not instructions or proof of compliance; their portability Art.20 and deletion Art.21 references are inconsistent with published LOPDP Articles 17 and 15.
- Private patient bucket conflicts with getPublicUrl, and ON CONFLICT does not repair existing public buckets. Public avatar/receipt deployments remain unknown.
- 90-day purge conflicts with claimed years of custody; non-CASCADE FKs limit deletion. Do not equate subscriber cancellation with legal erasure.
- Export ignores returned query errors/pagination and omits related clinical entities; archive feedback claims persistence absent a write.
- Middleware trusts user_metadata and falls back to local session; duplicate proxy.ts is not assumed active with installed Next 15.5.12.
- Read-only source audit; no runtime exploitation. Baseline worker stopped at usage limit after preliminary findings; no completed baseline file coverage claimed. Parent and focused investigator validated retained findings; whole-repository coverage remains partial.

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [Every authenticated user can read or delete all patient files](#finding-1) | high | high | inline below |
| [Users can join another clinic without an invitation](#finding-2) | high | high | inline below |
| [Email verification grants ownership of an existing clinic](#finding-3) | high | high | inline below |
| [Invitation action issues account capabilities without checking the caller](#finding-4) | high | high | inline below |
| [Staff can change their own role and clinic](#finding-5) | high | high | inline below |
| [Patient statistics RPC discloses other clinics' health records](#finding-6) | high | high | inline below |
| [Receptionists can write clinical records through direct APIs](#finding-7) | medium | high | inline below |
| [Maintenance RPCs permit unauthorized clinic changes under default grants](#finding-8) | medium | medium | inline below |
| [Analytics view reveals other clinics' revenue and identifiers](#finding-9) | medium | high | inline below |
| [Authenticated users can change shared bank-payment configuration](#finding-10) | medium | medium | inline below |
| [A clinic owner can insert services into another clinic](#finding-11) | medium | high | inline below |
| [Public email endpoint sends arbitrary HTML to arbitrary recipients](#finding-12) | medium | high | inline below |
| [Missing payment credentials can activate an unpaid subscription](#finding-13) | low | high | inline below |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct evidence supports the finding with no material unresolved blocker. |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low | Evidence is incomplete and the item is retained only for explicit follow-up. |

<a id="finding-1"></a>

### [1] Every authenticated user can read or delete all patient files

| Field | Value |
| --- | --- |
| Severity | high |
| Confidence | high |
| Confidence rationale | Parent source trace corroborates the control and relevant consumers; live deployment and runtime exploitation were not tested. |
| Category | patient-storage-tenant-bypass |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/20260526_create_patient_files_and_notes.sql:99-112 |

#### Summary

Storage INSERT, SELECT and DELETE policies check only the shared patient-files bucket. Any authenticated account can enumerate, download and delete other clinics' attachments.

#### Root Cause

Storage INSERT, SELECT and DELETE policies check only the shared patient-files bucket. Any authenticated account can enumerate, download and delete other clinics' attachments.

**Every authenticated user can read or delete all patient files** — `supabase/migrations/20260526_create_patient_files_and_notes.sql:99-112`

Storage INSERT, SELECT and DELETE policies check only the shared patient-files bucket. Any authenticated account can enumerate, download and delete other clinics' attachments.

```
CREATE POLICY "Users can upload patient files" 
  ON storage.objects FOR INSERT 
  TO authenticated 
  WITH CHECK (bucket_id = 'patient-files');

CREATE POLICY "Users can read patient files" 
  ON storage.objects FOR SELECT 
  TO authenticated 
  USING (bucket_id = 'patient-files');

CREATE POLICY "Users can delete patient files" 
  ON storage.objects FOR DELETE 
  TO authenticated 
  USING (bucket_id = 'patient-files');
```

#### Validation

Authenticated Storage request -\> bucket-only storage.objects policy -\> cross-tenant file access. Counterevidence: Private bucket status requires authentication but does not establish tenant isolation; patient_files metadata RLS is a separate control.

Validation method: static source and effective migration review

**Every authenticated user can read or delete all patient files** — `supabase/migrations/20260526_create_patient_files_and_notes.sql:99-112`

Storage INSERT, SELECT and DELETE policies check only the shared patient-files bucket. Any authenticated account can enumerate, download and delete other clinics' attachments.

```
CREATE POLICY "Users can upload patient files" 
  ON storage.objects FOR INSERT 
  TO authenticated 
  WITH CHECK (bucket_id = 'patient-files');

CREATE POLICY "Users can read patient files" 
  ON storage.objects FOR SELECT 
  TO authenticated 
  USING (bucket_id = 'patient-files');

CREATE POLICY "Users can delete patient files" 
  ON storage.objects FOR DELETE 
  TO authenticated 
  USING (bucket_id = 'patient-files');
```

Limitations:
- Applied policies and patient attachments in the bucket.
- No live database, Storage, account, payment or email operation was performed.

#### Dataflow

Authenticated Storage request -\> bucket-only storage.objects policy -\> cross-tenant file access.

**Every authenticated user can read or delete all patient files** — `supabase/migrations/20260526_create_patient_files_and_notes.sql:99-112`

Storage INSERT, SELECT and DELETE policies check only the shared patient-files bucket. Any authenticated account can enumerate, download and delete other clinics' attachments.

```
CREATE POLICY "Users can upload patient files" 
  ON storage.objects FOR INSERT 
  TO authenticated 
  WITH CHECK (bucket_id = 'patient-files');

CREATE POLICY "Users can read patient files" 
  ON storage.objects FOR SELECT 
  TO authenticated 
  USING (bucket_id = 'patient-files');

CREATE POLICY "Users can delete patient files" 
  ON storage.objects FOR DELETE 
  TO authenticated 
  USING (bucket_id = 'patient-files');
```

#### Reachability

Applied policies and patient attachments in the bucket.

Limitations:
- Private bucket status requires authentication but does not establish tenant isolation; patient_files metadata RLS is a separate control.

#### Severity

**High** — A realistic low-privilege caller can cross an authority or patient-confidentiality boundary under the stated source-defined deployment.

Additional runtime or deployment evidence could raise or lower this severity.

#### Remediation

Bind objects to an authorized clinic and patient on every operation; use private signed downloads and retention-aware deletion with direct two-tenant Storage tests.

Tests:
- Exercise the described attack with two isolated synthetic clinics and assert denial before side effects.
- Assert an authorized owner/clinician retains the intended operation and correct clinical data.

<a id="finding-2"></a>

### [2] Users can join another clinic without an invitation

| Field | Value |
| --- | --- |
| Severity | high |
| Confidence | high |
| Confidence rationale | Parent source trace corroborates the control and relevant consumers; live deployment and runtime exploitation were not tested. |
| Category | membership-self-enrollment |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/20260525_db_verification_and_repair.sql:291-300 |

#### Summary

Self-membership INSERT checks user_id but accepts any clinic_id and role. Surviving membership-based patient policies authorize read, insert and update for that clinic.

#### Root Cause

Self-membership INSERT checks user_id but accepts any clinic_id and role. Surviving membership-based patient policies authorize read, insert and update for that clinic.

**Users can join another clinic without an invitation** — `supabase/migrations/20260525_db_verification_and_repair.sql:291-300`

Self-membership INSERT checks user_id but accepts any clinic_id and role. Surviving membership-based patient policies authorize read, insert and update for that clinic.

```
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'clinic_members' 
      AND policyname = 'Users can insert their own membership'
  ) THEN
    CREATE POLICY "Users can insert their own membership"
      ON public.clinic_members FOR INSERT
      WITH CHECK (auth.uid() = user_id);
```

#### Validation

Self INSERT clinic_members -\> is_clinic_member -\> permissive patient policies -\> cross-clinic health records. Counterevidence: Later JWT patient policies have different names; permissive policies combine with OR. Foreign keys prove existence only.

Validation method: static source and effective migration review

**Users can join another clinic without an invitation** — `supabase/migrations/20260525_db_verification_and_repair.sql:291-300`

Self-membership INSERT checks user_id but accepts any clinic_id and role. Surviving membership-based patient policies authorize read, insert and update for that clinic.

```
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'clinic_members' 
      AND policyname = 'Users can insert their own membership'
  ) THEN
    CREATE POLICY "Users can insert their own membership"
      ON public.clinic_members FOR INSERT
      WITH CHECK (auth.uid() = user_id);
```

Limitations:
- Authenticated profile, victim UUID and effective INSERT table privilege; Supabase default grants must be confirmed live.
- No live database, Storage, account, payment or email operation was performed.

#### Dataflow

Self INSERT clinic_members -\> is_clinic_member -\> permissive patient policies -\> cross-clinic health records.

**Users can join another clinic without an invitation** — `supabase/migrations/20260525_db_verification_and_repair.sql:291-300`

Self-membership INSERT checks user_id but accepts any clinic_id and role. Surviving membership-based patient policies authorize read, insert and update for that clinic.

```
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'clinic_members' 
      AND policyname = 'Users can insert their own membership'
  ) THEN
    CREATE POLICY "Users can insert their own membership"
      ON public.clinic_members FOR INSERT
      WITH CHECK (auth.uid() = user_id);
```

#### Reachability

Authenticated profile, victim UUID and effective INSERT table privilege; Supabase default grants must be confirmed live.

Limitations:
- Later JWT patient policies have different names; permissive policies combine with OR. Foreign keys prove existence only.

#### Severity

**High** — A realistic low-privilege caller can cross an authority or patient-confidentiality boundary under the stated source-defined deployment.

Additional runtime or deployment evidence could raise or lower this severity.

#### Remediation

Remove self-enrollment and consolidate patient policies. Create memberships through verified owner invitation acceptance with server-selected role/clinic.

Tests:
- Exercise the described attack with two isolated synthetic clinics and assert denial before side effects.
- Assert an authorized owner/clinician retains the intended operation and correct clinical data.

<a id="finding-3"></a>

### [3] Email verification grants ownership of an existing clinic

| Field | Value |
| --- | --- |
| Severity | high |
| Confidence | high |
| Confidence rationale | Parent source trace corroborates the control and relevant consumers; live deployment and runtime exploitation were not tested. |
| Category | onboarding-tenant-claim |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/20260423_fix_clinic_trigger.sql:20-44 |

#### Summary

A new signup can put an existing clinic UUID in pending_clinic metadata. Verification ignores the insert conflict and assigns the caller that clinic and clinic_owner in both profile and trusted app metadata.

#### Root Cause

A new signup can put an existing clinic UUID in pending_clinic metadata. Verification ignores the insert conflict and assigns the caller that clinic and clinic_owner in both profile and trusted app metadata.

**Email verification grants ownership of an existing clinic** — `supabase/migrations/20260423_fix_clinic_trigger.sql:20-44`

A new signup can put an existing clinic UUID in pending_clinic metadata. Verification ignores the insert conflict and assigns the caller that clinic and clinic_owner in both profile and trusted app metadata.

```
      -- Use provided ID or generate new one
      IF (pending_data->>'id') IS NOT NULL AND (pending_data->>'id') != '' THEN
         new_clinic_id := (pending_data->>'id')::uuid;
      ELSE
         new_clinic_id := gen_random_uuid();
      END IF;

      -- 1. Create Clinic
      INSERT INTO public.clinics (id, name, address, phone, subscription_tier, owner_id)
      VALUES (
        new_clinic_id,
        pending_data->>'name',
        pending_data->>'address',
        pending_data->>'phone',
        COALESCE(pending_data->>'subscription_tier', 'trial'),
        NEW.id
      )
      ON CONFLICT (id) DO NOTHING;
      
      -- 2. Update Profile (created by handle_new_user)
      UPDATE public.profiles
      SET 
        clinic_id = new_clinic_id,
        role = 'clinic_owner'::public.app_role
      WHERE id = NEW.id;
```

#### Validation

Caller signup metadata -\> email verification trigger -\> ignored clinic ID conflict -\> profile and app_metadata ownership. Counterevidence: The existing-profile guard blocks already assigned users, not fresh signups. clinics.owner_id is not overwritten; JWT-based authorization nevertheless grants owner capabilities.

Validation method: static source and effective migration review

**Email verification grants ownership of an existing clinic** — `supabase/migrations/20260423_fix_clinic_trigger.sql:20-44`

A new signup can put an existing clinic UUID in pending_clinic metadata. Verification ignores the insert conflict and assigns the caller that clinic and clinic_owner in both profile and trusted app metadata.

```
      -- Use provided ID or generate new one
      IF (pending_data->>'id') IS NOT NULL AND (pending_data->>'id') != '' THEN
         new_clinic_id := (pending_data->>'id')::uuid;
      ELSE
         new_clinic_id := gen_random_uuid();
      END IF;

      -- 1. Create Clinic
      INSERT INTO public.clinics (id, name, address, phone, subscription_tier, owner_id)
      VALUES (
        new_clinic_id,
        pending_data->>'name',
        pending_data->>'address',
        pending_data->>'phone',
        COALESCE(pending_data->>'subscription_tier', 'trial'),
        NEW.id
      )
      ON CONFLICT (id) DO NOTHING;
      
      -- 2. Update Profile (created by handle_new_user)
      UPDATE public.profiles
      SET 
        clinic_id = new_clinic_id,
        role = 'clinic_owner'::public.app_role
      WHERE id = NEW.id;
```

Limitations:
- Fresh account with verified attacker-controlled email, known victim UUID, installed verification trigger. No custom token hook is needed for this path.
- No live database, Storage, account, payment or email operation was performed.

#### Dataflow

Caller signup metadata -\> email verification trigger -\> ignored clinic ID conflict -\> profile and app_metadata ownership.

**Email verification grants ownership of an existing clinic** — `supabase/migrations/20260423_fix_clinic_trigger.sql:20-44`

A new signup can put an existing clinic UUID in pending_clinic metadata. Verification ignores the insert conflict and assigns the caller that clinic and clinic_owner in both profile and trusted app metadata.

```
      -- Use provided ID or generate new one
      IF (pending_data->>'id') IS NOT NULL AND (pending_data->>'id') != '' THEN
         new_clinic_id := (pending_data->>'id')::uuid;
      ELSE
         new_clinic_id := gen_random_uuid();
      END IF;

      -- 1. Create Clinic
      INSERT INTO public.clinics (id, name, address, phone, subscription_tier, owner_id)
      VALUES (
        new_clinic_id,
        pending_data->>'name',
        pending_data->>'address',
        pending_data->>'phone',
        COALESCE(pending_data->>'subscription_tier', 'trial'),
        NEW.id
      )
      ON CONFLICT (id) DO NOTHING;
      
      -- 2. Update Profile (created by handle_new_user)
      UPDATE public.profiles
      SET 
        clinic_id = new_clinic_id,
        role = 'clinic_owner'::public.app_role
      WHERE id = NEW.id;
```

#### Reachability

Fresh account with verified attacker-controlled email, known victim UUID, installed verification trigger. No custom token hook is needed for this path.

Limitations:
- The existing-profile guard blocks already assigned users, not fresh signups. clinics.owner_id is not overwritten; JWT-based authorization nevertheless grants owner capabilities.

#### Severity

**High** — A realistic low-privilege caller can cross an authority or patient-confidentiality boundary under the stated source-defined deployment.

Additional runtime or deployment evidence could raise or lower this severity.

#### Remediation

Generate clinic identifiers in trusted code; never grant ownership after an ignored insert. Existing-clinic joins must consume an authorized invitation.

Tests:
- Exercise the described attack with two isolated synthetic clinics and assert denial before side effects.
- Assert an authorized owner/clinician retains the intended operation and correct clinical data.

<a id="finding-4"></a>

### [4] Invitation action issues account capabilities without checking the caller

| Field | Value |
| --- | --- |
| Severity | high |
| Confidence | high |
| Confidence rationale | Parent source trace corroborates the control and relevant consumers; live deployment and runtime exploitation were not tested. |
| Category | invite-action-missing-authorization |
| CWE | CWE-862 |
| Affected lines | app/actions/invite-member.ts:6-40 |

#### Summary

The deployed team UI imports a server action that accepts email, clinicId and role, uses service-role generateLink without caller authentication, and returns the invite capability at line 111.

#### Root Cause

The deployed team UI imports a server action that accepts email, clinicId and role, uses service-role generateLink without caller authentication, and returns the invite capability at line 111.

**Invitation action issues account capabilities without checking the caller** — `app/actions/invite-member.ts:6-40`

The deployed team UI imports a server action that accepts email, clinicId and role, uses service-role generateLink without caller authentication, and returns the invite capability at line 111.

```
export async function inviteTeamMember(formData: FormData) {
  const email = formData.get("email") as string
  const name = formData.get("name") as string || "Doctor"
  const clinicId = formData.get("clinicId") as string
  const role = formData.get("role") as string || "receptionist"
  const specialization = formData.get("specialization") as string || (role === 'doctor' ? 'Odontólogo General' : 'Administrativo')

  if (!email || !clinicId) {
    throw new Error("El correo electrónico y el ID de la clínica son obligatorios.")
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const resendApiKey = process.env.RESEND_API_KEY!

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  // 1. Generate Invite Link
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email: email,
    options: {
      data: {
        clinic_id: clinicId,
        role: role,
        full_name: name,
        specialization: specialization,
        pending_invite: true
      },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`
```

#### Validation

Caller FormData -\> service-role Auth generateLink -\> returned confirmation URL and attempted privileged profile update. Counterevidence: The separate Edge invite handler has checks but is not this action. Existing-user behavior and invalid profile status pending limit takeover claims; unauthorized account invitation and token disclosure are supported.

Validation method: static source and effective migration review

**Invitation action issues account capabilities without checking the caller** — `app/actions/invite-member.ts:6-40`

The deployed team UI imports a server action that accepts email, clinicId and role, uses service-role generateLink without caller authentication, and returns the invite capability at line 111.

```
export async function inviteTeamMember(formData: FormData) {
  const email = formData.get("email") as string
  const name = formData.get("name") as string || "Doctor"
  const clinicId = formData.get("clinicId") as string
  const role = formData.get("role") as string || "receptionist"
  const specialization = formData.get("specialization") as string || (role === 'doctor' ? 'Odontólogo General' : 'Administrativo')

  if (!email || !clinicId) {
    throw new Error("El correo electrónico y el ID de la clínica son obligatorios.")
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const resendApiKey = process.env.RESEND_API_KEY!

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  // 1. Generate Invite Link
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email: email,
    options: {
      data: {
        clinic_id: clinicId,
        role: role,
        full_name: name,
        specialization: specialization,
        pending_invite: true
      },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`
```

Limitations:
- Reachable Next server action with configured Supabase service key. An ordinary signed-in caller suffices to pass navigation guards.
- No live database, Storage, account, payment or email operation was performed.

#### Dataflow

Caller FormData -\> service-role Auth generateLink -\> returned confirmation URL and attempted privileged profile update.

**Invitation action issues account capabilities without checking the caller** — `app/actions/invite-member.ts:6-40`

The deployed team UI imports a server action that accepts email, clinicId and role, uses service-role generateLink without caller authentication, and returns the invite capability at line 111.

```
export async function inviteTeamMember(formData: FormData) {
  const email = formData.get("email") as string
  const name = formData.get("name") as string || "Doctor"
  const clinicId = formData.get("clinicId") as string
  const role = formData.get("role") as string || "receptionist"
  const specialization = formData.get("specialization") as string || (role === 'doctor' ? 'Odontólogo General' : 'Administrativo')

  if (!email || !clinicId) {
    throw new Error("El correo electrónico y el ID de la clínica son obligatorios.")
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const resendApiKey = process.env.RESEND_API_KEY!

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  // 1. Generate Invite Link
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email: email,
    options: {
      data: {
        clinic_id: clinicId,
        role: role,
        full_name: name,
        specialization: specialization,
        pending_invite: true
      },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`
```

#### Reachability

Reachable Next server action with configured Supabase service key. An ordinary signed-in caller suffices to pass navigation guards.

Limitations:
- The separate Edge invite handler has checks but is not this action. Existing-user behavior and invalid profile status pending limit takeover claims; unauthorized account invitation and token disclosure are supported.

#### Severity

**High** — A realistic low-privilege caller can cross an authority or patient-confidentiality boundary under the stated source-defined deployment.

Additional runtime or deployment evidence could raise or lower this severity.

#### Remediation

Authenticate the action, authorize immutable owner membership for the target clinic, allow only staff roles, deliver the capability to its intended recipient only, and check every persistence result.

Tests:
- Exercise the described attack with two isolated synthetic clinics and assert denial before side effects.
- Assert an authorized owner/clinician retains the intended operation and correct clinical data.

<a id="finding-5"></a>

### [5] Staff can change their own role and clinic

| Field | Value |
| --- | --- |
| Severity | high |
| Confidence | high |
| Confidence rationale | Parent source trace corroborates the control and relevant consumers; live deployment and runtime exploitation were not tested. |
| Category | profile-authority-mutation |
| CWE | CWE-269 |
| Affected lines | supabase/migrations/20251222_enforce_enums.sql:59-65 |

#### Summary

Table-wide profile UPDATE and a self-row policy leave role, clinic_id and status writable. Role checks and the custom access-token hook trust those values.

#### Root Cause

Table-wide profile UPDATE and a self-row policy leave role, clinic_id and status writable. Role checks and the custom access-token hook trust those values.

**Staff can change their own role and clinic** — `supabase/migrations/20251222_enforce_enums.sql:59-65`

Table-wide profile UPDATE and a self-row policy leave role, clinic_id and status writable. Role checks and the custom access-token hook trust those values.

```
CREATE POLICY "Users can insert their own profile."
ON public.profiles FOR INSERT
WITH CHECK ( auth.uid() = id );

CREATE POLICY "Users can update own profile."
ON public.profiles FOR UPDATE
USING ( auth.uid() = id );
```

#### Validation

Own profile PATCH -\> privileged fields -\> get_user_clinic_id / Edge owner check / custom hook -\> elevated access. Counterevidence: Enums validate values, not authority. No protecting column revoke or trigger was found. The direct profile consumers remain relevant without the hook.

Validation method: static source and effective migration review

**Staff can change their own role and clinic** — `supabase/migrations/20251222_enforce_enums.sql:59-65`

Table-wide profile UPDATE and a self-row policy leave role, clinic_id and status writable. Role checks and the custom access-token hook trust those values.

```
CREATE POLICY "Users can insert their own profile."
ON public.profiles FOR INSERT
WITH CHECK ( auth.uid() = id );

CREATE POLICY "Users can update own profile."
ON public.profiles FOR UPDATE
USING ( auth.uid() = id );
```

Limitations:
- Authenticated user; current policies and grants applied. JWT-based escalation additionally requires the documented Auth hook.
- No live database, Storage, account, payment or email operation was performed.

#### Dataflow

Own profile PATCH -\> privileged fields -\> get_user_clinic_id / Edge owner check / custom hook -\> elevated access.

**Staff can change their own role and clinic** — `supabase/migrations/20251222_enforce_enums.sql:59-65`

Table-wide profile UPDATE and a self-row policy leave role, clinic_id and status writable. Role checks and the custom access-token hook trust those values.

```
CREATE POLICY "Users can insert their own profile."
ON public.profiles FOR INSERT
WITH CHECK ( auth.uid() = id );

CREATE POLICY "Users can update own profile."
ON public.profiles FOR UPDATE
USING ( auth.uid() = id );
```

#### Reachability

Authenticated user; current policies and grants applied. JWT-based escalation additionally requires the documented Auth hook.

Limitations:
- Enums validate values, not authority. No protecting column revoke or trigger was found. The direct profile consumers remain relevant without the hook.

#### Severity

**High** — A realistic low-privilege caller can cross an authority or patient-confidentiality boundary under the stated source-defined deployment.

Additional runtime or deployment evidence could raise or lower this severity.

#### Remediation

Allow updates only to safe profile columns. Route role, tenant, membership and status changes through tenant-authorized server operations and revoke stale sessions.

Tests:
- Exercise the described attack with two isolated synthetic clinics and assert denial before side effects.
- Assert an authorized owner/clinician retains the intended operation and correct clinical data.

<a id="finding-6"></a>

### [6] Patient statistics RPC discloses other clinics' health records

| Field | Value |
| --- | --- |
| Severity | high |
| Confidence | high |
| Confidence rationale | Parent source trace corroborates the control and relevant consumers; live deployment and runtime exploitation were not tested. |
| Category | patient-rpc-tenant-bypass |
| CWE | CWE-862 |
| Affected lines | supabase/migrations/20260525_db_verification_and_repair.sql:112-128 |

#### Summary

The canonical SECURITY DEFINER RPC accepts p_clinic_id and returns extensive patient and billing data without checking caller membership or role. Authenticated execution is explicitly granted at line 305.

#### Root Cause

The canonical SECURITY DEFINER RPC accepts p_clinic_id and returns extensive patient and billing data without checking caller membership or role. Authenticated execution is explicitly granted at line 305.

**Patient statistics RPC discloses other clinics' health records** — `supabase/migrations/20260525_db_verification_and_repair.sql:112-128`

The canonical SECURITY DEFINER RPC accepts p_clinic_id and returns extensive patient and billing data without checking caller membership or role. Authenticated execution is explicitly granted at line 305.

```
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_total bigint;
  v_search_pattern text;
BEGIN
  -- Build search pattern
  v_search_pattern := '%' || LOWER(COALESCE(p_search, '')) || '%';

  -- Count total matching records (respecting soft deletes)
  SELECT COUNT(*) INTO v_total
  FROM public.patients pat
  WHERE pat.clinic_id = p_clinic_id
    AND pat.deleted_at IS NULL
```

#### Validation

Direct RPC p_clinic_id -\> owner-privileged SELECT -\> patient health fields, contacts, notes, odontogram and financial aggregates. Counterevidence: Search, pagination and soft-delete filtering are not tenant authorization. Earlier overloads are dropped; the secure profile RPC is a separate unused guard.

Validation method: static source and effective migration review

**Patient statistics RPC discloses other clinics' health records** — `supabase/migrations/20260525_db_verification_and_repair.sql:112-128`

The canonical SECURITY DEFINER RPC accepts p_clinic_id and returns extensive patient and billing data without checking caller membership or role. Authenticated execution is explicitly granted at line 305.

```
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_total bigint;
  v_search_pattern text;
BEGIN
  -- Build search pattern
  v_search_pattern := '%' || LOWER(COALESCE(p_search, '')) || '%';

  -- Count total matching records (respecting soft deletes)
  SELECT COUNT(*) INTO v_total
  FROM public.patients pat
  WHERE pat.clinic_id = p_clinic_id
    AND pat.deleted_at IS NULL
```

Limitations:
- Authenticated caller, known tenant UUID, applied function and usual privileged migration owner.
- No live database, Storage, account, payment or email operation was performed.

#### Dataflow

Direct RPC p_clinic_id -\> owner-privileged SELECT -\> patient health fields, contacts, notes, odontogram and financial aggregates.

**Patient statistics RPC discloses other clinics' health records** — `supabase/migrations/20260525_db_verification_and_repair.sql:112-128`

The canonical SECURITY DEFINER RPC accepts p_clinic_id and returns extensive patient and billing data without checking caller membership or role. Authenticated execution is explicitly granted at line 305.

```
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_total bigint;
  v_search_pattern text;
BEGIN
  -- Build search pattern
  v_search_pattern := '%' || LOWER(COALESCE(p_search, '')) || '%';

  -- Count total matching records (respecting soft deletes)
  SELECT COUNT(*) INTO v_total
  FROM public.patients pat
  WHERE pat.clinic_id = p_clinic_id
    AND pat.deleted_at IS NULL
```

#### Reachability

Authenticated caller, known tenant UUID, applied function and usual privileged migration owner.

Limitations:
- Search, pagination and soft-delete filtering are not tenant authorization. Earlier overloads are dropped; the secure profile RPC is a separate unused guard.

#### Severity

**High** — A realistic low-privilege caller can cross an authority or patient-confidentiality boundary under the stated source-defined deployment.

Additional runtime or deployment evidence could raise or lower this severity.

#### Remediation

Use SECURITY INVOKER with corrected RLS or enforce trusted membership and clinical role inside the function; restrict EXECUTE and bound pagination.

Tests:
- Exercise the described attack with two isolated synthetic clinics and assert denial before side effects.
- Assert an authorized owner/clinician retains the intended operation and correct clinical data.

<a id="finding-7"></a>

### [7] Receptionists can write clinical records through direct APIs

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Parent source trace corroborates the control and relevant consumers; live deployment and runtime exploitation were not tested. |
| Category | clinical-role-bypass |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/20260508220424_enable_rls_prescriptions.sql:15-22 |

#### Summary

Prescription INSERT and UPDATE require only a matching clinic, permitting nonclinical members to create or alter prescriptions and supplied doctor_id. HCU forms and patient clinical columns also retain role-neutral controls.

#### Root Cause

Prescription INSERT and UPDATE require only a matching clinic, permitting nonclinical members to create or alter prescriptions and supplied doctor_id. HCU forms and patient clinical columns also retain role-neutral controls.

**Receptionists can write clinical records through direct APIs** — `supabase/migrations/20260508220424_enable_rls_prescriptions.sql:15-22`

Prescription INSERT and UPDATE require only a matching clinic, permitting nonclinical members to create or alter prescriptions and supplied doctor_id. HCU forms and patient clinical columns also retain role-neutral controls.

```
CREATE POLICY "Prescriptions are insertable by clinic members"
    ON public.prescriptions FOR INSERT
    WITH CHECK (clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid);

CREATE POLICY "Prescriptions are updatable by clinic members"
    ON public.prescriptions FOR UPDATE
    USING (clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid)
    WITH CHECK (clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid);
```

#### Validation

Same-clinic receptionist -\> direct table writes -\> altered prescriptions/HCU/patient clinical data. Counterevidence: Owner-only prescription DELETE and clinical_records role checks do not protect these sibling tables. Impact is limited to the caller clinic absent separate escalation.

Validation method: static source and effective migration review

**Receptionists can write clinical records through direct APIs** — `supabase/migrations/20260508220424_enable_rls_prescriptions.sql:15-22`

Prescription INSERT and UPDATE require only a matching clinic, permitting nonclinical members to create or alter prescriptions and supplied doctor_id. HCU forms and patient clinical columns also retain role-neutral controls.

```
CREATE POLICY "Prescriptions are insertable by clinic members"
    ON public.prescriptions FOR INSERT
    WITH CHECK (clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid);

CREATE POLICY "Prescriptions are updatable by clinic members"
    ON public.prescriptions FOR UPDATE
    USING (clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid)
    WITH CHECK (clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid);
```

Limitations:
- Valid same-clinic JWT and effective table grants. Clinical-role separation is an explicit product requirement.
- No live database, Storage, account, payment or email operation was performed.

#### Dataflow

Same-clinic receptionist -\> direct table writes -\> altered prescriptions/HCU/patient clinical data.

**Receptionists can write clinical records through direct APIs** — `supabase/migrations/20260508220424_enable_rls_prescriptions.sql:15-22`

Prescription INSERT and UPDATE require only a matching clinic, permitting nonclinical members to create or alter prescriptions and supplied doctor_id. HCU forms and patient clinical columns also retain role-neutral controls.

```
CREATE POLICY "Prescriptions are insertable by clinic members"
    ON public.prescriptions FOR INSERT
    WITH CHECK (clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid);

CREATE POLICY "Prescriptions are updatable by clinic members"
    ON public.prescriptions FOR UPDATE
    USING (clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid)
    WITH CHECK (clinic_id = (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid);
```

#### Reachability

Valid same-clinic JWT and effective table grants. Clinical-role separation is an explicit product requirement.

Limitations:
- Owner-only prescription DELETE and clinical_records role checks do not protect these sibling tables. Impact is limited to the caller clinic absent separate escalation.

#### Severity

**Medium** — Impact is limited or deployment-dependent as described; not classified as confirmed production compromise.

Additional runtime or deployment evidence could raise or lower this severity.

#### Remediation

Apply doctor/owner authorization at database write boundaries, validate prescriber identity and same-tenant patient/doctor relationships, and provide receptionist-safe read projections.

Tests:
- Exercise the described attack with two isolated synthetic clinics and assert denial before side effects.
- Assert an authorized owner/clinician retains the intended operation and correct clinical data.

<a id="finding-8"></a>

### [8] Maintenance RPCs permit unauthorized clinic changes under default grants

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Parent source trace corroborates the control and relevant consumers; live deployment and runtime exploitation were not tested. |
| Category | maintenance-rpc-authorization |
| CWE | CWE-862 |
| Affected lines | supabase/migrations/20251227_data_retention_lifecycle.sql:9-20 |

#### Summary

archive_clinic and purge_clinic_data are SECURITY DEFINER with caller-selected clinic IDs and no caller guard. seed_default_services repeats this missing authorization for service inserts. No EXECUTE revocation was found.

#### Root Cause

archive_clinic and purge_clinic_data are SECURITY DEFINER with caller-selected clinic IDs and no caller guard. seed_default_services repeats this missing authorization for service inserts. No EXECUTE revocation was found.

**Maintenance RPCs permit unauthorized clinic changes under default grants** — `supabase/migrations/20251227_data_retention_lifecycle.sql:9-20`

archive_clinic and purge_clinic_data are SECURITY DEFINER with caller-selected clinic IDs and no caller guard. seed_default_services repeats this missing authorization for service inserts. No EXECUTE revocation was found.

```
CREATE OR REPLACE FUNCTION public.archive_clinic(target_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.clinics
  SET 
    subscription_status = 'archived',
    archived_at = NOW()
  WHERE id = target_clinic_id;
END;
```

#### Validation

Public-schema RPC -\> elevated clinic lifecycle / service mutation. Counterevidence: Purge does not reliably delete populated clinics because non-CASCADE FKs block it. JWT caching can delay archival effects. Explicit external grant hardening could remove reachability.

Validation method: static source and effective migration review

**Maintenance RPCs permit unauthorized clinic changes under default grants** — `supabase/migrations/20251227_data_retention_lifecycle.sql:9-20`

archive_clinic and purge_clinic_data are SECURITY DEFINER with caller-selected clinic IDs and no caller guard. seed_default_services repeats this missing authorization for service inserts. No EXECUTE revocation was found.

```
CREATE OR REPLACE FUNCTION public.archive_clinic(target_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.clinics
  SET 
    subscription_status = 'archived',
    archived_at = NOW()
  WHERE id = target_clinic_id;
END;
```

Limitations:
- Effective attacker EXECUTE under default PostgreSQL PUBLIC function privileges; confirm actual ACLs and function owners.
- No live database, Storage, account, payment or email operation was performed.

#### Dataflow

Public-schema RPC -\> elevated clinic lifecycle / service mutation.

**Maintenance RPCs permit unauthorized clinic changes under default grants** — `supabase/migrations/20251227_data_retention_lifecycle.sql:9-20`

archive_clinic and purge_clinic_data are SECURITY DEFINER with caller-selected clinic IDs and no caller guard. seed_default_services repeats this missing authorization for service inserts. No EXECUTE revocation was found.

```
CREATE OR REPLACE FUNCTION public.archive_clinic(target_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.clinics
  SET 
    subscription_status = 'archived',
    archived_at = NOW()
  WHERE id = target_clinic_id;
END;
```

#### Reachability

Effective attacker EXECUTE under default PostgreSQL PUBLIC function privileges; confirm actual ACLs and function owners.

Limitations:
- Purge does not reliably delete populated clinics because non-CASCADE FKs block it. JWT caching can delay archival effects. Explicit external grant hardening could remove reachability.

#### Severity

**Medium** — Impact is limited or deployment-dependent as described; not classified as confirmed production compromise.

Additional runtime or deployment evidence could raise or lower this severity.

#### Remediation

Revoke maintenance EXECUTE from PUBLIC/anon/authenticated, allow authorized service execution only, and enforce retention/legal hold inside purge. Separately authenticate scheduled Edge callers.

Tests:
- Exercise the described attack with two isolated synthetic clinics and assert denial before side effects.
- Assert an authorized owner/clinician retains the intended operation and correct clinical data.

<a id="finding-9"></a>

### [9] Analytics view reveals other clinics' revenue and identifiers

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Parent source trace corroborates the control and relevant consumers; live deployment and runtime exploitation were not tested. |
| Category | analytics-owner-view |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/20260220_analytics_view.sql:5-16 |

#### Summary

An ordinary owner-rights view aggregates all billings and grants authenticated SELECT without tenant filtering or security_invoker.

#### Root Cause

An ordinary owner-rights view aggregates all billings and grants authenticated SELECT without tenant filtering or security_invoker.

**Analytics view reveals other clinics' revenue and identifiers** — `supabase/migrations/20260220_analytics_view.sql:5-16`

An ordinary owner-rights view aggregates all billings and grants authenticated SELECT without tenant filtering or security_invoker.

```
CREATE OR REPLACE VIEW public.dashboard_stats_view AS
SELECT 
    clinic_id,
    DATE_TRUNC('month', created_at) as month,
    COUNT(id) as total_billings,
    SUM(amount) as total_revenue,
    COUNT(DISTINCT patient_id) as unique_patients_billed
FROM public.billings
GROUP BY clinic_id, DATE_TRUNC('month', created_at);

-- Grant access to the view
GRANT SELECT ON public.dashboard_stats_view TO authenticated;
```

#### Validation

Direct dashboard_stats_view SELECT -\> owner execution -\> clinic UUIDs, revenues and patient volumes. Counterevidence: January security_invoker migration changes only receptionist_patient_view and recall_queue, before this view is created.

Validation method: static source and effective migration review

**Analytics view reveals other clinics' revenue and identifiers** — `supabase/migrations/20260220_analytics_view.sql:5-16`

An ordinary owner-rights view aggregates all billings and grants authenticated SELECT without tenant filtering or security_invoker.

```
CREATE OR REPLACE VIEW public.dashboard_stats_view AS
SELECT 
    clinic_id,
    DATE_TRUNC('month', created_at) as month,
    COUNT(id) as total_billings,
    SUM(amount) as total_revenue,
    COUNT(DISTINCT patient_id) as unique_patients_billed
FROM public.billings
GROUP BY clinic_id, DATE_TRUNC('month', created_at);

-- Grant access to the view
GRANT SELECT ON public.dashboard_stats_view TO authenticated;
```

Limitations:
- Usual privileged migration owner; applied view and expected billing columns.
- No live database, Storage, account, payment or email operation was performed.

#### Dataflow

Direct dashboard_stats_view SELECT -\> owner execution -\> clinic UUIDs, revenues and patient volumes.

**Analytics view reveals other clinics' revenue and identifiers** — `supabase/migrations/20260220_analytics_view.sql:5-16`

An ordinary owner-rights view aggregates all billings and grants authenticated SELECT without tenant filtering or security_invoker.

```
CREATE OR REPLACE VIEW public.dashboard_stats_view AS
SELECT 
    clinic_id,
    DATE_TRUNC('month', created_at) as month,
    COUNT(id) as total_billings,
    SUM(amount) as total_revenue,
    COUNT(DISTINCT patient_id) as unique_patients_billed
FROM public.billings
GROUP BY clinic_id, DATE_TRUNC('month', created_at);

-- Grant access to the view
GRANT SELECT ON public.dashboard_stats_view TO authenticated;
```

#### Reachability

Usual privileged migration owner; applied view and expected billing columns.

Limitations:
- January security_invoker migration changes only receptionist_patient_view and recall_queue, before this view is created.

#### Severity

**Medium** — Impact is limited or deployment-dependent as described; not classified as confirmed production compromise.

Additional runtime or deployment evidence could raise or lower this severity.

#### Remediation

Use security_invoker and corrected underlying tenant/role policies, or an explicitly authorized aggregate RPC.

Tests:
- Exercise the described attack with two isolated synthetic clinics and assert denial before side effects.
- Assert an authorized owner/clinician retains the intended operation and correct clinical data.

<a id="finding-10"></a>

### [10] Authenticated users can change shared bank-payment configuration

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Parent source trace corroborates the control and relevant consumers; live deployment and runtime exploitation were not tested. |
| Category | payment-method-tenant-bypass |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/20251214_billing_enhancements.sql:56-61 |

#### Summary

payment_methods has no tenant identifier and its FOR ALL policy accepts any authenticated user. The UI reads all methods and updates/deletes by ID, including bank account configuration.

#### Root Cause

payment_methods has no tenant identifier and its FOR ALL policy accepts any authenticated user. The UI reads all methods and updates/deletes by ID, including bank account configuration.

**Authenticated users can change shared bank-payment configuration** — `supabase/migrations/20251214_billing_enhancements.sql:56-61`

payment_methods has no tenant identifier and its FOR ALL policy accepts any authenticated user. The UI reads all methods and updates/deletes by ID, including bank account configuration.

```
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Allow read/write for authenticated users (Adjust as needed for roles)
CREATE POLICY "Authenticated users can manage payments" ON payments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage payment methods" ON payment_methods FOR ALL USING (auth.role() = 'authenticated');
```

#### Validation

Authenticated table request -\> global FOR ALL policy -\> read/change payment destination configuration. Counterevidence: The later payments table replacement fixes a different table, not payment_methods. No proof of actual misdirected payments is claimed.

Validation method: static source and effective migration review

**Authenticated users can change shared bank-payment configuration** — `supabase/migrations/20251214_billing_enhancements.sql:56-61`

payment_methods has no tenant identifier and its FOR ALL policy accepts any authenticated user. The UI reads all methods and updates/deletes by ID, including bank account configuration.

```
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Allow read/write for authenticated users (Adjust as needed for roles)
CREATE POLICY "Authenticated users can manage payments" ON payments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage payment methods" ON payment_methods FOR ALL USING (auth.role() = 'authenticated');
```

Limitations:
- Effective table grants and use of the payment_methods feature; live deployment is unverified.
- No live database, Storage, account, payment or email operation was performed.

#### Dataflow

Authenticated table request -\> global FOR ALL policy -\> read/change payment destination configuration.

**Authenticated users can change shared bank-payment configuration** — `supabase/migrations/20251214_billing_enhancements.sql:56-61`

payment_methods has no tenant identifier and its FOR ALL policy accepts any authenticated user. The UI reads all methods and updates/deletes by ID, including bank account configuration.

```
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Allow read/write for authenticated users (Adjust as needed for roles)
CREATE POLICY "Authenticated users can manage payments" ON payments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage payment methods" ON payment_methods FOR ALL USING (auth.role() = 'authenticated');
```

#### Reachability

Effective table grants and use of the payment_methods feature; live deployment is unverified.

Limitations:
- The later payments table replacement fixes a different table, not payment_methods. No proof of actual misdirected payments is claimed.

#### Severity

**Medium** — Impact is limited or deployment-dependent as described; not classified as confirmed production compromise.

Additional runtime or deployment evidence could raise or lower this severity.

#### Remediation

Add tenant ownership with a reviewed backfill; restrict configuration writes to that clinic's owner, hide secrets server-side and verify patient payment rendering uses only authorized clinic methods.

Tests:
- Exercise the described attack with two isolated synthetic clinics and assert denial before side effects.
- Assert an authorized owner/clinician retains the intended operation and correct clinical data.

<a id="finding-11"></a>

### [11] A clinic owner can insert services into another clinic

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Parent source trace corroborates the control and relevant consumers; live deployment and runtime exploitation were not tested. |
| Category | service-policy-tenant-bypass |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/20260401_fix_admin_roles.sql:37-41 |

#### Summary

The additional owner service INSERT policy checks caller role globally and omits equality with the target service clinic. Its permissive result bypasses the narrower owner policy.

#### Root Cause

The additional owner service INSERT policy checks caller role globally and omits equality with the target service clinic. Its permissive result bypasses the narrower owner policy.

**A clinic owner can insert services into another clinic** — `supabase/migrations/20260401_fix_admin_roles.sql:37-41`

The additional owner service INSERT policy checks caller role globally and omits equality with the target service clinic. Its permissive result bypasses the narrower owner policy.

```
CREATE POLICY "Admins can delete profiles." ON public.profiles FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'clinic_owner'::public.app_role));
CREATE POLICY "Admins can update all profiles." ON public.profiles FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'clinic_owner'::public.app_role));
CREATE POLICY "Admins can insert services." ON public.services FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'clinic_owner'::public.app_role));
CREATE POLICY "Admins can update services." ON public.services FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'clinic_owner'::public.app_role));
CREATE POLICY "Admins can delete services." ON public.services FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'clinic_owner'::public.app_role));
```

#### Validation

Authenticated owner -\> services INSERT victim clinic_id -\> global owner policy -\> victim catalog injection. Counterevidence: The tenant-bound FOR ALL policy does not restrict another permissive INSERT policy. Do not infer all cross-tenant UPDATE/DELETE operations without SELECT visibility.

Validation method: static source and effective migration review

**A clinic owner can insert services into another clinic** — `supabase/migrations/20260401_fix_admin_roles.sql:37-41`

The additional owner service INSERT policy checks caller role globally and omits equality with the target service clinic. Its permissive result bypasses the narrower owner policy.

```
CREATE POLICY "Admins can delete profiles." ON public.profiles FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'clinic_owner'::public.app_role));
CREATE POLICY "Admins can update all profiles." ON public.profiles FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'clinic_owner'::public.app_role));
CREATE POLICY "Admins can insert services." ON public.services FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'clinic_owner'::public.app_role));
CREATE POLICY "Admins can update services." ON public.services FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'clinic_owner'::public.app_role));
CREATE POLICY "Admins can delete services." ON public.services FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'clinic_owner'::public.app_role));
```

Limitations:
- Owner profile, victim UUID and deployed services INSERT privilege.
- No live database, Storage, account, payment or email operation was performed.

#### Dataflow

Authenticated owner -\> services INSERT victim clinic_id -\> global owner policy -\> victim catalog injection.

**A clinic owner can insert services into another clinic** — `supabase/migrations/20260401_fix_admin_roles.sql:37-41`

The additional owner service INSERT policy checks caller role globally and omits equality with the target service clinic. Its permissive result bypasses the narrower owner policy.

```
CREATE POLICY "Admins can delete profiles." ON public.profiles FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'clinic_owner'::public.app_role));
CREATE POLICY "Admins can update all profiles." ON public.profiles FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'clinic_owner'::public.app_role));
CREATE POLICY "Admins can insert services." ON public.services FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'clinic_owner'::public.app_role));
CREATE POLICY "Admins can update services." ON public.services FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'clinic_owner'::public.app_role));
CREATE POLICY "Admins can delete services." ON public.services FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'clinic_owner'::public.app_role));
```

#### Reachability

Owner profile, victim UUID and deployed services INSERT privilege.

Limitations:
- The tenant-bound FOR ALL policy does not restrict another permissive INSERT policy. Do not infer all cross-tenant UPDATE/DELETE operations without SELECT visibility.

#### Severity

**Medium** — Impact is limited or deployment-dependent as described; not classified as confirmed production compromise.

Additional runtime or deployment evidence could raise or lower this severity.

#### Remediation

Replace global role-only policies with trusted target-clinic ownership checks and consolidate the policy set.

Tests:
- Exercise the described attack with two isolated synthetic clinics and assert denial before side effects.
- Assert an authorized owner/clinician retains the intended operation and correct clinical data.

<a id="finding-12"></a>

### [12] Public email endpoint sends arbitrary HTML to arbitrary recipients

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Parent source trace corroborates the control and relevant consumers; live deployment and runtime exploitation were not tested. |
| Category | email-relay-authorization |
| CWE | CWE-862 |
| Affected lines | app/api/send-email/route.ts:9-34 |

#### Summary

The API validates only presence of to, subject and message, then sends caller HTML through the application's Resend account. The active middleware does not protect API routes.

#### Root Cause

The API validates only presence of to, subject and message, then sends caller HTML through the application's Resend account. The active middleware does not protect API routes.

**Public email endpoint sends arbitrary HTML to arbitrary recipients** — `app/api/send-email/route.ts:9-34`

The API validates only presence of to, subject and message, then sends caller HTML through the application's Resend account. The active middleware does not protect API routes.

```
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
```

#### Validation

Anonymous POST recipient/content -\> Resend API credential -\> external email delivery. Counterevidence: Missing key returns 503; no handler authentication, recipient ownership, template restriction or quota is present.

Validation method: static source and effective migration review

**Public email endpoint sends arbitrary HTML to arbitrary recipients** — `app/api/send-email/route.ts:9-34`

The API validates only presence of to, subject and message, then sends caller HTML through the application's Resend account. The active middleware does not protect API routes.

```
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
```

Limitations:
- Deployed route with configured Resend API key and sender.
- No live database, Storage, account, payment or email operation was performed.

#### Dataflow

Anonymous POST recipient/content -\> Resend API credential -\> external email delivery.

**Public email endpoint sends arbitrary HTML to arbitrary recipients** — `app/api/send-email/route.ts:9-34`

The API validates only presence of to, subject and message, then sends caller HTML through the application's Resend account. The active middleware does not protect API routes.

```
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
```

#### Reachability

Deployed route with configured Resend API key and sender.

Limitations:
- Missing key returns 503; no handler authentication, recipient ownership, template restriction or quota is present.

#### Severity

**Medium** — Impact is limited or deployment-dependent as described; not classified as confirmed production compromise.

Additional runtime or deployment evidence could raise or lower this severity.

#### Remediation

Require verified tenant/role, resolve recipients from authorized records, render bounded server templates and enforce tenant/user quotas; use a separately constrained public contact endpoint if needed.

Tests:
- Exercise the described attack with two isolated synthetic clinics and assert denial before side effects.
- Assert an authorized owner/clinician retains the intended operation and correct clinical data.

<a id="finding-13"></a>

### [13] Missing payment credentials can activate an unpaid subscription

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Parent source trace corroborates the control and relevant consumers; live deployment and runtime exploitation were not tested. |
| Category | subscription-mock-fail-open |
| CWE | CWE-636 |
| Affected lines | lib/kushki.ts:73-83 |

#### Summary

Gateway errors return synthetic active subscriptions whenever the merchant key is absent. The subscribe route persists that result as active and logs a successful payment.

#### Root Cause

Gateway errors return synthetic active subscriptions whenever the merchant key is absent. The subscribe route persists that result as active and logs a successful payment.

**Missing payment credentials can activate an unpaid subscription** — `lib/kushki.ts:73-83`

Gateway errors return synthetic active subscriptions whenever the merchant key is absent. The subscribe route persists that result as active and logs a successful payment.

```
    } catch (error) {
       console.error('[Kushki] Error:', error);
       // Mock success for development if credentials missing
       if (KUSHKI_PRIVATE_ID === 'mock_private_key') {
           return {
               subscriptionId: `sub_${Math.random().toString(36).substring(7)}`,
               status: 'active'
           }
       }
       throw error;
    }
```

#### Validation

Missing merchant config + payment attempt -\> failed request -\> fake subscriptionId -\> privileged clinic activation. Counterevidence: Configured real merchant credentials rethrow failures. This is configuration-dependent financial integrity impact; no payment fraud was executed.

Validation method: static source and effective migration review

**Missing payment credentials can activate an unpaid subscription** — `lib/kushki.ts:73-83`

Gateway errors return synthetic active subscriptions whenever the merchant key is absent. The subscribe route persists that result as active and logs a successful payment.

```
    } catch (error) {
       console.error('[Kushki] Error:', error);
       // Mock success for development if credentials missing
       if (KUSHKI_PRIVATE_ID === 'mock_private_key') {
           return {
               subscriptionId: `sub_${Math.random().toString(36).substring(7)}`,
               status: 'active'
           }
       }
       throw error;
    }
```

Limitations:
- Authenticated caller with RLS-visible clinic; missing merchant credential while Supabase admin configuration is available.
- No live database, Storage, account, payment or email operation was performed.

#### Dataflow

Missing merchant config + payment attempt -\> failed request -\> fake subscriptionId -\> privileged clinic activation.

**Missing payment credentials can activate an unpaid subscription** — `lib/kushki.ts:73-83`

Gateway errors return synthetic active subscriptions whenever the merchant key is absent. The subscribe route persists that result as active and logs a successful payment.

```
    } catch (error) {
       console.error('[Kushki] Error:', error);
       // Mock success for development if credentials missing
       if (KUSHKI_PRIVATE_ID === 'mock_private_key') {
           return {
               subscriptionId: `sub_${Math.random().toString(36).substring(7)}`,
               status: 'active'
           }
       }
       throw error;
    }
```

#### Reachability

Authenticated caller with RLS-visible clinic; missing merchant credential while Supabase admin configuration is available.

Limitations:
- Configured real merchant credentials rethrow failures. This is configuration-dependent financial integrity impact; no payment fraud was executed.

#### Severity

**Low** — Financial integrity is configuration-dependent; missing merchant credentials are a required prerequisite.

Additional runtime or deployment evidence could raise or lower this severity.

#### Remediation

Reject missing or placeholder merchant credentials before a request; never translate provider errors into successful subscriptions. Test invalid credentials, provider rejection and a valid response offline.

Tests:
- Exercise the described attack with two isolated synthetic clinics and assert denial before side effects.
- Assert an authorized owner/clinician retains the intended operation and correct clinical data.

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| Email verification grants ownership of an existing clinic | not recorded | Reported | supabase/migrations/20260423_fix_clinic_trigger.sql:20; The existing-profile guard blocks already assigned users, not fresh signups. clinics.owner_id is not overwritten; JWT-based authorization nevertheless grants owner capabilities. |
| Staff can change their own role and clinic | not recorded | Reported | supabase/migrations/20251222_enforce_enums.sql:59; Enums validate values, not authority. No protecting column revoke or trigger was found. The direct profile consumers remain relevant without the hook. |
| Users can join another clinic without an invitation | not recorded | Reported | supabase/migrations/20260525_db_verification_and_repair.sql:291; Later JWT patient policies have different names; permissive policies combine with OR. Foreign keys prove existence only. |
| Patient statistics RPC discloses other clinics' health records | not recorded | Reported | supabase/migrations/20260525_db_verification_and_repair.sql:112; Search, pagination and soft-delete filtering are not tenant authorization. Earlier overloads are dropped; the secure profile RPC is a separate unused guard. |
| Every authenticated user can read or delete all patient files | not recorded | Reported | supabase/migrations/20260526_create_patient_files_and_notes.sql:99; Private bucket status requires authentication but does not establish tenant isolation; patient_files metadata RLS is a separate control. |
| Invitation action issues account capabilities without checking the caller | not recorded | Reported | app/actions/invite-member.ts:6; The separate Edge invite handler has checks but is not this action. Existing-user behavior and invalid profile status pending limit takeover claims; unauthorized account invitation and token disclosure are supported. |
| Receptionists can write clinical records through direct APIs | not recorded | Reported | supabase/migrations/20260508220424_enable_rls_prescriptions.sql:15; Owner-only prescription DELETE and clinical_records role checks do not protect these sibling tables. Impact is limited to the caller clinic absent separate escalation. |
| Analytics view reveals other clinics' revenue and identifiers | not recorded | Reported | supabase/migrations/20260220_analytics_view.sql:5; January security_invoker migration changes only receptionist_patient_view and recall_queue, before this view is created. |
| Maintenance RPCs permit unauthorized clinic changes under default grants | not recorded | Reported | supabase/migrations/20251227_data_retention_lifecycle.sql:9; Purge does not reliably delete populated clinics because non-CASCADE FKs block it. JWT caching can delay archival effects. Explicit external grant hardening could remove reachability. |
| Public email endpoint sends arbitrary HTML to arbitrary recipients | not recorded | Reported | app/api/send-email/route.ts:9; Missing key returns 503; no handler authentication, recipient ownership, template restriction or quota is present. |
| Missing payment credentials can activate an unpaid subscription | not recorded | Reported | lib/kushki.ts:73; Configured real merchant credentials rethrow failures. This is configuration-dependent financial integrity impact; no payment fraud was executed. |
| A clinic owner can insert services into another clinic | not recorded | Reported | supabase/migrations/20260401_fix_admin_roles.sql:37; The tenant-bound FOR ALL policy does not restrict another permissive INSERT policy. Do not infer all cross-tenant UPDATE/DELETE operations without SELECT visibility. |
| Authenticated users can change shared bank-payment configuration | not recorded | Reported | supabase/migrations/20251214_billing_enhancements.sql:56; The later payments table replacement fixes a different table, not payment_methods. No proof of actual misdirected payments is claimed. |
| Security control counterevidence and runtime limits | not recorded | Needs follow-up | Independent focused reviewer fully reviewed database files; parent reviewed handlers/configuration. Completed fully read audit paths: supabase/schema.sql, supabase/README.md, supabase/functions/purge-data/index.ts, supabase/functions/admin-emergency-override/index.ts, supabase/functions/invite-team-member/index.ts, supabase/functions/send-reminders/index.ts, supabase/functions/loyalty-marketing/index.ts, supabase/migrations/20251214_billing_enhancements.sql, supabase/migrations/20251215_multi_clinic_support.sql, supabase/migrations/20251216_clinic_invitations.sql, supabase/migrations/20251218_saas_functions.sql, supabase/migrations/20251218_saas_schema.sql, supabase/migrations/20251218_saas_audit_triggers.sql, supabase/migrations/20251222_enforce_enums.sql, supabase/migrations/20251222_fix_permissions.sql, supabase/migrations/20251222_add_trial_support.sql, supabase/migrations/20251222_create_storage_branding.sql, supabase/migrations/20251227_data_retention_lifecycle.sql, supabase/migrations/20251227_optimize_rls_jwt.sql, supabase/migrations/20251227_ensure_clinics_rls.sql, supabase/migrations/20251227_enforce_subscription_rls.sql, supabase/migrations/20251227_secure_rpc_access.sql, supabase/migrations/20251227_payment_schema.sql, supabase/migrations/20251228_seed_services.sql, supabase/migrations/20251228_add_services.sql, supabase/migrations/20260113_defer_clinic_creation.sql, supabase/migrations/20260130_fix_security_definer.sql, supabase/migrations/20260220_add_prescriptions.sql, supabase/migrations/20260220_analytics_view.sql, supabase/migrations/20260220_secure_audit_view.sql, supabase/migrations/20260222_loyalty_marketing.sql, supabase/migrations/20260401_fix_admin_roles.sql, supabase/migrations/20260423_fix_clinic_trigger.sql, supabase/migrations/20260429_add_title_to_profiles.sql, supabase/migrations/20260508220424_enable_rls_prescriptions.sql, supabase/migrations/20260520_fix_get_patients_with_stats.sql, supabase/migrations/20260521_fix_overloaded_function.sql, supabase/migrations/20260525_db_verification_and_repair.sql, supabase/migrations/20260526_create_patient_files_and_notes.sql, middleware.ts, proxy.ts, lib/communication.ts, lib/kushki.ts, lib/env.ts, lib/logger.ts, lib/supabase.ts, lib/notifications.ts, hooks/use-dashboard-data.ts, components/auth-context.tsx, components/query-provider.tsx, components/settings/privacy-tab.tsx, app/auth/confirm/page.tsx, app/auth/callback/route.ts, app/api/auth/confirm/route.ts, app/api/send-email/route.ts, app/api/payments/subscribe/route.ts, app/api/webhooks/kushki/route.ts, app/actions/settings.ts, app/actions/migrations.ts, app/actions/register-clinic.ts, app/actions/invite-member.ts, app/actions/resend-confirmation.ts, app/(dashboard)/layout.tsx, next.config.mjs, package.json, tsconfig.json, .gitignore, .agents/rules/clinical-saas-invariants.md, CORRECTIONS_AND_ROADMAP.md, NEXT_STEPS.md, PRODUCTION_READINESS.md, SYSTEM_ARCHITECTURE_AND_OPERATION.md. No completed-baseline coverage claimed. Secret values were not inspected or copied. get_patient_profile_secure does bind tenant; emergency override requires secret; purge has FK limits; send-reminders is a stub. Architecture mapping alone is not full audit coverage. |

## Open Questions And Follow Up

- Which migrations, function ACLs and Auth hooks are live?
- Are clinical data or backups in production and which providers/regions process them?
- Are avatar/receipt buckets public, and how are session revocation, retention/legal holds and incident duties operated?
- User requested conserving remaining weekly usage. Whole-repository review is incomplete; baseline worker failed at usage limit. Remaining UI/support files, dependency advisories and dynamic two-tenant validation were not completed.
  - Follow-up prompt: Review deferred unit deferred-0 and close its stated proof gap. Paths: .agents/rules/production-engineering.md, AGENT_LEARNINGS_AND_TIPS.md, components/issued-prescriptions-list.tsx, components/quick-appointment-dialog.tsx, .agent/dark-mode-color-theory.md, .eslintrc.json, .vscode/settings.json, Clinia_manual.md, README.md, REBRANDING_SUMMARY.md, SUPABASE_RESOLUTION_PLAN.md, app/(auth)/forgot-password/page.tsx, app/(auth)/layout.tsx, app/(auth)/login/page.tsx, app/(auth)/signup/page.tsx, app/(auth)/update-password/page.tsx, app/(dashboard)/billing/page.tsx, app/(dashboard)/calendar/page.tsx, app/(dashboard)/clinic/page.tsx, app/(dashboard)/dashboard/page.tsx, app/(dashboard)/dashboard/services/page.tsx, app/(dashboard)/dentists/page.tsx, app/(dashboard)/loading.tsx, app/(dashboard)/marketing/page.tsx, app/(dashboard)/messages/loading.tsx, app/(dashboard)/messages/page.tsx, app/(dashboard)/patients/\[id\]/page.tsx, app/(dashboard)/patients/loading.tsx, app/(dashboard)/patients/page.tsx, app/(dashboard)/pay/\[id\]/page.tsx, app/(dashboard)/profile/page.tsx, app/(dashboard)/recipes/page.tsx, app/(dashboard)/reports/page.tsx, app/(dashboard)/settings/page.tsx, app/(landing)/layout.tsx, app/(landing)/page.tsx, app/(landing)/schedule-demo/page.tsx, app/(landing)/sobre-nosotros/page.tsx, app/auth/layout.tsx, app/error.tsx, app/sitemap.ts, auth-flow.md, components.json, components/add-patient-form.tsx, components/appointment-list.tsx, components/appointment-timeline/timeline.tsx, components/async-patient-select.tsx, components/avatar-upload.tsx, components/billing/create-billing-dialog.tsx, components/billing/generate-invoice-dialog.tsx, components/billing/payment-methods-settings.tsx, components/calendar/modern-calendar.tsx, components/dashboard-wrapper.tsx, components/dashboard.tsx, components/dashboard/services/services-manager.tsx, components/family-center.tsx, components/financial-overview.tsx, components/hcu033-form.tsx, components/landing/layout/site-footer.tsx, components/landing/layout/site-header.tsx, components/landing/theme-provider.tsx, components/landing/ui-elements/feature-card.tsx, components/landing/ui-elements/pricing-card.tsx, components/landing/ui-elements/section-header.tsx, components/landing/ui-elements/testimonial-card.tsx, components/landing/ui/button.tsx, components/landing/ui/card.tsx, components/landing/ui/input.tsx, components/landing/ui/label.tsx, components/landing/ui/radio-group.tsx, components/landing/ui/select.tsx, components/landing/ui/sheet.tsx, components/landing/ui/tabs.tsx, components/landing/ui/textarea.tsx, components/login-form.tsx, components/notification-bell.tsx, components/odontogram-preview.tsx, components/odontogram.tsx, components/odontograma-interactive.tsx, components/page-header.tsx, components/patient-files.tsx, components/patient-info-carousel.tsx, components/patient-medical-records.tsx, components/patient-payments.tsx, components/patient-prescriptions.tsx, components/patient-visits-chart.tsx, components/periodontogram.tsx, components/recall-widget.tsx, components/settings/automation-tab.tsx, components/settings/clinic-tab.tsx, components/settings/recipes-tab.tsx, components/settings/services-tab.tsx, components/settings/subscription-tab.tsx, components/sidebar-context.tsx, components/sidebar.tsx, components/signature-pad.tsx, components/signup-form.tsx, components/subscription-blocker.tsx, components/theme-provider.tsx, components/theme-toggle.tsx, components/time-range-selector.tsx, components/translations.tsx, components/ui/accordion.tsx, components/ui/alert.tsx, components/ui/avatar.tsx, components/ui/badge.tsx, components/ui/button.tsx, components/ui/card.tsx, components/ui/checkbox.tsx, components/ui/dialog.tsx, components/ui/dropdown-menu.tsx, components/ui/input.tsx, components/ui/label.tsx, components/ui/popover.tsx, components/ui/progress.tsx, components/ui/radio-group.tsx, components/ui/scroll-area.tsx, components/ui/select.tsx, components/ui/separator.tsx, components/ui/sheet.tsx, components/ui/slider.tsx, components/ui/switch.tsx, components/ui/table.tsx, components/ui/tabs.tsx, components/ui/textarea.tsx, components/ui/tooltip.tsx, components/user-nav.tsx, docs/DEVELOPER.md, docs/INVESTOR.md, docs/superpowers/plans/2026-05-01-core-clinical-phase1.md, docs/superpowers/plans/2026-05-01-phase2-financial-hub.md, docs/superpowers/plans/2026-05-18-dark-mode-readability.md, docs/superpowers/specs/2026-05-01-core-clinical-phase1-design.md, docs/superpowers/specs/2026-05-01-phase2-financial-hub-design.md, docs/superpowers/specs/2026-05-18-dark-mode-readability-design.md, extra/free-trial/page.tsx, extra/onboarding/create-clinic/page.tsx, extra/onboarding/layout.tsx, extra/onboarding/page.tsx, fix-dark-mode.js, fix-role.js, hooks/use-app-data.tsx, hooks/use-realtime-notifications.ts, lib/constants.ts, lib/invoicing/index.ts, lib/invoicing/providers/mock-sri.ts, lib/invoicing/types.ts, lib/patient-utils.ts, lib/pdf-generator-budget.ts, lib/pdf-generator.ts, lib/recall-service.ts, lib/reports-pdf.ts, lib/sri-service.ts, lib/subscription-plans.ts, lib/utils.ts, lib/validations.ts, package-lock.json, postcss.config.mjs, scratch/delete-user.sql, scratch/diagnose.js, skill/SKILL.md, skills/dental-clinical-standards/SKILL.md, start-dev.js, supabase/.temp/linked-project.json, supabase/functions/deno.json, supabase/functions/invite-team-member/deno.json, supabase/migrations/20231123_auto_create_profile.sql, supabase/migrations/20251215_add_patient_columns.sql, supabase/migrations/20251215_fix_patient_uniqueness.sql, supabase/migrations/20251219_add_clinic_metadata.sql, supabase/migrations/20251219_allow_create_clinic.sql, supabase/migrations/20251219_genesis_flow.sql, supabase/migrations/20251222_add_disclaimer_text.sql, supabase/migrations/20251222_add_medical_alerts.sql, supabase/migrations/20251222_add_odontogram_state.sql, supabase/migrations/20251222_add_periodontogram_state.sql, supabase/migrations/20251222_add_working_hours.sql, supabase/migrations/20251222_create_recall_queue_view.sql, supabase/migrations/20251227_audit_read_beacon.sql, supabase/migrations/20251227_fix_signup_error.sql, supabase/migrations/20251227_security_checklist.sql, supabase/migrations/20251227_subscription_bypass.sql, supabase/migrations/20251228_update_patients_schema.sql, supabase/migrations/20260113_production_indexes.sql, supabase/migrations/20260220_performance_indexes.sql, supabase/migrations/20260502_prescription_templates.sql, tailwind.config.ts, test/test-action.js, test/test-api-confirm.js, test/test-link.js, test/test-ssr-verify.js, test/test-verify-already.js, test/test-verify-unverified.js, test/test-verify.js, types/index.ts, types/supabase.ts, types/types.ts, update_role.sql.
- Edge purge/loyalty caller restrictions depend on uninspected deployment gateway; require scheduler authentication review.
  - Follow-up prompt: Review deferred unit deferred-1 and close its stated proof gap.
- Confirm auth/confirm next parameter navigation safety, webhook authenticity/replay, audit insert attribution, and owner-writable billing/subscription fields in follow-up.
  - Follow-up prompt: Review deferred unit deferred-2 and close its stated proof gap.
- Independent baseline candidates awaiting parent source validation and full evidence payload.
  - Follow-up prompt: Review deferred unit baseline-initial-boundaries and close its stated proof gap.
- Awaiting parent validation of independent baseline evidence and effective policies.
  - Follow-up prompt: Review deferred unit baseline-profile-analytics-lifecycle and close its stated proof gap.
- Independent reviewers agree; parent validation pending.
  - Follow-up prompt: Review deferred unit onboarding-tenant-takeover and close its stated proof gap.
