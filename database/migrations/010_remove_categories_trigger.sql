-- Remove the old categories trigger that runs on user creation
-- The categories table was replaced by tags system in migration 008

-- Drop the trigger
DROP TRIGGER IF EXISTS trigger_copy_categories ON users;

-- Drop the function
DROP FUNCTION IF EXISTS copy_default_categories();
