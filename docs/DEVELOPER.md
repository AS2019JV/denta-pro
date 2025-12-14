
# Developer Documentation: Denta-Pro

## Overview
Denta-Pro is a SaaS application for Dental Clinics in Ecuador. It uses Next.js 14, Supabase (Postgres + Auth), and Shadcn/UI.

## Key Features & Architecture

### 1. Database & Security
- **Supabase**: The source of truth.
- **RLS (Row Level Security)**:
    - **Multi-tenancy**: Most tables (`patients`, `appointments`, `billings`) are scoped by `clinic_id`.
    - **Profiles**: `profiles` table maps users to clinics.
    - **Policies**: See `supabase/schema.sql` for policy definitions (e.g., "Users can view patients in their clinic").

### 2. Invoicing (Facturación Electrónica SRI)
- **Architecture**: Adapter Pattern.
- **Data Model**: `invoices` table stores the SRI response (XML, authorization, access key).
- **Service**: `lib/invoicing/` contains the logic.
    - `types.ts`: Defines `SRIInvoice`, `InvoiceProvider`.
    - `providers/mock-sri.ts`: A mock implementation for testing/demo.
- **Extension**: To use a real provider (e.g., FactureroMovil), create a new class implementing `InvoiceProvider` and update the factory in `index.ts`.

### 3. HCU-033 Form
- Located in `components/hcu033-form.tsx`.
- Logic:
    - Automatically saves to Supabase as JSONB (`hcu033_forms` table).
    - "Export PDF" generates a 2-page PDF compliant with MSP Ecuador standards using `jspdf`.

### 4. Localization
- Default Locale: `es-EC` (Ecuador).
- Timezone: `America/Guayaquil` (GMT-5).
- Configuration: `lib/constants.ts` and `app/settings/page.tsx`.

### 5. Data Management
- **Import/Export**: Located in `app/patients/page.tsx`.
- **Export**: Generates a JSON dump of the patients list.
- **Import**: Parses JSON and upserts to Supabase, matching by `cedula`.

## Getting Started
1. `npm install`
2. Set up `.env.local` with Supabase credentials.
3. `npm run dev`

## Deployment
- Build: `npm run build`.
- Deploy to Vercel/Netlify.
- Ensure Supabase migrations are applied (`supabase/schema.sql`).
