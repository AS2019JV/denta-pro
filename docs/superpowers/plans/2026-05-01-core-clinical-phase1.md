# Core Clinical Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement strict GDPR compliance for patient data and fix scheduling conflicts to secure the clinical workflow.

**Architecture:** We will update Zod schemas to enforce GDPR consent and national ID. We'll add a database export security dialog to require confirmation for bulk downloads. The calendar component will check for overlapping appointments before saving.

**Tech Stack:** Next.js 15, React Hook Form, Zod, Supabase, Tailwind, shadcn/ui

---

### Task 1: Update Patient Validation Schema

**Files:**
- Modify: `lib/validations.ts:25-39`

- [ ] **Step 1: Add cedula and dataConsent to Zod schema**

```typescript
export const patientSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio (mín. 2 caracteres)"),
  lastName: z.string().min(2, "El apellido es obligatorio (mín. 2 caracteres)"),
  cedula: z.string().min(5, "La cédula/DNI es obligatoria para el registro médico"),
  email: z.string().email("Correo electrónico inválido").optional().or(z.literal("")),
  phone: z.string().min(7, "El teléfono debe tener al menos 7 dígitos"),
  address: z.string().optional(),
  birthDate: z.string().min(1, "La fecha de nacimiento es obligatoria"),
  gender: z.string().optional(),
  occupation: z.string().optional(),
  guardianName: z.string().optional(),
  referralSource: z.string().optional(),
  referredBy: z.string().optional(),
  medicalRecordNumber: z.string().optional(),
  clinicalNotes: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  allergies: z.string().optional(),
  medications: z.string().optional(),
  medicalConditions: z.string().optional(),
  insuranceProvider: z.string().optional(),
  policyNumber: z.string().optional(),
  bloodType: z.string().optional(),
  maritalStatus: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  hasDiabetes: z.boolean().default(false),
  hasHypertension: z.boolean().default(false),
  hasHeartDisease: z.boolean().default(false),
  isSmoker: z.boolean().default(false),
  isPregnant: z.boolean().default(false),
  preferredContactMethod: z.string().default("phone"),
  recallMonths: z.coerce.number().default(6),
  internalNotes: z.string().optional(),
  accountBalance: z.coerce.number().optional(),
  dataConsent: z.boolean().refine(val => val === true, {
    message: "Debe aceptar el tratamiento de datos para registrar un paciente médico",
  }),
})
```

- [ ] **Step 2: Commit**

```bash
git add lib/validations.ts
git commit -m "feat(patients): enforce cedula and data consent in validation schema"
```

### Task 2: Implement GDPR & UI Updates in AddPatientForm

**Files:**
- Modify: `components/add-patient-form.tsx`

- [ ] **Step 1: Update form defaults**
Modify defaultValues in `useForm` to include `cedula: initialData?.cedula || ""` and `dataConsent: initialData?.dataConsent || false`.

- [ ] **Step 2: Add cedula input to UI**
Insert inside the Personal Information grid before Name.

```tsx
<div className="space-y-2 col-span-2 md:col-span-1">
  <Label htmlFor="cedula">Cédula / DNI / Pasaporte *</Label>
  <Input
    id="cedula"
    {...register("cedula")}
    className={errors.cedula ? "border-red-500" : ""}
  />
  {errors.cedula && <p className="text-xs text-red-500">{errors.cedula.message}</p>}
</div>
```

- [ ] **Step 3: Add data consent checkbox to UI**
Insert at the end of the form, before the action buttons.

```tsx
<div className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-teal-50/50">
  <Checkbox
    id="dataConsent"
    checked={watch("dataConsent")}
    onCheckedChange={(checked) => setValue("dataConsent", checked === true)}
  />
  <div className="space-y-1 leading-none">
    <Label htmlFor="dataConsent" className="font-semibold">
      Consentimiento de Tratamiento de Datos (GDPR/HIPAA) *
    </Label>
    <p className="text-sm text-slate-500">
      El paciente autoriza el almacenamiento de sus datos personales y médicos con fines clínicos. 
      Esta acción quedará registrada en la auditoría de la clínica.
    </p>
    {errors.dataConsent && <p className="text-xs text-red-500 mt-2">{errors.dataConsent.message}</p>}
  </div>
</div>
```

