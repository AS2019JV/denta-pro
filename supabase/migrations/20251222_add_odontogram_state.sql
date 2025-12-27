-- Add JSONB column for the Visual Odontogram
ALTER TABLE public.clinical_records 
ADD COLUMN IF NOT EXISTS odontogram_state JSONB DEFAULT '{}'::jsonb;

-- Comment: Structure will be { "tooth_18": { "condition": "cavity", "surface": "occlusal" } }
