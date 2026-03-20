-- Add management fields to expenses_admins table
-- Allows admins to activate/deactivate expenses admins with history

ALTER TABLE expenses_admins ADD COLUMN IF NOT EXISTS name TEXT DEFAULT '';
ALTER TABLE expenses_admins ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE expenses_admins ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE expenses_admins ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
