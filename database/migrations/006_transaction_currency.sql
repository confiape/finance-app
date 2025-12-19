-- Add currency field to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'PEN';

-- Update existing transactions to PEN (Peruvian Sol)
UPDATE transactions SET currency = 'PEN' WHERE currency IS NULL;

-- Create index for currency filtering
CREATE INDEX IF NOT EXISTS idx_transactions_currency ON transactions(currency);