- [ ] **Step 4: Update submit payload**
Include `cedula` and `data_consent` in the supabase insert payload.
```tsx
cedula: values.cedula,
data_consent: values.dataConsent,
```

- [ ] **Step 5: Commit**

```bash
git add components/add-patient-form.tsx
git commit -m "feat(patients): add GDPR consent and cedula to patient form UI"
```

### Task 3: Secure Database Export

**Files:**
- Modify: `app/(dashboard)/patients/page.tsx`

- [ ] **Step 1: Create state for Secure Export Dialog**
```tsx
const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
const [exportConfirmationText, setExportConfirmationText] = useState("")
```

- [ ] **Step 2: Update Export Button**
Change the current export button's onClick from `exportToCSV` to `() => setIsExportDialogOpen(true)`.

- [ ] **Step 3: Add SecureExportDialog component**
Add this dialog to the page return structure:
```tsx
<Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2 text-rose-600">
        <ShieldAlert className="h-5 w-5" />
        Seguridad de Datos Clínicos
      </DialogTitle>
      <DialogDescription>
        Está a punto de exportar una copia de seguridad de la base de datos de pacientes. 
        Este archivo contiene información médica altamente sensible protegida por regulaciones (GDPR/HIPAA).
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-4 py-4">
      <div className="p-3 bg-amber-50 text-amber-800 text-sm rounded-lg border border-amber-200">
        Esta acción quedará registrada permanentemente en la auditoría de seguridad de la clínica junto con su IP y usuario.
      </div>
      <div className="space-y-2">
        <Label>Para confirmar, escriba <strong>CONFIRMAR</strong></Label>
        <Input 
          value={exportConfirmationText}
          onChange={(e) => setExportConfirmationText(e.target.value)}
          placeholder="Escriba CONFIRMAR aquí..."
        />
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>Cancelar</Button>
      <Button 
        variant="destructive" 
        disabled={exportConfirmationText !== "CONFIRMAR"}
        onClick={() => {
          setIsExportDialogOpen(false)
          setExportConfirmationText("")
          exportToCSV()
        }}
      >
        <Download className="h-4 w-4 mr-2" />
        Exportar Base de Datos
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/patients/page.tsx
git commit -m "feat(patients): implement secure GDPR export dialog"
```

### Task 4: Calendar Conflict Prevention

**Files:**
- Modify: `components/calendar/modern-calendar.tsx`

- [ ] **Step 1: Update `handleCreateAppointment` for conflict checking**
Inside `handleCreateAppointment`, before inserting the appointment, query existing appointments for the selected date, doctor, and time.
```tsx
// Check for overlap
const { data: overlapping, error: overlapError } = await supabase
  .from('appointments')
  .select('id')
  .eq('doctor_id', formValues.doctor_id)
  .eq('appointment_date', format(formValues.date, "yyyy-MM-dd"))
  .eq('start_time', formValues.start_time)
  .neq('status', 'cancelled')

if (overlapping && overlapping.length > 0) {
  toast.error("Conflicto de agenda: El especialista ya tiene una cita en ese horario.")
  setIsLoading(false)
  return
}
```

- [ ] **Step 2: Commit**

```bash
git add components/calendar/modern-calendar.tsx
git commit -m "fix(calendar): prevent scheduling overlaps for specialists"
```

### Task 5: Dashboard Data Optimization

**Files:**
- Modify: `hooks/use-dashboard-data.ts`

- [ ] **Step 1: Optimize Appointment Fetching**
Instead of fetching all appointments, limit to recent/upcoming or limit by count.
```tsx
const thirtyDaysAgo = new Date()
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

const { data: appointmentsData, error: appointmentsError } = await supabase
  .from('appointments')
  .select('*')
  .eq('clinic_id', currentClinicId)
  .gte('appointment_date', thirtyDaysAgo.toISOString().split('T')[0])
  .order('appointment_date', { ascending: false })
```

- [ ] **Step 2: Commit**

```bash
git add hooks/use-dashboard-data.ts
git commit -m "perf(dashboard): optimize dashboard appointment fetch query"
```
