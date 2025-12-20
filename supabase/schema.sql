-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text,
  role text check (role in ('doctor', 'reception', 'admin')),
  avatar_url text,
  email text,
  phone text,
  address text,
  specialization text,
  license_number text,
  bio text,
  clinic_id uuid references public.clinics(id),
  updated_at timestamp with time zone
);

alter table public.profiles enable row level security;

create policy "Users can view profiles in their clinic"
  on profiles for select
  using (
    auth.uid() = id -- Can always see self
    OR
    clinic_id = get_user_clinic_id()
  );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- PATIENTS
create table public.patients (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  first_name text not null,
  last_name text not null,
  cedula text,
  email text,
  phone text,
  birth_date date,
  gender text,
  address text,
  medical_history jsonb default '{}'::jsonb,
  emergency_contact text,
  emergency_phone text,
  allergies text,
  medications text,
  medical_conditions text,
  insurance_provider text,
  policy_number text,
  clinic_id uuid references public.clinics(id),
  unique(cedula, clinic_id)
);

alter table public.patients enable row level security;

create policy "Users can view patients in their clinic"
  on patients for select
  using ( clinic_id = get_user_clinic_id() );

create policy "Users can insert patients in their clinic"
  on patients for insert
  with check ( clinic_id = get_user_clinic_id() );

create policy "Users can update patients in their clinic"
  on patients for update
  using ( clinic_id = get_user_clinic_id() );

-- APPOINTMENTS
create table public.appointments (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  patient_id uuid references public.patients(id) on delete cascade not null,
  doctor_id uuid references public.profiles(id),
  clinic_id uuid references public.clinics(id),
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  status text check (status in ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')) default 'scheduled',
  type text,
  notes text
);

alter table public.appointments enable row level security;

create policy "Users can view appointments in their clinic"
  on appointments for select
  using ( clinic_id = get_user_clinic_id() );

create policy "Users can insert appointments in their clinic"
  on appointments for insert
  with check ( clinic_id = get_user_clinic_id() );

create policy "Users can update appointments in their clinic"
  on appointments for update
  using ( clinic_id = get_user_clinic_id() );

-- HCU033 FORMS
create table public.hcu033_forms (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  patient_id uuid references public.patients(id) on delete cascade not null,
  doctor_id uuid references public.profiles(id),
  form_data jsonb not null
);

alter table public.hcu033_forms enable row level security;

create policy "Users can view forms in their clinic"
  on hcu033_forms for select
  using ( 
    patient_id in (SELECT id FROM public.patients WHERE clinic_id = get_user_clinic_id())
  );

create policy "Users can insert forms in their clinic"
  on hcu033_forms for insert
  with check ( 
    patient_id in (SELECT id FROM public.patients WHERE clinic_id = get_user_clinic_id())
  );

create policy "Users can update forms in their clinic"
  on hcu033_forms for update
  using ( 
    patient_id in (SELECT id FROM public.patients WHERE clinic_id = get_user_clinic_id())
  );

-- MESSAGES
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  sender_id uuid references public.profiles(id) not null,
  receiver_id uuid references public.profiles(id),
  content text not null,
  is_read boolean default false
);

alter table public.messages enable row level security;

create policy "Users can view their own messages"
  on messages for select
  using ( auth.uid() = sender_id OR auth.uid() = receiver_id );

create policy "Users can insert messages"
  on messages for insert
  with check ( auth.uid() = sender_id );

create policy "Users can update their own messages"
  on messages for update
  using ( auth.uid() = sender_id );

-- NOTIFICATIONS
create table public.notifications (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references public.profiles(id) not null,
  title text not null,
  message text not null,
  type text check (type in ('info', 'warning', 'success', 'error')) default 'info',
  is_read boolean default false,
  link text
);

alter table public.notifications enable row level security;

create policy "Users can view their own notifications"
  on notifications for select
  using ( auth.uid() = user_id );

create policy "System can insert notifications"
  on notifications for insert
  with check ( true ); -- Allow any authenticated user (or system) to create notifications for now

create policy "Users can update their own notifications"
  on notifications for update
  using ( auth.uid() = user_id );

