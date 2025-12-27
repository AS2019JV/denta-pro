-- Add JSONB column for Periodontal Charting
ALTER TABLE public.clinical_records 
ADD COLUMN IF NOT EXISTS periodontogram_state JSONB DEFAULT '{}'::jsonb;

-- Comment: Structure will be { "tooth_18": { "pocket_depths": [3,3,4, 5,3,3], "bleeding": true } }
