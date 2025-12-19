-- Expand currency field to support multiple currencies (comma-separated)
-- Example: "PEN" or "PEN,USD"
ALTER TABLE accounts ALTER COLUMN currency TYPE VARCHAR(20);
