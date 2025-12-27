ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS working_hours JSONB DEFAULT '{
  "mon": ["09:00", "17:00"], 
  "tue": ["09:00", "17:00"], 
  "wed": ["09:00", "17:00"], 
  "thu": ["09:00", "17:00"], 
  "fri": ["09:00", "17:00"], 
  "sat": null, 
  "sun": null
}'::jsonb;
