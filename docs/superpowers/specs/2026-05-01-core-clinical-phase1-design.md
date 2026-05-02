# Phase 1: Core Clinical Management (Strict Compliance)

## Overview
This specification details the implementation plan for Phase 1 of the platform modernization, focusing on the `patients`, `calendar`, and `dashboard` modules. The goal is to enforce GDPR-compliant data practices, improve UI/UX, and establish high-fidelity, secure clinical workflows.

## 1. Patients Module (`/patients`)
### Security & GDPR
- **Consent Tracking**: Add a `data_consent` boolean field to the patient registration schema.
- **UI Updates**:
  - Add a mandatory "Consentimiento de Tratamiento de Datos" checkbox to `AddPatientForm`.
  - Add `cedula` (National ID) as a mandatory field in `AddPatientForm` and `patientSchema` for strict patient identification.
- **Data Export Security**:
  - Implement a `SecureExportDialog` component.
  - Require the user to type the word "CONFIRMAR" (or similar friction) before exporting the database to CSV/JSON to prevent accidental data leaks.

### UI/UX Refinements
- **Patient Details Page**: Group medical alerts (Diabetes, Hypertension, etc.) into a dedicated, highly visible "Medical Dashboard" section instead of just tooltips.
- **Form Layout**: Clearly separate "Required Contact Info" from "Optional Medical History" in the patient creation process to streamline receptionist workflows.

## 2. Calendar Module (`/calendar`)
### Conflict Prevention
- **Strict Booking**: Modify `handleCreateAppointment` to query existing appointments for the selected doctor and time slot.
- **Error Handling**: If a scheduling conflict is detected, throw a UI error preventing the double-booking.

### UI/UX Refinements
- **Color Coding**: Implement clear status-based color coding in the calendar view (e.g., Confirmed = Green, Pending = Yellow, Cancelled = Red).
- **Interactivity**: Ensure appointments can be easily clicked to view details and status updates.

## 3. Dashboard Module (`/dashboard`)
### Performance & Data Integrity
- **Optimized Fetching**: Update `useDashboardData` to fetch only the appointments for the current week/month by default, rather than all historical appointments, preventing slow load times as the clinic grows.
- **Activity Feed**: Ensure the "Recent Activity" feed correctly logs the new strict-compliance actions (like consent recording).

## Implementation Strategy
We will execute this in sequential steps:
1. Update Validation Schemas & Database Types (if needed).
2. Refactor `AddPatientForm` and `patient-details.tsx`.
3. Build the `SecureExportDialog`.
4. Refactor `useDashboardData` and `modern-calendar.tsx` for conflict prevention.
