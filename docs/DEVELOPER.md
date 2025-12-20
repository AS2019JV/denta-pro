# Developer Documentation: Denta-Pro

## Overview
Denta-Pro is a full-stack SaaS application designed for Dental Clinics in Ecuador. It leverages **Next.js 14** (App Router) for the frontend and **Supabase** (Postgres + Auth) for the backend.

## Key Features & Architecture

### 1. Database & Security
-   **Supabase**: Acts as the primary backend-as-a-service.
-   **Multi-tenancy**:
    -   All major tables (`patients`, `appointments`, `billings`, `treatments`) are scoped by `clinic_id`.
    -   The `profiles` table links users (Doctors/Receptionists) to a `clinic_id`.
-   **Row Level Security (RLS)**:
    -   Strict policies enforced at the database level.
    -   We use a helper function `get_user_clinic_id()` to prevent infinite recursion in policies.
    -   See `supabase/schema.sql` for all definitions.

### 2. Invoicing (Facturación Electrónica SRI)
-   **Architecture**: Uses an Adapter Pattern to support multiple providers.
-   **Core Logic**: `lib/invoicing/`
    -   `types.ts`: Interface definitions (`InvoiceProvider`).
    -   `providers/mock-sri.ts`: Current default implementation for demonstration.
-   **Extension Point**: To integrate a real SRI provider (e.g., FactureroMovil, Facilito), implement the `InvoiceProvider` interface and update the factory in `lib/invoicing/index.ts`.

### 3. Clinical Forms (HCU-033 / Odontogram)
-   **HCU-033**: Fully digitized MSP-compliant form (`components/hcu033-form.tsx`).
    -   Auto-save to `hcu033_forms` table (JSONB).
    -   **PDF Export**: Generates a strictly formatted 2-page PDF matching government requirements.
-   **Odontogram**: Interactive component (`components/odontograma-interactive.tsx`) for charting dental status.

### 4. Localization
-   **Locale**: `es-EC` (Ecuador).
-   **Timezone**: `America/Guayaquil` (GMT-5).
-   **Currency**: USD ($).

## Production Readiness & Deployment

### WhatsApp Integration
To enable real automated WhatsApp messaging (currently simulated via `window.open`):
1.  Register for a **Meta Developer Account**.
2.  Create a **WhatsApp Business App**.
3.  Obtain the **System User Access Token** and **Phone Number ID**.
4.  Configure these credentials in your environment variables.
5.  Implement the API call in `lib/automation.ts`.

### Security & Compliance (GDPR/HIPAA)
*   **Data Isolation**: RLS ensures strict data isolation between clinics.
*   **Audit Logs**: The `profile_audit_log` table tracks changes to sensitive user profiles.
*   **Encryption**: All data in Supabase is encrypted at rest.
*   **Access Control**: 'Doctor' vs 'Reception' roles are supported in the schema.

### Deployment Checklist
1.  **Environment Variables**:
    *   `NEXT_PUBLIC_SUPABASE_URL`
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2.  **Database Migration**:
    *   Execute the full content of `supabase/schema.sql` on your production Supabase project SQL Editor.
3.  **Storage**:
    *   Create a public storage bucket named `avatars` for user profile pictures.
4.  **Build**:
    *   Run `npm run build` to verify there are no type errors.

## Getting Started (Local Dev)
1.  Clone repo.
2.  `npm install`
3.  Set up `.env.local`.
4.  `npm run dev`
