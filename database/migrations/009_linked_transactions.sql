-- Add linked_to column for transaction linking (reimbursements)
-- This allows linking an expense to its reimbursement (income)

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS linked_to INTEGER REFERENCES transactions(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_linked_to ON transactions(linked_to) WHERE linked_to IS NOT NULL;

-- Comment explaining the purpose
COMMENT ON COLUMN transactions.linked_to IS 'Reference to a linked transaction (e.g., expense linked to its reimbursement)';
