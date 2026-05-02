# Phase 2: Administrative & Financial Hub

## Overview
This specification details the implementation plan for Phase 2 of the platform modernization, focusing on the `billing` module, dashboard analytics, and Role-Based Access Control (RBAC). The goal is to establish a secure, accurate, and professional financial workflow for the clinic.

## 1. Billing & Invoicing Engine (`/billing`)
### Workflow Standardization
- **Invoice Generation**: Ensure that when an appointment is created in the calendar with `createInvoice: true`, the resulting billing record in the `billings` table correctly links to the patient and treatment. (This was partially implemented in Phase 1's calendar, but we must ensure the Billing UI accurately reflects this).
- **Billing UI**: Enhance the `billing/page.tsx` (or equivalent financial view) to show clear status badges (Pending = Yellow, Paid = Green, Overdue = Red) and allow marking invoices as paid.
- **Receipts**: Ensure there is a UI mechanism to view/print a basic invoice receipt.

## 2. Role-Based Access Control (RBAC)
### UI Enforcement
- **Financial Deletion**: Only `clinic_owner` should see the "Delete Invoice" button. Receptionists and doctors can view or create, but not delete financial records.
- **Settings Access**: Ensure the `/settings` routes and destructive actions across the app hide their buttons if the user is a `receptionist` or `doctor` (unless it's their own profile).

## 3. Financial Analytics (Dashboard)
### Revenue Accuracy
- **Dashboard Charts**: Ensure `useDashboardData` and the Dashboard UI calculate the "Monthly Revenue" and "Pending Balance" accurately by summing `amount` from the `billings` table based on `status = 'paid'` vs `status = 'pending'`.
- **Recent Transactions**: Display a "Recent Payments" or "Pending Invoices" card on the dashboard for immediate reception action.

## Implementation Strategy
1. Audit and update RBAC UI wrappers in `billing` and `settings`.
2. Refactor `app/(dashboard)/billing/page.tsx` (if it exists, or create it) to handle the new invoice flow.
3. Update the `Dashboard` charts to pull directly from the `billings` data fetched in `useDashboardData`.
