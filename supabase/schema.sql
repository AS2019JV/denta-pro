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
  updated_at timestamp with time zone
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

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
  cedula text unique,
  email text,
  phone text,
  birth_date date,
  gender text,
  address text,
  medical_history jsonb default '{}'::jsonb
);

alter table public.patients enable row level security;

create policy "Authenticated users can view patients"
  on patients for select
  using ( auth.role() = 'authenticated' );

create policy "Authenticated users can insert patients"
  on patients for insert
  with check ( auth.role() = 'authenticated' );

create policy "Authenticated users can update patients"
  on patients for update
  using ( auth.role() = 'authenticated' );

-- APPOINTMENTS
create table public.appointments (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  patient_id uuid references public.patients(id) on delete cascade not null,
  doctor_id uuid references public.profiles(id),
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  status text check (status in ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')) default 'scheduled',
  type text,
  notes text
);

alter table public.appointments enable row level security;

create policy "Authenticated users can view appointments"
  on appointments for select
  using ( auth.role() = 'authenticated' );

create policy "Authenticated users can insert appointments"
  on appointments for insert
  with check ( auth.role() = 'authenticated' );

create policy "Authenticated users can update appointments"
  on appointments for update
  using ( auth.role() = 'authenticated' );

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

create policy "Authenticated users can view forms"
  on hcu033_forms for select
  using ( auth.role() = 'authenticated' );

create policy "Authenticated users can insert forms"
  on hcu033_forms for insert
  with check ( auth.role() = 'authenticated' );

create policy "Authenticated users can update forms"
  on hcu033_forms for update
  using ( auth.role() = 'authenticated' );

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

create policy "Authenticated users can view messages"
  on messages for select
  using ( auth.role() = 'authenticated' );

create policy "Authenticated users can insert messages"
  on messages for insert
  with check ( auth.role() = 'authenticated' );

create policy "Authenticated users can update messages"
  on messages for update
  using ( auth.role() = 'authenticated' );

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

create policy "Authenticated users can view billings"
  on billings for select
  using ( auth.role() = 'authenticated' );

create policy "Authenticated users can insert billings"
  on billings for insert
  with check ( auth.role() = 'authenticated' );

create policy "Authenticated users can update billings"
  on billings for update
  using ( auth.role() = 'authenticated' );

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

