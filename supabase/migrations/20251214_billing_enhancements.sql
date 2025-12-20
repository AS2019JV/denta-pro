-- Migration: Billing and Payments Enhancements
-- Created: 2025-12-14

-- 1. Payments Table: To track partial or full payments against a billing record
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  billing_id UUID REFERENCES billings(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  method TEXT NOT NULL, -- 'CASH', 'TRANSFER', 'STRIPE', 'PAYPHONE'
  reference TEXT, -- Stripe Charge ID, Transfer Ref, or PayPhone TransactionId
  proof_url TEXT, -- URL to verification image/doc
  status TEXT DEFAULT 'completed', -- 'pending', 'completed', 'failed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Invoices Table: Ensure SRI fields exist (Upsert/Create if not exists)
-- This table might already exist loosely, ensuring columns.
CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  billing_id UUID REFERENCES billings(id),
  invoice_number TEXT, -- 001-001-000000001
  status TEXT DEFAULT 'DRAFT',
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add SRI specific columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'sri_access_key') THEN
        ALTER TABLE invoices ADD COLUMN sri_access_key TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'sri_authorization_date') THEN
        ALTER TABLE invoices ADD COLUMN sri_authorization_date TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'xml_content') THEN
        ALTER TABLE invoices ADD COLUMN xml_content TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'environment') THEN
        ALTER TABLE invoices ADD COLUMN environment TEXT DEFAULT 'TEST';
    END IF;
END $$;

-- 3. Payment Methods: Store configuration for global or per-doctor payments
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  doctor_id UUID REFERENCES profiles(id), -- Optional: if specific to doctor, null for clinic global
  type TEXT NOT NULL, -- 'BANK_TRANSFER', 'STRIPE', 'PAYPHONE'
  title TEXT, -- e.g. "Banco Pichincha - Ahorros"
  config JSONB, -- { "bank_name": "...", "account_number": "..." } or { "stripe_publishable_key": "..." }
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS Policies (Basic)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Allow read/write for authenticated users (Adjust as needed for roles)
CREATE POLICY "Authenticated users can manage payments" ON payments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage payment methods" ON payment_methods FOR ALL USING (auth.role() = 'authenticated');

-- Function to update billing status based on payments
CREATE OR REPLACE FUNCTION update_billing_status() RETURNS TRIGGER AS $$
DECLARE
    total_paid DECIMAL(10,2);
    bill_amount DECIMAL(10,2);
BEGIN
    SELECT amount INTO bill_amount FROM billings WHERE id = NEW.billing_id;
    SELECT COALESCE(SUM(amount), 0) INTO total_paid FROM payments WHERE billing_id = NEW.billing_id AND status = 'completed';
    
    IF total_paid >= bill_amount THEN
        UPDATE billings SET status = 'paid' WHERE id = NEW.billing_id;
    ELSIF total_paid > 0 THEN
        UPDATE billings SET status = 'pending' WHERE id = NEW.billing_id; -- Or 'partial'
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_billing_status
AFTER INSERT OR UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_billing_status();
