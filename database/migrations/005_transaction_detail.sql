-- Add detail column to transactions
-- This field allows users to add their own description/note to any transaction
-- The original 'description' remains as the bank/source description

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS detail TEXT;

-- Create index for searching by detail
CREATE INDEX IF NOT EXISTS idx_transactions_detail ON transactions(detail) WHERE detail IS NOT NULL;
