-- Index for faster duplicate detection
CREATE INDEX IF NOT EXISTS idx_transactions_duplicate_check
ON transactions(user_id, date, amount);

-- Index for description-based searches (category suggestions)
CREATE INDEX IF NOT EXISTS idx_transactions_description
ON transactions(user_id, LOWER(description));