-- TREATMENTS
create table public.treatments (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  price numeric not null,
  description text,
  clinic_id uuid references public.clinics(id)
);

alter table public.treatments enable row level security;

create policy "Users can view treatments in their clinic"
  on treatments for select
  using ( clinic_id = get_user_clinic_id() );

create policy "Users can insert treatments in their clinic"
  on treatments for insert
  with check ( clinic_id = get_user_clinic_id() );

create policy "Users can update treatments in their clinic"
  on treatments for update
  using ( clinic_id = get_user_clinic_id() );

-- BILLINGS
create table public.billings (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  patient_id uuid references public.patients(id) not null,
  amount numeric not null,
  status text check (status in ('paid', 'pending', 'overdue')) default 'pending',
  description text,
  due_date date,
  invoice_number text
);

alter table public.billings enable row level security;

create policy "Users can view billings in their clinic"
  on billings for select
  using ( 
    patient_id in (SELECT id FROM public.patients WHERE clinic_id = get_user_clinic_id())
  );

create policy "Users can insert billings in their clinic"
  on billings for insert
  with check ( 
    patient_id in (SELECT id FROM public.patients WHERE clinic_id = get_user_clinic_id())
  );

create policy "Users can update billings in their clinic"
  on billings for update
  using ( 
    patient_id in (SELECT id FROM public.patients WHERE clinic_id = get_user_clinic_id())
  );

-- Added by Antigravity for Automation & Billing
CREATE TABLE IF NOT EXISTS public.automation_settings (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_id uuid REFERENCES public.profiles(id) NOT NULL,
  enabled BOOLEAN DEFAULT false,
  reminder_template TEXT DEFAULT 'Hola {patient_name}, te recordamos tu cita el {date} a las {time} con el Dr. {doctor_name}.',
  days_before INTEGER DEFAULT 1,
  whatsapp_enabled BOOLEAN DEFAULT false,
  email_enabled BOOLEAN DEFAULT true
);

ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings"
  ON automation_settings FOR SELECT
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can insert their own settings"
  ON automation_settings FOR INSERT
  WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can update their own settings"
  ON automation_settings FOR UPDATE
  USING ( auth.uid() = user_id );

ALTER TABLE public.billings 
ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.appointments(id);

-- CLINICS
create table public.clinics (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  owner_id uuid references public.profiles(id),
  logo_url text,
  address text,
  phone text,
  email text,
  settings jsonb default '{}'::jsonb
);

alter table public.clinics enable row level security;

create policy "Users can view their own clinic"
  on clinics for select
  using ( 
    id in (select clinic_id from public.profiles where id = auth.uid()) 
    or 
    owner_id = auth.uid() 
  );

create policy "Owners can update their own clinic"
  on clinics for update
  using ( owner_id = auth.uid() );

-- INVOICES
create table public.invoices (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  clinic_id uuid references public.clinics(id),
  patient_id uuid references public.patients(id),
  billing_id uuid references public.billings(id),
  invoice_number text,
  sri_authorization text,
  sri_access_key text,
  xml_content text,
  pdf_url text,
  status text,
  total_amount numeric,
  items jsonb
);

alter table public.invoices enable row level security;

create policy "Users can view invoices in their clinic"
  on invoices for select
  using ( clinic_id = get_user_clinic_id() );

create policy "Users can insert invoices in their clinic"
  on invoices for insert
  with check ( clinic_id = get_user_clinic_id() );

create policy "Users can update invoices in their clinic"
  on invoices for update
  using ( clinic_id = get_user_clinic_id() );

-- PROFILE AUDIT LOG
create table public.profile_audit_log (
  id bigint generated by default as identity primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  target_user_id uuid references public.profiles(id),
  actor_user_id uuid references public.profiles(id),
  actor_role text,
  action text,
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  ip_address text,
  user_agent text
);

alter table public.profile_audit_log enable row level security;

create policy "Admins can view audit logs"
  on profile_audit_log for select
  using ( 
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') 
  );


-- HELPER FUNCTIONS & TRIGGERS
CREATE OR REPLACE FUNCTION get_user_clinic_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT clinic_id FROM profiles WHERE id = auth.uid();
$$;

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', COALESCE(new.raw_user_meta_data->>'role', 'doctor'));
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
